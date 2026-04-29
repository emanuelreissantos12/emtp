'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TeamStatus, UserRole } from '@/types/database'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') throw new Error('Sem permissão')

  return { supabase, profile, admin: createAdminClient() }
}

// ============================================================
// Criar dupla
// ============================================================

export async function createTeam(formData: FormData) {
  const { profile, admin } = await requireAdmin()

  const data = {
    tournament_id: formData.get('tournament_id') as string,
    category_id: formData.get('category_id') as string,
    name: formData.get('name') as string,
    player1_name: formData.get('player1_name') as string,
    player1_email: formData.get('player1_email') as string,
    player1_phone: formData.get('player1_phone') as string | null,
    player1_nif: formData.get('player1_nif') as string | null,
    player1_dob: formData.get('player1_dob') as string | null,
    player1_address: formData.get('player1_address') as string | null,
    player2_name: formData.get('player2_name') as string,
    player2_email: formData.get('player2_email') as string,
    player2_phone: formData.get('player2_phone') as string | null,
    player2_nif: formData.get('player2_nif') as string | null,
    player2_dob: formData.get('player2_dob') as string | null,
    player2_address: formData.get('player2_address') as string | null,
  }

  const { data: team, error } = await admin.from('teams').insert(data).select().single()
  if (error) throw new Error('Erro ao criar dupla: ' + error.message)

  await admin.from('audit_logs').insert({
    actor_profile_id: profile.id,
    action: 'team.created',
    entity_type: 'teams',
    entity_id: team.id,
    metadata: { name: data.name },
  })

  revalidatePath('/admin/teams')
  revalidatePath('/ranking')
}

// ============================================================
// Atualizar estado de uma dupla
// ============================================================

export async function updateTeamStatus(teamId: string, status: TeamStatus, reason: string) {
  const { profile, admin } = await requireAdmin()

  if (!reason.trim()) throw new Error('É necessário indicar o motivo')

  await admin.from('teams').update({ status }).eq('id', teamId)

  await admin.from('audit_logs').insert({
    actor_profile_id: profile.id,
    action: `team.status_changed.${status}`,
    entity_type: 'teams',
    entity_id: teamId,
    metadata: { status, reason },
  })

  revalidatePath('/admin/teams')
  revalidatePath('/ranking')
}

// ============================================================
// Editar posição no ranking manualmente
// ============================================================

export async function setRankingPosition(
  teamId: string,
  categoryId: string,
  newPosition: number,
  reason: string
) {
  const { profile, admin } = await requireAdmin()

  if (!reason.trim()) throw new Error('É necessário indicar o motivo')

  const { data: current } = await admin
    .from('rankings')
    .select('position')
    .eq('team_id', teamId)
    .eq('category_id', categoryId)
    .single()

  if (!current) throw new Error('Equipa sem ranking nesta categoria')

  await admin
    .from('rankings')
    .update({ position: newPosition })
    .eq('team_id', teamId)
    .eq('category_id', categoryId)

  await admin.from('ranking_events').insert({
    category_id: categoryId,
    team_id: teamId,
    old_position: current.position,
    new_position: newPosition,
    reason: `[ADMIN] ${reason}`,
    created_by: profile.id,
    tournament_id: (
      await admin.from('rankings').select('tournament_id').eq('team_id', teamId).single()
    ).data?.tournament_id,
  })

  await admin.from('audit_logs').insert({
    actor_profile_id: profile.id,
    action: 'ranking.manual_update',
    entity_type: 'rankings',
    entity_id: teamId,
    metadata: { categoryId, old: current.position, new: newPosition, reason },
  })

  revalidatePath('/admin/ranking')
  revalidatePath('/ranking')
}

// ============================================================
// Criar convite
// ============================================================

