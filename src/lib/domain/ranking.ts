import type { Ranking } from '@/types/database'

// ============================================================
// Regras de ranking — Regulamento arts. 5.2
// ============================================================

export interface RankingUpdate {
  teamId: string
  oldPosition: number
  newPosition: number
}

/**
 * Calcula as alterações de ranking quando o desafiante vence.
 *
 * Regulamento art. 5.2:
 * - O desafiante sobe para a posição do desafiado.
 * - O desafiado (e duplas intermédias) descem uma posição.
 *
 * Se o desafiado vence → sem alterações.
 */
export function applyRankingUpdate(
  rankings: Ranking[],
  challengerTeamId: string,
  challengedTeamId: string
): RankingUpdate[] {
  const challengerEntry = rankings.find((r) => r.team_id === challengerTeamId)
  const challengedEntry = rankings.find((r) => r.team_id === challengedTeamId)

  if (!challengerEntry || !challengedEntry) return []

  const challengerPos = challengerEntry.position
  const challengedPos = challengedEntry.position

  // Desafiante tem de estar abaixo (posição maior = mais baixo na escada)
  if (challengerPos <= challengedPos) return []

  const updates: RankingUpdate[] = []

  // Duplas entre challengedPos e challengerPos-1 descem uma posição
  for (const r of rankings) {
    if (r.position >= challengedPos && r.position < challengerPos) {
      updates.push({
        teamId: r.team_id,
        oldPosition: r.position,
        newPosition: r.position + 1,
      })
    }
  }

  // Desafiante sobe para a posição do desafiado
  updates.push({
    teamId: challengerTeamId,
    oldPosition: challengerPos,
    newPosition: challengedPos,
  })

  return updates
}

/**
 * Valida que as posições de um conjunto de rankings são contíguas e sem duplicados.
 */
export function validateRankingIntegrity(rankings: Ranking[]): boolean {
  const positions = rankings.map((r) => r.position).sort((a, b) => a - b)
  for (let i = 0; i < positions.length; i++) {
    if (positions[i] !== i + 1) return false
  }
  return true
}

/**
 * Finalíssima: retorna os top 4 de uma categoria ordenados por posição.
 */
export function getFinalParticipants(rankings: Ranking[]): Ranking[] {
  return [...rankings]
    .sort((a, b) => a.position - b.position)
    .slice(0, 4)
}

/**
 * Emparelhamentos da finalíssima: 1 vs 4 e 2 vs 3.
 */
export function getFinalMatchups(
  rankings: Ranking[]
): [Ranking, Ranking][] {
  const top4 = getFinalParticipants(rankings)
  if (top4.length < 4) return []
  return [
    [top4[0], top4[3]], // 1 vs 4
    [top4[1], top4[2]], // 2 vs 3
  ]
}
