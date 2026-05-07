import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LinkButton } from '@/components/ui/link-button'
import { getEligibleTargets, getChallengeLockReason } from '@/lib/domain/challenge'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Trophy, Swords, Shield, TrendingUp, TrendingDown } from 'lucide-react'
import type { RankingRow } from '@/types/database'

export default async function RankingPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

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
  const { data: recentEvents } = await admin
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

  // Desafios ativos do torneio (para mostrar por baixo do ranking)
  const { data: activeChallenges } = await admin
    .from('challenges')
    .select(`
      id, status, category_id,
      challenger_team:teams!challenges_challenger_team_id_fkey(id, name),
      challenged_team:teams!challenges_challenged_team_id_fkey(id, name)
    `)
    .eq('tournament_id', tournament.id)
    .not('status', 'in', '("completed","cancelled","expired")')
    .order('created_at', { ascending: false })

  // Desafios completados nas últimas 24h
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentCompleted } = await admin
    .from('challenges')
    .select(`
      id, status, category_id,
      challenger_team:teams!challenges_challenger_team_id_fkey(id, name),
      challenged_team:teams!challenges_challenged_team_id_fkey(id, name),
      result:match_results(winner_team_id, sets:match_sets(set_number, challenger_games, challenged_games))
    `)
    .eq('tournament_id', tournament.id)
    .eq('status', 'completed')
    .gte('updated_at', since24h)
    .order('updated_at', { ascending: false })

  function getRankingsForCategory(categoryId: string): RankingRow[] {
    return (allRankings ?? []).filter((r) => r.category_id === categoryId) as RankingRow[]
  }

  function getChallengesForCategory(categoryId: string) {
    return (activeChallenges ?? []).filter((c: any) => c.category_id === categoryId)
  }

  function getRecentCompletedForCategory(categoryId: string) {
    return (recentCompleted ?? []).filter((c: any) => c.category_id === categoryId)
  }

  // Equipas com desafio ativo (não podem ser desafiadas)
  const teamsWithActiveChallenge = new Set<string>(
    (activeChallenges ?? []).flatMap((c: any) => [
      c.challenger_team?.id,
      c.challenged_team?.id,
    ]).filter(Boolean)
  )

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
          const catChallenges = getChallengesForCategory(cat.id)
          const catCompleted = getRecentCompletedForCategory(cat.id)
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

                {catChallenges.length > 0 && (
                  <div className="pb-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Swords className="size-3.5" />
                      Desafios em curso
                    </p>
                    <div className="space-y-1.5">
                      {catChallenges.map((c: any) => {
                        const isNegotiating = ['pending', 'negotiating'].includes(c.status)
                        const isScheduled = c.status === 'scheduled'
                        const isResultPending = c.status === 'result_pending'
                        return (
                          <Link key={c.id} href={`/challenges/${c.id}`}>
                            <div className={cn(
                              'flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors hover:opacity-80',
                              isScheduled && 'border-green-400 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300',
                              isNegotiating && 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-300',
                              isResultPending && 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300',
                            )}>
                              <span className="font-medium">
                                {c.challenger_team?.name} <span className="opacity-60 font-normal">vs</span> {c.challenged_team?.name}
                              </span>
                              <span className="opacity-70 shrink-0 ml-2">
                                {isScheduled ? 'Jogo marcado' : isResultPending ? 'Resultado pendente' : 'A negociar'}
                              </span>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}

                {catCompleted.length > 0 && (
                  <div className="pb-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Trophy className="size-3.5" />
                      Resultados recentes
                    </p>
                    <div className="space-y-1.5">
                      {catCompleted.map((c: any) => {
                        const result = Array.isArray(c.result) ? c.result[0] : c.result
                        const sets = [...(result?.sets ?? [])].sort((a: any, b: any) => a.set_number - b.set_number)
                        const score = sets.map((s: any) => `${s.challenger_games}-${s.challenged_games}`).join(', ')
                        const winnerIsChallenger = result?.winner_team_id === c.challenger_team?.id
                        return (
                          <Link key={c.id} href={`/challenges/${c.id}`}>
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-muted bg-muted/30 text-xs hover:opacity-80 transition-colors">
                              <span>
                                <span className={cn('font-medium', winnerIsChallenger && 'text-green-700 dark:text-green-400')}>
                                  {c.challenger_team?.name}
                                </span>
                                <span className="text-muted-foreground mx-1.5">vs</span>
                                <span className={cn('font-medium', !winnerIsChallenger && 'text-green-700 dark:text-green-400')}>
                                  {c.challenged_team?.name}
                                </span>
                              </span>
                              <span className="text-muted-foreground shrink-0 ml-2 font-mono">{score}</span>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
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
                    // Bloqueia se a dupla alvo já tem desafio ativo
                    if (!lockReason && teamsWithActiveChallenge.has(entry.team_id)) {
                      lockReason = 'Esta dupla já tem um desafio em aberto.'
                    }
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
                        <div className="flex flex-col items-center w-10 shrink-0">
                          <span
                            className={cn(
                              'text-lg font-black leading-none',
                              entry.position <= 3 ? 'text-yellow-600' : 'text-muted-foreground'
                            )}
                          >
                            {entry.position}
                          </span>
                          {movedUp && (
                            <div className="flex items-center gap-0.5 mt-0.5">
                              <TrendingUp className="size-4 text-green-500" />
                              <span className="text-[10px] font-semibold text-green-500">+{recentMove.old - recentMove.new}</span>
                            </div>
                          )}
                          {movedDown && (
                            <div className="flex items-center gap-0.5 mt-0.5">
                              <TrendingDown className="size-4 text-red-500" />
                              <span className="text-[10px] font-semibold text-red-500">-{recentMove.new - recentMove.old}</span>
                            </div>
                          )}
                        </div>

                        {/* Info equipa */}
                        <Link
                          href={`/ranking/equipa/${entry.team_id}`}
                          className="flex-1 min-w-0 hover:opacity-75 transition-opacity"
                        >
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
                        </Link>

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
