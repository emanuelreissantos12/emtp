import { describe, it, expect } from 'vitest'
import {
  isNormalSetValid,
  isSuperTieBreakValid,
  parseMatchResult,
  formatScore,
} from '../result'

describe('isNormalSetValid', () => {
  it('aceita 6-0 a 6-4', () => {
    expect(isNormalSetValid(6, 0)).toBe(true)
    expect(isNormalSetValid(6, 4)).toBe(true)
    expect(isNormalSetValid(0, 6)).toBe(true)
    expect(isNormalSetValid(4, 6)).toBe(true)
  })

  it('aceita 7-5 e 7-6', () => {
    expect(isNormalSetValid(7, 5)).toBe(true)
    expect(isNormalSetValid(5, 7)).toBe(true)
    expect(isNormalSetValid(7, 6)).toBe(true)
    expect(isNormalSetValid(6, 7)).toBe(true)
  })

  it('rejeita 6-5 (parcial inválido)', () => {
    expect(isNormalSetValid(6, 5)).toBe(false)
  })

  it('rejeita 7-4', () => {
    expect(isNormalSetValid(7, 4)).toBe(false)
  })

  it('rejeita empate 6-6', () => {
    expect(isNormalSetValid(6, 6)).toBe(false)
  })

  it('rejeita 5-5', () => {
    expect(isNormalSetValid(5, 5)).toBe(false)
  })

  it('rejeita negativos', () => {
    expect(isNormalSetValid(-1, 6)).toBe(false)
  })
})

describe('isSuperTieBreakValid', () => {
  it('aceita 10-0 a 10-8', () => {
    expect(isSuperTieBreakValid(10, 0)).toBe(true)
    expect(isSuperTieBreakValid(10, 8)).toBe(true)
    expect(isSuperTieBreakValid(0, 10)).toBe(true)
  })

  it('aceita valores acima de 10 com diferença >= 2', () => {
    expect(isSuperTieBreakValid(12, 10)).toBe(true)
    expect(isSuperTieBreakValid(15, 13)).toBe(true)
  })

  it('rejeita 10-9 (diferença de 1)', () => {
    expect(isSuperTieBreakValid(10, 9)).toBe(false)
    expect(isSuperTieBreakValid(9, 10)).toBe(false)
  })

  it('rejeita valores abaixo de 10', () => {
    expect(isSuperTieBreakValid(9, 7)).toBe(false)
  })

  it('rejeita negativos', () => {
    expect(isSuperTieBreakValid(-1, 10)).toBe(false)
  })
})

describe('parseMatchResult', () => {
  it('resultado 2-0: desafiante vence', () => {
    const result = parseMatchResult([
      { challenger: 6, challenged: 2 },
      { challenger: 6, challenged: 4 },
    ])
    expect(result.valid).toBe(true)
    expect(result.winner).toBe('challenger')
    expect(result.challengerSetsWon).toBe(2)
    expect(result.challengedSetsWon).toBe(0)
  })

  it('resultado 0-2: desafiado vence', () => {
    const result = parseMatchResult([
      { challenger: 2, challenged: 6 },
      { challenger: 3, challenged: 6 },
    ])
    expect(result.valid).toBe(true)
    expect(result.winner).toBe('challenged')
  })

  it('1-1 + super tie-break: desafiante vence', () => {
    const result = parseMatchResult([
      { challenger: 6, challenged: 2 },
      { challenger: 3, challenged: 6 },
      { challenger: 10, challenged: 7 },
    ])
    expect(result.valid).toBe(true)
    expect(result.winner).toBe('challenger')
  })

  it('1-1 + super tie-break: desafiado vence', () => {
    const result = parseMatchResult([
      { challenger: 6, challenged: 2 },
      { challenger: 3, challenged: 6 },
      { challenger: 5, challenged: 10 },
    ])
    expect(result.valid).toBe(true)
    expect(result.winner).toBe('challenged')
  })

  it('rejeita 1-1 sem super tie-break', () => {
    const result = parseMatchResult([
      { challenger: 6, challenged: 2 },
      { challenger: 3, challenged: 6 },
    ])
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/super tie-break/)
  })

  it('rejeita 3.º set quando não é 1-1', () => {
    const result = parseMatchResult([
      { challenger: 6, challenged: 2 },
      { challenger: 6, challenged: 4 },
      { challenger: 10, challenged: 7 },
    ])
    expect(result.valid).toBe(false)
  })

  it('rejeita menos de 2 sets', () => {
    const result = parseMatchResult([{ challenger: 6, challenged: 2 }])
    expect(result.valid).toBe(false)
  })

  it('rejeita set inválido', () => {
    const result = parseMatchResult([
      { challenger: 6, challenged: 5 },
      { challenger: 6, challenged: 2 },
    ])
    expect(result.valid).toBe(false)
  })

  it('rejeita super tie-break com diferença de 1', () => {
    const result = parseMatchResult([
      { challenger: 6, challenged: 2 },
      { challenger: 3, challenged: 6 },
      { challenger: 10, challenged: 9 },
    ])
    expect(result.valid).toBe(false)
  })
})

describe('formatScore', () => {
  it('formata dois sets', () => {
    const sets = [
      { set_number: 1, challenger_games: 6, challenged_games: 2 },
      { set_number: 2, challenger_games: 6, challenged_games: 4 },
    ]
    expect(formatScore(sets)).toBe('6-2, 6-4')
  })

  it('formata três sets (super tie-break)', () => {
    const sets = [
      { set_number: 1, challenger_games: 6, challenged_games: 2 },
      { set_number: 2, challenger_games: 3, challenged_games: 6 },
      { set_number: 3, challenger_games: 10, challenged_games: 7 },
    ]
    expect(formatScore(sets)).toBe('6-2, 3-6, 10-7')
  })

  it('ordena os sets mesmo que venham fora de ordem', () => {
    const sets = [
      { set_number: 2, challenger_games: 6, challenged_games: 4 },
      { set_number: 1, challenger_games: 6, challenged_games: 2 },
    ]
    expect(formatScore(sets)).toBe('6-2, 6-4')
  })
})
