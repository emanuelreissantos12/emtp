import type { Challenge, Ranking, RankingRow, Team } from '@/types/database'

// ============================================================
// Regras de desafio — Regulamento arts. 5 e Guia Prático
// ============================================================

export interface EligibilityResult {
  eligible: boolean
  reason?: string
  targets: RankingRow[]
}

/**
 * Determina quais as duplas que a equipa pode desafiar.
 * Regulamento art. 5.1: apenas uma das duas duplas imediatamente acima.
 */
export function getEligibleTargets(
  teamId: string,
  rankings: RankingRow[]
): RankingRow[] {
  const sorted = [...rankings].sort((a, b) => a.position - b.position)
  const myEntry = sorted.find((r) => r.team_id === teamId)
  if (!myEntry) return []

  return sorted.filter(
    (r) =>
      r.position === myEntry.position - 1 ||
      r.position === myEntry.position - 2
  )
}

/**
 * Verifica se uma dupla pode lançar um desafio agora.
 * Devolve o motivo de bloqueio ou null se pode desafiar.
 */
export function getChallengeLockReason(
  team: Team,
  activeChallenges: Challenge[],
  lastOpponentId: string | null,
  targetTeamId: string,
  hasPlayedOtherSinceLastLoss: boolean
): string | null {
  if (team.status === 'suspended') {
    return 'A tua dupla está suspensa.'
  }

  if (team.status === 'withdrawn') {
    return 'A tua dupla retirou-se do torneio.'
  }

  // Máximo um desafio lançado ativo
  const launched = activeChallenges.filter(
    (c) =>
      c.challenger_team_id === team.id &&
      !['completed', 'cancelled', 'expired'].includes(c.status)
  )
  if (launched.length >= 1) {
    return 'Já tens um desafio lançado em curso.'
  }

  // Repetição do último adversário (apenas após derrota)
  // Guia Prático Q4: após perder, tem de jogar com outra dupla primeiro
  if (lastOpponentId === targetTeamId && !hasPlayedOtherSinceLastLoss) {
    return 'Tens de jogar com outra dupla antes de voltar a desafiar esta.'
  }

  return null
}

/**
 * Verifica se uma dupla pode recusar um desafio.
 * Guia Prático Q3: só com desafio já agendado ou lesão/força maior.
 */
export function canRefuseChallenge(
  team: Team,
  activeChallenges: Challenge[]
): boolean {
  const scheduled = activeChallenges.find(
    (c) =>
      (c.challenger_team_id === team.id ||
        c.challenged_team_id === team.id) &&
      c.status === 'scheduled'
  )
  return !!scheduled
}

/**
 * Verifica se um desafio está expirado (passou o prazo de 8 dias).
 */
export function isChallengeExpired(challenge: Challenge): boolean {
  return (
    !['completed', 'cancelled', 'expired'].includes(challenge.status) &&
    new Date(challenge.deadline_at) < new Date()
  )
}

/**
 * Dias restantes até ao prazo do desafio.
 */
export function daysUntilDeadline(challenge: Challenge): number {
  const diff =
    new Date(challenge.deadline_at).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
