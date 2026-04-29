import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LinkButton } from '@/components/ui/link-button'
import { getEligibleTargets, getChallengeLockReason } from '@/lib/domain/challenge'
import { cn } from '@/lib/utils'
import { Trophy, Swords, Shield, TrendingUp, TrendingDown } from 'lucide-react'
import type { RankingRow } from '@/types/database'

export default async function RankingPage() {
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

  // Torneio ativo
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .in('status', ['active', 'frozen'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!tournament) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Nenhum torneio ativo de momento.</p>
      </div>
    )
  }

  // Categorias
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('sort_order')

  // Todos os rankings com equipas
  const { data: allRankings } = await supabase
    .from('rankings')
    .select('*, team:teams(*)')
    .eq('tournament_id', tournament.id)
    .order('position')

  // Eventos de ranking recentes (últimas 48h) para mostrar setas
  const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data: recentEvents } = await supabase
    .from('ranking_events')
    .select('team_id, old_position, new_position')
    .eq('tournament_id', tournament.id)
    .gte('created_at', since48h)
    .order('created_at', { ascending: false })

  // Último evento por equipa
  const latestEventByTeam: Record<string, { old: number; new: number }> = {}
  for (const ev of recentEvents ?? []) {
    if (!latestEventByTeam[ev.team_id]) {
      latestEventByTeam[ev.team_id] = { old: ev.old_position, new: ev.new_position }
    }
  }

  // Equipa do utilizador
  const { data: myTeam } = await supabase
    .from('teams')
    .select('*')
    .eq('captain_profile_id', profile.id)
    .eq('tournament_id', tournament.id)
    .maybeSingle()

  // Desafios ativos da minha equipa
  const { data: myActiveChallenges } = myTeam
    ? await supabase
        .from('challenges')
        .select('*')
        .or(`challenger_team_id.eq.${myTeam.id},challenged_team_id.eq.${myTeam.id}`)
        .not('status', 'in', '("completed","cancelled","expired")')
    : { data: [] }

  // Último adversário (para regra de repetição)
  const { data: lastCompletedChallenge } = myTeam
    ? await supabase
        .from('challenges')
        .select('*, result:match_results!inner(*)')
        .or(`challenger_team_id.eq.${myTeam.id},challenged_team_id.eq.${myTeam.id}`)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const lastOpponentId = lastCompletedChallenge
    ? lastCompletedChallenge.challenger_team_id === myTeam?.id
      ? lastCompletedChallenge.challenged_team_id
      : lastCompletedChallenge.challenger_team_id
    : null

  // Verificação simplificada: se perdeu o último jogo, precisa de jogar com outra dupla
  const iLostLast =
    lastCompletedChallenge?.result?.winner_team_id !== myTeam?.id

  function getRankingsForCategory(categoryId: string): RankingRow[] {
    return (allRankings ?? []).filter((r) => r.category_id === categoryId) as RankingRow[]
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="size-6 text-yellow-500" />
          Ranking
        </h1>
        <p className="text-muted-foreground text-sm">{tournament.name} {tournament.season}</p>
      </div>

      <Tabs defaultValue={categories?.[0]?.id ?? ''}>
        <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
          {(categories ?? []).map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id} className="shrink-0">
              {cat.code}
            </TabsTrigger>
          ))}
        </TabsList>

        {(categories ?? []).map((cat) => {
          const catRankings = getRankingsForCategory(cat.id)
          const myRankingHere = catRankings.find((r) => r.team_id === myTeam?.id)
          const eligibleTargets = myTeam
            ? getEligibleTargets(myTeam.id, catRankings)
            : []

          return (
            <TabsContent key={cat.id} value={cat.id} className="mt-4">
              <div className="space-y-2">
                {catRankings.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    Sem equipas nesta categoria.
                  </p>
                )}

                {catRankings.map((entry) => {
                  const isMyTeam = entry.team_id === myTeam?.id
                  const isEligible = eligibleTargets.some(
                    (t) => t.team_id === entry.team_id
                  )

                  let lockReason: string | null = null
                  if (isEligible && myTeam) {
                    lockReason = getChallengeLockReason(
                      myTeam,
                      myActiveChallenges ?? [],
                      lastOpponentId,
                      entry.team_id,
                      !iLostLast
                    )
                  }

                  const canChallenge = isEligible && !lockReason && !isMyTeam
                  const isTop4 = entry.position <= 4
                  const recentMove = latestEventByTeam[entry.team_id]
                  const movedUp = recentMove && recentMove.new < recentMove.old
                  const movedDown = recentMove && recentMove.new > recentMove.old

                  return (
                    <Card
                      key={entry.id}
                      className={cn(
                        'transition-colors',
                        isMyTeam && 'border-primary bg-primary/5',
                        isEligible && !isMyTeam && 'border-orange-300'
                      )}
                    >
                      <CardContent className="pt-3 pb-3 flex items-center gap-3">
                        {/* Posição + seta */}
                        <div className="flex flex-col items-center w-8 shrink-0">
                          <span
                            className={cn(
                              'text-lg font-black leading-none',
                              entry.position <= 3 ? 'text-yellow-600' : 'text-muted-foreground'
                            )}
                          >
                            {entry.position}
                          </span>
                          {movedUp && (
                            <TrendingUp className="size-3 text-green-500 mt-0.5" />
                          )}
                          {movedDown && (
                            <TrendingDown className="size-3 text-red-500 mt-0.5" />
                          )}
                        </div>

                        {/* Info equipa */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'font-semibold text-sm truncate',
                                isMyTeam && 'text-primary'
                              )}
                            >
                              {entry.team?.name}
                            </span>
                            {isMyTeam && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                                Tu
                              </Badge>
                            )}
                            {isTop4 && !isMyTeam && (
                              <Trophy className="size-3 text-yellow-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {entry.team?.player1_name} / {entry.team?.player2_name}
                          </p>
                        </div>

                        {/* Estado / ação */}
                        {entry.team?.status === 'suspended' && (
                          <Badge variant="destructive" className="text-xs shrink-0">
                            Suspensa
                          </Badge>
                        )}

                        {canChallenge && (
                          <LinkButton
                            href={`/challenges/new?target=${entry.team_id}`}
                            size="sm"
                            className="shrink-0"
                          >
                            <Swords className="size-3.5 mr-1" />
                            Desafiar
                          </LinkButton>
                        )}

                        {isEligible && lockReason && !isMyTeam && (
                          <div title={lockReason}>
                            <Shield className="size-4 text-muted-foreground shrink-0" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
