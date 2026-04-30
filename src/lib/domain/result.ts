import type { MatchSet } from '@/types/database'

// ============================================================
// Regras de resultado — Regulamento art. 6.2
// "Melhor de 3 sets, 3.º set completo em caso de 1-1"
// ============================================================

export interface SetScore {
  challenger: number
  challenged: number
}

export interface ParsedResult {
  valid: boolean
  error?: string
  challengerSetsWon: number
  challengedSetsWon: number
  winner: 'challenger' | 'challenged' | null
}

// Parciais válidos de set normal (sets 1 e 2)
const VALID_NORMAL_SETS: [number, number][] = [
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4],
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6],
  [7, 5], [5, 7],
  [7, 6], [6, 7],
]

/**
 * Valida um set normal (sets 1 e 2).
 * Scores válidos: 6-0 a 6-4, 7-5, 7-6 (e inversos).
 */
export function isNormalSetValid(challenger: number, challenged: number): boolean {
  return VALID_NORMAL_SETS.some(
    ([a, b]) => a === challenger && b === challenged
  )
}

/**
 * Valida o super tie-break (set 3).
 * Joga-se a 10 pontos com diferença mínima de 2.
 * Quem chega a 10 com diferença >= 2 vence.
 */
export function isSuperTieBreakValid(challenger: number, challenged: number): boolean {
  if (challenger < 0 || challenged < 0) return false
  const winner = Math.max(challenger, challenged)
  const loser = Math.min(challenger, challenged)

  // Vencedor tem de ter pelo menos 10 pontos com diferença >= 2
  return winner >= 10 && winner - loser >= 2
}

/**
 * Valida e interpreta o resultado completo de um jogo.
 * Sets 1 e 2 são obrigatórios. Set 3 (super tie-break) só se 1-1.
 */
export function parseMatchResult(sets: SetScore[]): ParsedResult {
  if (sets.length < 2) {
    return { valid: false, error: 'São necessários pelo menos 2 sets.', challengerSetsWon: 0, challengedSetsWon: 0, winner: null }
  }
  if (sets.length > 3) {
    return { valid: false, error: 'Máximo 3 sets.', challengerSetsWon: 0, challengedSetsWon: 0, winner: null }
  }

  // Valida sets 1 e 2
  for (let i = 0; i < 2; i++) {
    const s = sets[i]
    if (!isNormalSetValid(s.challenger, s.challenged)) {
      return {
        valid: false,
        error: `Set ${i + 1} inválido (${s.challenger}-${s.challenged}). Sets válidos: 6-0 a 6-4, 7-5, 7-6.`,
        challengerSetsWon: 0,
        challengedSetsWon: 0,
        winner: null,
      }
    }
  }

  let challengerSets = 0
  let challengedSets = 0

  for (let i = 0; i < 2; i++) {
    const s = sets[i]
    if (s.challenger > s.challenged) challengerSets++
    else challengedSets++
  }

  // Se 1-1 em sets, precisa do 3.º set completo
  if (challengerSets === 1 && challengedSets === 1) {
    if (sets.length !== 3) {
      return {
        valid: false,
        error: 'Resultado 1-1 em sets requer o 3.º set.',
        challengerSetsWon: 1,
        challengedSetsWon: 1,
        winner: null,
      }
    }

    const s3 = sets[2]
    if (!isNormalSetValid(s3.challenger, s3.challenged)) {
      return {
        valid: false,
        error: `3.º set inválido (${s3.challenger}-${s3.challenged}). Sets válidos: 6-0 a 6-4, 7-5, 7-6.`,
        challengerSetsWon: 1,
        challengedSetsWon: 1,
        winner: null,
      }
    }

    const winner = s3.challenger > s3.challenged ? 'challenger' : 'challenged'
    return { valid: true, challengerSetsWon: 2, challengedSetsWon: 1, winner }
  }

  // Se sets.length === 3 mas não foi 1-1, o 3.º set é inválido
  if (sets.length === 3) {
    return {
      valid: false,
      error: 'O 3.º set só é válido se o resultado for 1-1 nos primeiros dois sets.',
      challengerSetsWon: challengerSets,
      challengedSetsWon: challengedSets,
      winner: null,
    }
  }

  const winner = challengerSets > challengedSets ? 'challenger' : 'challenged'
  return {
    valid: true,
    challengerSetsWon: challengerSets,
    challengedSetsWon: challengedSets,
    winner,
  }
}

/**
 * Formata o resultado para exibição: ex. "6-2, 3-6, 10-7"
 */
export function formatScore(sets: Pick<MatchSet, 'set_number' | 'challenger_games' | 'challenged_games'>[]): string {
  return [...sets]
    .sort((a, b) => a.set_number - b.set_number)
    .map((s) => `${s.challenger_games}-${s.challenged_games}`)
    .join(', ')
}
