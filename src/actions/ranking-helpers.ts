'use server'

import type { RankingUpdate } from '@/lib/domain/ranking'

export async function applyRankingUpdatesToDB(
  admin: any,
  updates: RankingUpdate[],
  categoryId: string,
  challengerTeamId: string,
  meta: { tournament_id: string; challenge_id: string; created_by: string; reason: string }
) {
  const challengerUpdate = updates.find((u) => u.teamId === challengerTeamId)!
  const shiftUpdates = updates
    .filter((u) => u.teamId !== challengerTeamId)
    .sort((a, b) => b.newPosition - a.newPosition)

  await admin.from('rankings').update({ position: 99999 }).eq('team_id', challengerTeamId).eq('category_id', categoryId)

  for (const u of shiftUpdates) {
    await admin.from('rankings').update({ position: u.newPosition }).eq('team_id', u.teamId).eq('category_id', categoryId)
  }

  await admin.from('rankings').update({ position: challengerUpdate.newPosition }).eq('team_id', challengerTeamId).eq('category_id', categoryId)

  for (const u of updates) {
    await admin.from('ranking_events').insert({
      tournament_id: meta.tournament_id,
      category_id: categoryId,
      challenge_id: meta.challenge_id,
      team_id: u.teamId,
      old_position: u.oldPosition,
      new_position: u.newPosition,
      reason: meta.reason,
      created_by: meta.created_by,
    })
  }
}
