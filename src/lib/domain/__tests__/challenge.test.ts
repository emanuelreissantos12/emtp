import { describe, it, expect } from 'vitest'
import {
  getEligibleTargets,
  getChallengeLockReason,
  isChallengeExpired,
  daysUntilDeadline,
} from '../challenge'
import type { RankingRow, Team, Challenge } from '@/types/database'

function makeRankingRow(teamId: string, position: number): RankingRow {
  return {
    id: `r-${teamId}`,
    tournament_id: 't1',
    category_id: 'cat1',
    team_id: teamId,
    position,
    updated_at: new Date().toISOString(),
    team: {
      id: teamId,
      tournament_id: 't1',
      category_id: 'cat1',
      name: `Equipa ${teamId}`,
      captain_profile_id: `cap-${teamId}`,
      player1_name: 'P1',
      player1_email: 'p1@test.com',
      player1_phone: null,
      player1_nif: null,
      player1_dob: null,
      player1_address: null,
      player2_name: 'P2',
      player2_email: 'p2@test.com',
      player2_phone: null,
      player2_nif: null,
      player2_dob: null,
      player2_address: null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }
}

function makeTeam(id: string, status: Team['status'] = 'active'): Team {
  return {
    id,
    tournament_id: 't1',
    category_id: 'cat1',
    name: `Equipa ${id}`,
    captain_profile_id: `cap-${id}`,
    player1_name: 'P1',
    player1_email: 'p1@test.com',
    player1_phone: null,
    player1_nif: null,
    player1_dob: null,
    player1_address: null,
    player2_name: 'P2',
    player2_email: 'p2@test.com',
    player2_phone: null,
    player2_nif: null,
    player2_dob: null,
    player2_address: null,
    status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function makeChallenge(
  challengerTeamId: string,
  challengedTeamId: string,
  status: Challenge['status'] = 'negotiating'
): Challenge {
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + 8)
  return {
    id: `ch-${challengerTeamId}-${challengedTeamId}`,
    tournament_id: 't1',
    category_id: 'cat1',
    challenger_team_id: challengerTeamId,
    challenged_team_id: challengedTeamId,
    status,
    created_by: `cap-${challengerTeamId}`,
    created_at: new Date().toISOString(),
    deadline_at: deadline.toISOString(),
    selected_slot_id: null,
  }
}

describe('getEligibleTargets', () => {
  const rankings = [
    makeRankingRow('A', 1),
    makeRankingRow('B', 2),
    makeRankingRow('C', 3),
    makeRankingRow('D', 4),
    makeRankingRow('E', 5),
  ]

  it('equipa na pos 3 pode desafiar pos 1 e 2', () => {
    const targets = getEligibleTargets('C', rankings)
    const positions = targets.map((t) => t.position).sort()
    expect(positions).toEqual([1, 2])
  })

  it('equipa na pos 2 pode desafiar só pos 1', () => {
    const targets = getEligibleTargets('B', rankings)
    expect(targets).toHaveLength(1)
    expect(targets[0].position).toBe(1)
  })

  it('equipa no topo (pos 1) não pode desafiar ninguém', () => {
    const targets = getEligibleTargets('A', rankings)
    expect(targets).toHaveLength(0)
  })

  it('equipa na pos 4 pode desafiar pos 2 e 3', () => {
    const targets = getEligibleTargets('D', rankings)
    const positions = targets.map((t) => t.position).sort()
    expect(positions).toEqual([2, 3])
  })
})

describe('getChallengeLockReason', () => {
  const team = makeTeam('C')

  it('equipa suspensa não pode desafiar', () => {
    const suspended = makeTeam('C', 'suspended')
    const reason = getChallengeLockReason(suspended, [], null, 'A', true)
    expect(reason).toMatch(/suspensa/)
  })

  it('equipa retirada não pode desafiar', () => {
    const withdrawn = makeTeam('C', 'withdrawn')
    const reason = getChallengeLockReason(withdrawn, [], null, 'A', true)
    expect(reason).toMatch(/retirou/)
  })

  it('bloqueia se já tem desafio lançado ativo', () => {
    const active = [makeChallenge('C', 'A', 'negotiating')]
    const reason = getChallengeLockReason(team, active, null, 'B', true)
    expect(reason).toMatch(/lançado/)
  })

  it('bloqueia se o último adversário foi o mesmo e perdeu', () => {
    const reason = getChallengeLockReason(team, [], 'B', 'B', false)
    expect(reason).toMatch(/outra dupla/)
  })

  it('permite desafiar se não há bloqueios', () => {
    const reason = getChallengeLockReason(team, [], null, 'A', true)
    expect(reason).toBeNull()
  })

  it('permite rever o mesmo adversário se não foi o último (ou ganhou)', () => {
    const reason = getChallengeLockReason(team, [], 'B', 'B', true)
    expect(reason).toBeNull()
  })
})

describe('isChallengeExpired', () => {
  it('desafio dentro do prazo não está expirado', () => {
    const ch = makeChallenge('A', 'B', 'negotiating')
    expect(isChallengeExpired(ch)).toBe(false)
  })

  it('desafio com prazo no passado está expirado', () => {
    const past = new Date()
    past.setDate(past.getDate() - 1)
    const ch = { ...makeChallenge('A', 'B', 'negotiating'), deadline_at: past.toISOString() }
    expect(isChallengeExpired(ch)).toBe(true)
  })

  it('desafio completed não é "expirado" mesmo com prazo passado', () => {
    const past = new Date()
    past.setDate(past.getDate() - 1)
    const ch = { ...makeChallenge('A', 'B', 'completed'), deadline_at: past.toISOString() }
    expect(isChallengeExpired(ch)).toBe(false)
  })
})

describe('daysUntilDeadline', () => {
  it('retorna dias positivos para prazo no futuro', () => {
    const future = new Date()
    future.setDate(future.getDate() + 5)
    const ch = { ...makeChallenge('A', 'B'), deadline_at: future.toISOString() }
    expect(daysUntilDeadline(ch)).toBe(5)
  })

  it('retorna 0 ou negativo para prazo passado', () => {
    const past = new Date()
    past.setDate(past.getDate() - 2)
    const ch = { ...makeChallenge('A', 'B'), deadline_at: past.toISOString() }
    expect(daysUntilDeadline(ch)).toBeLessThanOrEqual(0)
  })
})
