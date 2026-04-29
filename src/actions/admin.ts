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
// Criar dupla com conta de acesso e entrada no ranking
// ============================================================

export async function createTeamWithAccount(formData: FormData): Promise<{ password: string }> {
  const { profile, admin } = await requireAdmin()

  const tournamentId = formData.get('tournament_id') as string
  const categoryId = formData.get('category_id') as string
  const name = formData.get('name') as string
  const player1Name = formData.get('player1_name') as string
  const player1Email = formData.get('player1_email') as string
  const player2Name = formData.get('player2_name') as string
  const player2Email = (formData.get('player2_email') as string) || null

  if (!tournamentId || !categoryId || !name || !player1Name || !player1Email) {
    throw new Error('Preenche todos os campos obrigatórios')
  }

  // Gera password aleatória
  const password = Math.random().toString(36).slice(-8) + 'A1!'

  // Cria a conta de auth
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: player1Email,
    password,
    email_confirm: true,
  })
  if (authError) throw new Error('Erro ao criar conta: ' + authError.message)

  // Aguarda trigger criar o profile (ou cria manualmente se não existir)
  await new Promise((r) => setTimeout(r, 500))
  const { data: authProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle()

  let profileId = authProfile?.id
  if (!profileId) {
    const { data: newProfile } = await admin
      .from('profiles')
      .insert({ auth_user_id: authData.user.id, name: player1Name, email: player1Email, role: 'team_captain' })
      .select('id')
      .single()
    profileId = newProfile?.id
  } else {
    await admin.from('profiles').update({ name: player1Name, email: player1Email }).eq('id', profileId)
  }

  // Cria a equipa
  const { data: team, error: teamError } = await admin
    .from('teams')
    .insert({
      tournament_id: tournamentId,
      category_id: categoryId,
      name,
      player1_name: player1Name,
      player1_email: player1Email,
      player2_name: player2Name,
      player2_email: player2Email,
      captain_profile_id: profileId,
    })
    .select()
    .single()
  if (teamError) throw new Error('Erro ao criar dupla: ' + teamError.message)

  // Atualiza o profile com a equipa
  if (profileId) {
    await admin.from('profiles').update({ team_id: team.id }).eq('id', profileId)
  }

  // Adiciona ao ranking na última posição
  const { data: existingRankings } = await admin
    .from('rankings')
    .select('position')
    .eq('category_id', categoryId)
    .order('position', { ascending: false })
    .limit(1)
  const nextPosition = (existingRankings?.[0]?.position ?? 0) + 1

  await admin.from('rankings').insert({
    tournament_id: tournamentId,
    category_id: categoryId,
    team_id: team.id,
    position: nextPosition,
  })

  await admin.from('audit_logs').insert({
    actor_profile_id: profile.id,
    action: 'team.created',
    entity_type: 'teams',
    entity_id: team.id,
    metadata: { name },
  })

  revalidatePath('/admin/teams')
  revalidatePath('/admin/ranking')
  revalidatePath('/ranking')

  return { password }
}

// ============================================================
// Reset password de uma dupla
// ============================================================

