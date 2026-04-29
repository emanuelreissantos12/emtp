import { describe, it, expect } from 'vitest'
import {
  applyRankingUpdate,
  getFinalParticipants,
  getFinalMatchups,
  validateRankingIntegrity,
} from '../ranking'
import type { Ranking } from '@/types/database'

function makeRanking(teamId: string, position: number): Ranking {
  return {
    id: `r-${teamId}`,
    tournament_id: 'tournament-1',
    category_id: 'cat-1',
    team_id: teamId,
    position,
    updated_at: new Date().toISOString(),
  }
}

describe('applyRankingUpdate', () => {
  const rankings = [
    makeRanking('A', 1),
    makeRanking('B', 2),
    makeRanking('C', 3),
    makeRanking('D', 4),
    makeRanking('E', 5),
  ]

  it('desafiante (pos 3) vence desafiado (pos 1): sobe para 1, A desce para 2, B desce para 3', () => {
    const updates = applyRankingUpdate(rankings, 'C', 'A')
    const map = Object.fromEntries(updates.map((u) => [u.teamId, u.newPosition]))
    expect(map['C']).toBe(1) // desafiante sobe
    expect(map['A']).toBe(2) // desafiado desce
    expect(map['B']).toBe(3) // intermediário desce
    expect(map['D']).toBeUndefined() // não afetado
  })

  it('desafiante (pos 2) vence desafiado (pos 1): troca simples', () => {
    const updates = applyRankingUpdate(rankings, 'B', 'A')
    const map = Object.fromEntries(updates.map((u) => [u.teamId, u.newPosition]))
    expect(map['B']).toBe(1)
    expect(map['A']).toBe(2)
    expect(map['C']).toBeUndefined()
  })

  it('sem mudanças se desafiante já está acima do desafiado', () => {
    const updates = applyRankingUpdate(rankings, 'A', 'C')
    expect(updates).toHaveLength(0)
  })

  it('equipa não encontrada retorna vazio', () => {
    const updates = applyRankingUpdate(rankings, 'Z', 'A')
    expect(updates).toHaveLength(0)
  })
})

describe('validateRankingIntegrity', () => {
  it('rankings contíguos 1-5 são válidos', () => {
    const r = [1, 2, 3, 4, 5].map((p) => makeRanking(`t${p}`, p))
    expect(validateRankingIntegrity(r)).toBe(true)
  })

  it('rankings com gap são inválidos', () => {
    const r = [1, 2, 4, 5].map((p) => makeRanking(`t${p}`, p))
    expect(validateRankingIntegrity(r)).toBe(false)
  })

  it('rankings que não começam em 1 são inválidos', () => {
    const r = [2, 3, 4].map((p) => makeRanking(`t${p}`, p))
    expect(validateRankingIntegrity(r)).toBe(false)
  })
})

describe('getFinalParticipants', () => {
  it('retorna top 4 ordenados', () => {
    const r = [3, 1, 4, 2, 5].map((p) => makeRanking(`t${p}`, p))
    const top4 = getFinalParticipants(r)
    expect(top4.map((x) => x.position)).toEqual([1, 2, 3, 4])
  })

  it('com menos de 4 equipes retorna todas', () => {
    const r = [1, 2].map((p) => makeRanking(`t${p}`, p))
    expect(getFinalParticipants(r)).toHaveLength(2)
  })
})

describe('getFinalMatchups', () => {
  it('emparelha 1 vs 4 e 2 vs 3', () => {
    const r = [1, 2, 3, 4, 5].map((p) => makeRanking(`t${p}`, p))
    const matchups = getFinalMatchups(r)
    expect(matchups).toHaveLength(2)
    expect(matchups[0][0].position).toBe(1)
    expect(matchups[0][1].position).toBe(4)
    expect(matchups[1][0].position).toBe(2)
    expect(matchups[1][1].position).toBe(3)
  })

  it('sem top 4 retorna vazio', () => {
    const r = [1, 2, 3].map((p) => makeRanking(`t${p}`, p))
    expect(getFinalMatchups(r)).toHaveLength(0)
  })
})
