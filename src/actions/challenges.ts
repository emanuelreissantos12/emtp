'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  getEligibleTargets,
  getChallengeLockReason,
} from '@/lib/domain/challenge'
import { applyRankingUpdate } from '@/lib/domain/ranking'
import { parseMatchResult } from '@/lib/domain/result'
import {
  buildChallengeReceivedNotification,
  buildResultSubmittedNotification,
  buildResultValidatedNotification,
} from '@/lib/domain/notifications'
import type { SetScore } from '@/lib/domain/result'
import type { RankingRow } from '@/types/database'

import { applyRankingUpdatesToDB } from './ranking-helpers'

async function getSessionProfile() {
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
  if (!profile) throw new Error('Perfil não encontrado')

  return { supabase, profile }
}

// ============================================================
// Criar desafio
// ============================================================

export async function createChallenge(formData: FormData) {
  const { supabase, profile } = await getSessionProfile()
  const admin = createAdminClient()

  const targetTeamId = formData.get('target_team_id') as string
  if (!targetTeamId) throw new Error('Dupla alvo em falta')
  const proposedDatetime = formData.get('proposed_datetime') as string | null
  const proposedCourt = formData.get('proposed_court') as string | null
  const message = formData.get('message') as string | null

  // Encontra a equipa do capitão
  const { data: myTeam } = await supabase
    .from('teams')
    .select('*, tournament_id, category_id')
    .eq('captain_profile_id', profile.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!myTeam) throw new Error('Não tens uma dupla ativa neste torneio')

  // Rankings da categoria
  const { data: rankings } = await supabase
    .from('rankings')
    .select('*, team:teams(*)')
    .eq('category_id', myTeam.category_id)
    .order('position')

  if (!rankings) throw new Error('Erro ao carregar ranking')

  // Valida elegibilidade
  const eligibleTargets = getEligibleTargets(myTeam.id, rankings as RankingRow[])
  const isEligible = eligibleTargets.some((t) => t.team_id === targetTeamId)
  if (!isEligible) {
    throw new Error('Esta dupla não é um alvo elegível para desafio')
  }

  // Verifica locks
  const { data: activeChallenges } = await supabase
    .from('challenges')
    .select('*')
    .or(`challenger_team_id.eq.${myTeam.id},challenged_team_id.eq.${myTeam.id}`)
    .not('status', 'in', '("completed","cancelled","expired")')

  // Último adversário
  const { data: lastChallenge } = await supabase
    .from('challenges')
    .select('*, result:match_results!inner(*)')
    .or(`challenger_team_id.eq.${myTeam.id},challenged_team_id.eq.${myTeam.id}`)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastOpponentId = lastChallenge
    ? lastChallenge.challenger_team_id === myTeam.id
      ? lastChallenge.challenged_team_id
      : lastChallenge.challenger_team_id
    : null

  const iLostLast = lastChallenge?.result?.winner_team_id !== myTeam.id

  const lockReason = getChallengeLockReason(
    myTeam,
    activeChallenges ?? [],
    lastOpponentId,
    targetTeamId,
    !iLostLast
  )
  if (lockReason) throw new Error(lockReason)

  // Verifica dupla alvo ativa
  const { data: targetTeam } = await supabase
    .from('teams')
    .select('status')
    .eq('id', targetTeamId)
    .single()
  if (targetTeam?.status !== 'active') {
    throw new Error('A dupla alvo está suspensa ou retirada')
  }

  // Cria o desafio
  const { data: challenge, error } = await admin
    .from('challenges')
    .insert({
      tournament_id: myTeam.tournament_id,
      category_id: myTeam.category_id,
      challenger_team_id: myTeam.id,
      challenged_team_id: targetTeamId,
      created_by: profile.id,
    })
    .select()
    .single()

  if (error) throw new Error('Erro ao criar desafio: ' + error.message)

  // Notificação para a dupla desafiada
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq(
      'id',
      (await supabase.from('teams').select('captain_profile_id').eq('id', targetTeamId).single())
        .data?.captain_profile_id
    )
    .maybeSingle()

  if (targetProfile) {
    const notif = buildChallengeReceivedNotification(myTeam.name, challenge.id)
    await admin.from('notifications').insert({
      profile_id: targetProfile.id,
      ...notif,
    })
  }

  // Proposta de horário imediata (se fornecida)
  if (proposedDatetime) {
    await admin.from('challenge_proposals').insert({
      challenge_id: challenge.id,
      proposed_by_team_id: myTeam.id,
      proposed_datetime: proposedDatetime,
      proposed_court: proposedCourt ?? null,
    })
    await admin
      .from('challenges')
      .update({ status: 'negotiating' })
      .eq('id', challenge.id)
  }

  // Mensagem inicial (se fornecida)
  if (message?.trim()) {
    await admin.from('challenge_messages').insert({
      challenge_id: challenge.id,
      author_profile_id: profile.id,
      message: message.trim(),
    })
  }

  // Audit log
  await admin.from('audit_logs').insert({
    actor_profile_id: profile.id,
    action: 'challenge.created',
    entity_type: 'challenges',
    entity_id: challenge.id,
    metadata: { challenger_team_id: myTeam.id, challenged_team_id: targetTeamId },
  })

  revalidatePath('/challenges')
  redirect(`/challenges/${challenge.id}`)
}