export async function resetTeamPassword(teamId: string): Promise<{ email: string; password: string }> {
  const { admin } = await requireAdmin()

  const { data: team } = await admin
    .from('teams')
    .select('player1_email, captain_profile_id')
    .eq('id', teamId)
    .single()
  if (!team) throw new Error('Dupla não encontrada')

  const { data: profileData } = await admin
    .from('profiles')
    .select('auth_user_id')
    .eq('id', team.captain_profile_id)
    .single()
  if (!profileData?.auth_user_id) throw new Error('Conta não encontrada')

  const password = Math.random().toString(36).slice(-8) + 'A1!'
  const { error } = await admin.auth.admin.updateUserById(profileData.auth_user_id, { password })
  if (error) throw new Error('Erro ao redefinir password: ' + error.message)

  return { email: team.player1_email, password }
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
    .select('position, tournament_id')
    .eq('team_id', teamId)
    .eq('category_id', categoryId)
    .single()

  if (!current) throw new Error('Equipa sem ranking nesta categoria')

  // Se já está na posição pretendida, não faz nada
  if (current.position === newPosition) return

  // Usa posição temporária para evitar conflito de unique constraint
  // Depois faz swap: a equipa na posição alvo vai para a posição atual
  const { data: targetTeam } = await admin
    .from('rankings')
    .select('team_id')
    .eq('category_id', categoryId)
    .eq('position', newPosition)
    .maybeSingle()

  await admin.from('rankings').update({ position: 99999 }).eq('team_id', teamId).eq('category_id', categoryId)

  if (targetTeam) {
    await admin.from('rankings').update({ position: current.position }).eq('team_id', targetTeam.team_id).eq('category_id', categoryId)
  }

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
// Registar jogo passado (admin)
// ============================================================

export async function registerPastMatch(formData: FormData) {
  const { profile, admin } = await requireAdmin()
  const { applyRankingUpdate } = await import('@/lib/domain/ranking')
  const { applyRankingUpdatesToDB } = await import('./ranking-helpers')

  const challengerTeamId = formData.get('challenger_team_id') as string
  const challengedTeamId = formData.get('challenged_team_id') as string
  const winnerSide = formData.get('winner_team_id') as string // 'challenger' | 'challenged'
  const winnerTeamId = winnerSide === 'challenger' ? challengerTeamId : challengedTeamId
  const playedAt = formData.get('played_at') as string | null

  if (!challengerTeamId || !challengedTeamId || !winnerTeamId) {
    throw new Error('Preenche todos os campos obrigatórios')
  }
  if (challengerTeamId === challengedTeamId) {
    throw new Error('As duas duplas têm de ser diferentes')
  }

  // Recolhe sets
  const sets: { challenger: number; challenged: number }[] = []
  for (let i = 1; i <= 3; i++) {
    const c = formData.get(`set_${i}_challenger`)
    const d = formData.get(`set_${i}_challenged`)
    if (c !== null && d !== null && c !== '' && d !== '') {
      sets.push({ challenger: Number(c), challenged: Number(d) })
    }
  }

  // Carrega as equipas para obter torneio/categoria
  const { data: challengerTeam } = await admin
    .from('teams')
    .select('tournament_id, category_id')
    .eq('id', challengerTeamId)
    .single()
  if (!challengerTeam) throw new Error('Dupla desafiante não encontrada')

  // Cria desafio já completado
  const { data: challenge, error: challengeError } = await admin
    .from('challenges')
    .insert({
      tournament_id: challengerTeam.tournament_id,
      category_id: challengerTeam.category_id,
      challenger_team_id: challengerTeamId,
      challenged_team_id: challengedTeamId,
      created_by: profile.id,
      status: 'completed',
      ...(playedAt ? { deadline_at: playedAt } : {}),
    })
    .select()
    .single()
  if (challengeError) throw new Error('Erro ao criar desafio: ' + challengeError.message)

  // Cria resultado já validado
  const { data: result, error: resultError } = await admin
    .from('match_results')
    .insert({
      challenge_id: challenge.id,
      submitted_by_team_id: winnerTeamId,
      winner_team_id: winnerTeamId,
      status: 'validated',
      validated_by_profile_id: profile.id,
      validated_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (resultError) throw new Error('Erro ao criar resultado: ' + resultError.message)

  // Insere sets
  if (sets.length > 0) {
    await admin.from('match_sets').insert(
      sets.map((s, i) => ({
        match_result_id: result.id,
        set_number: i + 1,
        challenger_games: s.challenger,
        challenged_games: s.challenged,
      }))
    )
  }

  // Atualiza ranking se o desafiante venceu
  if (winnerTeamId === challengerTeamId) {
    const { data: rankings } = await admin
      .from('rankings')
      .select('*')
      .eq('category_id', challengerTeam.category_id)

    if (rankings) {
      const updates = applyRankingUpdate(rankings, challengerTeamId, challengedTeamId)
      if (updates.length > 0) {
        await applyRankingUpdatesToDB(admin, updates, challengerTeam.category_id, challengerTeamId, {
          tournament_id: challengerTeam.tournament_id,
          challenge_id: challenge.id,
          created_by: profile.id,
          reason: '[ADMIN] Jogo registado manualmente',
        })
      }
    }
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: profile.id,
    action: 'match.registered',
    entity_type: 'challenges',
    entity_id: challenge.id,
    metadata: { challenger_team_id: challengerTeamId, challenged_team_id: challengedTeamId, winner_team_id: winnerTeamId },
  })

  revalidatePath('/admin')
  revalidatePath('/admin/resultados')
  revalidatePath('/ranking')
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