export async function createInvite(email: string, teamId: string | null, role: UserRole) {
  const { profile, admin } = await requireAdmin()

  // Verifica se já existe convite válido
  const { data: existing } = await admin
    .from('invites')
    .select('id')
    .eq('email', email)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (existing) throw new Error('Já existe um convite válido para este email')

  const { data: invite, error } = await admin
    .from('invites')
    .insert({ email, team_id: teamId, role, created_by: profile.id })
    .select()
    .single()

  if (error) throw new Error('Erro ao criar convite: ' + error.message)

  await admin.from('audit_logs').insert({
    actor_profile_id: profile.id,
    action: 'invite.created',
    entity_type: 'invites',
    entity_id: invite.id,
    metadata: { email, role, team_id: teamId },
  })

  revalidatePath('/admin/invites')
  return invite
}

// ============================================================
// Decidir falta de comparência
// ============================================================

export async function decideWalkover(
  challengeId: string,
  winnerTeamId: string,
  reason: string
) {
  const { profile, admin } = await requireAdmin()

  if (!reason.trim()) throw new Error('É necessário indicar o motivo')

  await admin
    .from('challenges')
    .update({ status: 'completed' })
    .eq('id', challengeId)

  // Cria resultado administrativo
  const { data: result } = await admin
    .from('match_results')
    .insert({
      challenge_id: challengeId,
      submitted_by_team_id: winnerTeamId,
      winner_team_id: winnerTeamId,
      status: 'validated',
      validated_by_profile_id: profile.id,
      validated_at: new Date().toISOString(),
    })
    .select()
    .single()

  // Atualiza ranking
  const { data: challenge } = await admin
    .from('challenges')
    .select('*')
    .eq('id', challengeId)
    .single()

  if (challenge && winnerTeamId === challenge.challenger_team_id) {
    const { applyRankingUpdate } = await import('@/lib/domain/ranking')
    const { data: rankings } = await admin
      .from('rankings')
      .select('*')
      .eq('category_id', challenge.category_id)

    if (rankings) {
      const updates = applyRankingUpdate(
        rankings,
        challenge.challenger_team_id,
        challenge.challenged_team_id
      )
      for (const update of updates) {
        await admin
          .from('rankings')
          .update({ position: update.newPosition })
          .eq('team_id', update.teamId)
          .eq('category_id', challenge.category_id)

        await admin.from('ranking_events').insert({
          tournament_id: challenge.tournament_id,
          category_id: challenge.category_id,
          challenge_id: challengeId,
          team_id: update.teamId,
          old_position: update.oldPosition,
          new_position: update.newPosition,
          reason: `[ADMIN] Falta de comparência — ${reason}`,
          created_by: profile.id,
        })
      }
    }
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: profile.id,
    action: 'challenge.walkover',
    entity_type: 'challenges',
    entity_id: challengeId,
    metadata: { winner_team_id: winnerTeamId, reason },
  })

  revalidatePath('/admin')
  revalidatePath(`/challenges/${challengeId}`)
  revalidatePath('/ranking')
}

// ============================================================
// Criar horário livre
// ============================================================

export async function createSlot(formData: FormData) {
  const { profile, admin } = await requireAdmin()

  const data = {
    tournament_id: formData.get('tournament_id') as string,
    court_id: formData.get('court_id') as string,
    starts_at: formData.get('starts_at') as string,
    ends_at: formData.get('ends_at') as string,
    status: 'free' as const,
  }

  const { error } = await admin.from('schedule_slots').insert(data)
  if (error) throw new Error('Erro ao criar horário: ' + error.message)

  revalidatePath('/admin/slots')
}

// ============================================================
// Adicionar dupla ao ranking
// ============================================================

export async function addTeamToRanking(
  teamId: string,
  categoryId: string,
  tournamentId: string,
  position: number
) {
  const { profile, admin } = await requireAdmin()

  const { error } = await admin.from('rankings').insert({
    tournament_id: tournamentId,
    category_id: categoryId,
    team_id: teamId,
    position,
  })

  if (error) throw new Error('Erro ao adicionar ao ranking: ' + error.message)

  revalidatePath('/admin/ranking')
  revalidatePath('/ranking')
}