// ============================================================
// Submeter resultado
// ============================================================

export async function submitResult(
  challengeId: string,
  sets: SetScore[],
  winnerTeamId: string
) {
  const { supabase, profile } = await getSessionProfile()
  const admin = createAdminClient()

  // Valida o resultado pelas regras do torneio
  const parsed = parseMatchResult(sets)
  if (!parsed.valid) throw new Error(parsed.error ?? 'Resultado inválido')

  // Verifica que o utilizador pertence a uma das duplas
  const { data: challenge } = await supabase
    .from('challenges')
    .select('*, challenger_team:teams!challenges_challenger_team_id_fkey(*), challenged_team:teams!challenges_challenged_team_id_fkey(*)')
    .eq('id', challengeId)
    .single()

  if (!challenge) throw new Error('Desafio não encontrado')
  if (!['scheduled', 'negotiating', 'result_pending'].includes(challenge.status)) {
    throw new Error('Este desafio não está em estado de resultado')
  }

  const myTeam = [challenge.challenger_team, challenge.challenged_team].find(
    (t) => t.captain_profile_id === profile.id
  )
  if (!myTeam && profile.role !== 'admin') {
    throw new Error('Não tens permissão para submeter este resultado')
  }

  // Cria o resultado
  const { data: result, error: resultError } = await admin
    .from('match_results')
    .insert({
      challenge_id: challengeId,
      submitted_by_team_id: myTeam?.id ?? challenge.challenger_team_id,
      winner_team_id: winnerTeamId,
      status: 'pending_validation',
    })
    .select()
    .single()

  if (resultError) throw new Error('Erro ao submeter resultado: ' + resultError.message)

  // Insere os sets
  const setsData = sets.map((s, i) => ({
    match_result_id: result.id,
    set_number: i + 1,
    challenger_games: s.challenger,
    challenged_games: s.challenged,
  }))
  await admin.from('match_sets').insert(setsData)

  // Atualiza status do desafio
  await admin
    .from('challenges')
    .update({ status: 'result_pending' })
    .eq('id', challengeId)

  // Notifica a outra dupla
  const otherTeam =
    myTeam?.id === challenge.challenger_team_id
      ? challenge.challenged_team
      : challenge.challenger_team

  if (otherTeam?.captain_profile_id) {
    const notif = buildResultSubmittedNotification(myTeam?.name ?? '', challengeId)
    await admin.from('notifications').insert({
      profile_id: otherTeam.captain_profile_id,
      ...notif,
    })
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: profile.id,
    action: 'result.submitted',
    entity_type: 'match_results',
    entity_id: result.id,
    metadata: { challenge_id: challengeId, winner_team_id: winnerTeamId },
  })

  revalidatePath(`/challenges/${challengeId}`)
}

// ============================================================
// Validar resultado (pela outra dupla ou organização)
// ============================================================

