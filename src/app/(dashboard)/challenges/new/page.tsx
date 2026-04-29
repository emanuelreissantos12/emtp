import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NewChallengeForm } from '@/components/challenges/new-challenge-form'
import { getEligibleTargets, getChallengeLockReason } from '@/lib/domain/challenge'
import { Swords } from 'lucide-react'
import type { RankingRow } from '@/types/database'

export default async function NewChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string }>
}) {
  const { target: prefillTargetId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()
  if (!profile) redirect('/login')
  if (profile.role === 'admin') redirect('/admin')

  const { data: myTeam } = await supabase
    .from('teams')
    .select('*, category_id, tournament_id')
    .eq('captain_profile_id', profile.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!myTeam) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Não tens uma dupla ativa neste torneio.</p>
      </div>
    )
  }

  const { data: rankings } = await supabase
    .from('rankings')
    .select('*')
    .eq('category_id', myTeam.category_id)
    .order('position')

  const eligibleRows = getEligibleTargets(myTeam.id, (rankings ?? []) as RankingRow[])
  const eligibleIds = eligibleRows.map((r) => r.team_id)

  const { data: activeChallenges } = await supabase
    .from('challenges')
    .select('*')
    .or(`challenger_team_id.eq.${myTeam.id},challenged_team_id.eq.${myTeam.id}`)
    .not('status', 'in', '("completed","cancelled","expired")')

  const { data: lastCompleted } = await supabase
    .from('challenges')
    .select('*, match_results(winner_team_id)')
    .or(`challenger_team_id.eq.${myTeam.id},challenged_team_id.eq.${myTeam.id}`)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(5)

  let lastOpponentId: string | null = null
  let hasPlayedOtherSinceLastLoss = true

  if (lastCompleted && lastCompleted.length > 0) {
    let foundLoss = false
    let gamesAfterLoss = 0
    for (const c of lastCompleted) {
      const result = Array.isArray(c.match_results) ? c.match_results[0] : c.match_results
      const wonThisGame = result?.winner_team_id === myTeam.id
      const opponentId = c.challenger_team_id === myTeam.id
        ? c.challenged_team_id
        : c.challenger_team_id
      if (!foundLoss && !wonThisGame) {
        lastOpponentId = opponentId
        foundLoss = true
        hasPlayedOtherSinceLastLoss = gamesAfterLoss > 0
      }
      if (foundLoss) break
      gamesAfterLoss++
    }
  }

  const { data: targetTeams } = await supabase
    .from('teams')
    .select('id, name')
    .in('id', eligibleIds.length > 0 ? eligibleIds : ['00000000-0000-0000-0000-000000000000'])

  const targets = (targetTeams ?? []).map((t) => {
    const r = (rankings ?? []).find((rr) => rr.team_id === t.id)
    const lockReason = getChallengeLockReason(
      myTeam,
      activeChallenges ?? [],
      lastOpponentId,
      t.id,
      hasPlayedOtherSinceLastLoss
    )
    return { id: t.id, name: t.name, position: r?.position ?? 0, lockReason }
  }).sort((a, b) => a.position - b.position)

  // Horários livres nas próximas 4 semanas
  const in4weeks = new Date()
  in4weeks.setDate(in4weeks.getDate() + 28)

  const { data: freeSlots } = await supabase
    .from('schedule_slots')
    .select('*, court:courts(name)')
    .eq('status', 'free')
    .gte('starts_at', new Date().toISOString())
    .lte('starts_at', in4weeks.toISOString())
    .order('starts_at')

  const slots = (freeSlots ?? []).map((s) => ({
    id: s.id,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    courtName: (Array.isArray(s.court) ? s.court[0] : s.court)?.name ?? 'Campo',
  }))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Swords className="size-6" />
        Novo Desafio
      </h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{myTeam.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <NewChallengeForm
            targets={targets}
            slots={slots}
            prefillTargetId={prefillTargetId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