export async function validateResult(resultId: string, accepted: boolean) {
  const { supabase, profile } = await getSessionProfile()
  const admin = createAdminClient()

  const { data: result } = await supabase
    .from('match_results')
    .select('*, challenge:challenges(*)')
    .eq('id', resultId)
    .single()

  if (!result) throw new Error('Resultado não encontrado')
  if (result.status !== 'pending_validation') {
    throw new Error('Resultado já processado')
  }

  const challenge = result.challenge

  if (!accepted) {
    await admin
      .from('match_results')
      .update({ status: 'rejected', validated_by_profile_id: profile.id, validated_at: new Date().toISOString() })
      .eq('id', resultId)

    await admin
      .from('challenges')
      .update({ status: 'disputed' })
      .eq('id', challenge.id)

    revalidatePath(`/challenges/${challenge.id}`)
    return
  }

  // Valida
  await admin
    .from('match_results')
    .update({
      status: 'validated',
      validated_by_profile_id: profile.id,
      validated_at: new Date().toISOString(),
    })
    .eq('id', resultId)

  await admin
    .from('challenges')
    .update({ status: 'completed' })
    .eq('id', challenge.id)

  // Atualiza ranking se o desafiante venceu
  if (result.winner_team_id === challenge.challenger_team_id) {
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

      if (updates.length > 0) {
        await applyRankingUpdatesToDB(
          admin,
          updates,
          challenge.category_id,
          challenge.challenger_team_id,
          { tournament_id: challenge.tournament_id, challenge_id: challenge.id, created_by: profile.id, reason: 'Resultado de desafio validado' }
        )
      }
    }
  }

  // Notificações
  const notif = buildResultValidatedNotification(challenge.id)
  const teamsToNotify = [challenge.challenger_team_id, challenge.challenged_team_id]
  for (const teamId of teamsToNotify) {
    const { data: team } = await admin
      .from('teams')
      .select('captain_profile_id')
      .eq('id', teamId)
      .single()
    if (team?.captain_profile_id) {
      await admin.from('notifications').insert({
        profile_id: team.captain_profile_id,
        ...notif,
      })
    }
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: profile.id,
    action: 'result.validated',
    entity_type: 'match_results',
    entity_id: resultId,
    metadata: { challenge_id: challenge.id, winner_team_id: result.winner_team_id },
  })

  revalidatePath(`/challenges/${challenge.id}`)
  revalidatePath('/ranking')
}

// ============================================================
// Corrigir resultado (admin)
// ============================================================

export async function overrideResult(
  challengeId: string,
  newWinnerTeamId: string,
  sets: SetScore[]
) {
  const { supabase, profile } = await getSessionProfile()
  const admin = createAdminClient()

  if (profile.role !== 'admin') throw new Error('Sem permissão')

  const parsed = parseMatchResult(sets)
  if (!parsed.valid) throw new Error(parsed.error ?? 'Resultado inválido')

  const { data: challenge } = await admin
    .from('challenges')
    .select('*')
    .eq('id', challengeId)
    .single()

  if (!challenge) throw new Error('Desafio não encontrado')

  // Reverte ranking events anteriores deste desafio (se existirem)
  const { data: prevEvents } = await admin
    .from('ranking_events')
    .select('*')
    .eq('challenge_id', challengeId)

  if (prevEvents && prevEvents.length > 0) {
    for (const ev of prevEvents) {
      await admin
        .from('rankings')
        .update({ position: ev.old_position })
        .eq('team_id', ev.team_id)
        .eq('category_id', challenge.category_id)
    }
    await admin.from('ranking_events').delete().eq('challenge_id', challengeId)
  }

  // Remove resultado anterior e sets
  const { data: prevResult } = await admin
    .from('match_results')
    .select('id')
    .eq('challenge_id', challengeId)
    .maybeSingle()

  if (prevResult) {
    await admin.from('match_sets').delete().eq('match_result_id', prevResult.id)
    await admin.from('match_results').delete().eq('id', prevResult.id)
  }

  // Insere novo resultado já validado
  const { data: newResult, error: resErr } = await admin
    .from('match_results')
    .insert({
      challenge_id: challengeId,
      submitted_by_team_id: challenge.challenger_team_id,
      winner_team_id: newWinnerTeamId,
      status: 'validated',
      validated_by_profile_id: profile.id,
      validated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (resErr) throw new Error('Erro ao guardar resultado: ' + resErr.message)

  const setsData = sets.map((s, i) => ({
    match_result_id: newResult.id,
    set_number: i + 1,
    challenger_games: s.challenger,
    challenged_games: s.challenged,
  }))
  await admin.from('match_sets').insert(setsData)

  await admin
    .from('challenges')
    .update({ status: 'completed' })
    .eq('id', challengeId)

  // Aplica novo ranking se desafiante venceu
  if (newWinnerTeamId === challenge.challenger_team_id) {
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

      if (updates.length > 0) {
        await applyRankingUpdatesToDB(
          admin,
          updates,
          challenge.category_id,
          challenge.challenger_team_id,
          { tournament_id: challenge.tournament_id, challenge_id: challengeId, created_by: profile.id, reason: 'Correção de resultado por admin' }
        )
      }
    }
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: profile.id,
    action: 'result.overridden',
    entity_type: 'challenges',
    entity_id: challengeId,
    metadata: { new_winner_team_id: newWinnerTeamId },
  })

  revalidatePath(`/challenges/${challengeId}`)
  revalidatePath('/ranking')
}

// ============================================================
// Enviar mensagem no chat
// ============================================================

export async function sendMessage(challengeId: string, message: string) {
  const { supabase, profile } = await getSessionProfile()
  const admin = createAdminClient()

  const trimmed = message.trim()
  if (!trimmed) throw new Error('Mensagem vazia')
  if (trimmed.length > 1000) throw new Error('Mensagem demasiado longa')

  await admin.from('challenge_messages').insert({
    challenge_id: challengeId,
    author_profile_id: profile.id,
    message: trimmed,
  })

  revalidatePath(`/challenges/${challengeId}`)
}

// ============================================================
// Propor horário (data/hora/campo livre)
// ============================================================

export async function proposeTime(
  challengeId: string,
  proposedDatetime: string,
  proposedCourt: string | null
) {
  const { supabase, profile } = await getSessionProfile()
  const admin = createAdminClient()

  const { data: myTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('captain_profile_id', profile.id)
    .maybeSingle()

  if (!myTeam && profile.role !== 'admin') throw new Error('Sem permissão')

  // Expira propostas pendentes anteriores
  await admin
    .from('challenge_proposals')
    .update({ status: 'expired' })
    .eq('challenge_id', challengeId)
    .eq('status', 'pending')

  await admin.from('challenge_proposals').insert({
    challenge_id: challengeId,
    proposed_by_team_id: myTeam?.id ?? null,
    proposed_datetime: proposedDatetime,
    proposed_court: proposedCourt ?? null,
    status: 'pending',
  })

  await admin
    .from('challenges')
    .update({ status: 'negotiating' })
    .eq('id', challengeId)

  revalidatePath(`/challenges/${challengeId}`)
}

// ============================================================
// Aceitar proposta de horário (pela outra dupla — aguarda admin)
// ============================================================

export async function acceptProposal(proposalId: string) {
  const { supabase, profile } = await getSessionProfile()
  const admin = createAdminClient()

  const { data: proposal } = await supabase
    .from('challenge_proposals')
    .select('*')
    .eq('id', proposalId)
    .single()

  if (!proposal) throw new Error('Proposta não encontrada')

  // Marca como acordada pelas duas duplas — aguarda confirmação do admin
  await admin
    .from('challenge_proposals')
    .update({ status: 'team_accepted' })
    .eq('id', proposalId)

  revalidatePath(`/challenges/${proposal.challenge_id}`)
}

// ============================================================
// Confirmar horário (admin — último passo)
// ============================================================

export async function confirmProposal(proposalId: string) {
  const { profile } = await getSessionProfile()
  if (profile.role !== 'admin') throw new Error('Sem permissão')
  const admin = createAdminClient()

  const { data: proposal } = await admin
    .from('challenge_proposals')
    .select('*')
    .eq('id', proposalId)
    .single()

  if (!proposal) throw new Error('Proposta não encontrada')
  if (!['pending', 'team_accepted'].includes(proposal.status)) {
    throw new Error('Esta proposta já foi processada')
  }

  await admin
    .from('challenge_proposals')
    .update({ status: 'accepted' })
    .eq('id', proposalId)

  await admin
    .from('challenges')
    .update({ status: 'scheduled' })
    .eq('id', proposal.challenge_id)

  await admin.from('audit_logs').insert({
    actor_profile_id: profile.id,
    action: 'proposal.confirmed',
    entity_type: 'challenge_proposals',
    entity_id: proposalId,
    metadata: { challenge_id: proposal.challenge_id },
  })

  revalidatePath(`/challenges/${proposal.challenge_id}`)
}
