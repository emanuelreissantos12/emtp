import { createAdminClient, createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Trophy, Swords, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatScore } from '@/lib/domain/result'

export default async function TeamHistoryPage({
  params,
}: {
  params: Promise<{ teamId: string }>
}) {
  const { teamId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: team } = await admin
    .from('teams')
    .select('*, category:categories(code, name), ranking:rankings(position)')
    .eq('id', teamId)
    .single()

  if (!team) notFound()

  // Todos os desafios desta equipa (completados)
  const { data: challenges } = await admin
    .from('challenges')
    .select(`
      id, status, created_at, challenger_team_id, challenged_team_id,
      challenger_team:teams!challenges_challenger_team_id_fkey(id, name),
      challenged_team:teams!challenges_challenged_team_id_fkey(id, name),
      result:match_results(winner_team_id, sets:match_sets(*))
    `)
    .or(`challenger_team_id.eq.${teamId},challenged_team_id.eq.${teamId}`)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const ranking = Array.isArray(team.ranking) ? team.ranking[0] : team.ranking
  const category = Array.isArray(team.category) ? team.category[0] : team.category

  const wins = (challenges ?? []).filter((c: any) => {
    const result = Array.isArray(c.result) ? c.result[0] : c.result
    return result?.winner_team_id === teamId
  }).length
  const losses = (challenges?.length ?? 0) - wins

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground mb-1">{category?.code} — {category?.name}</p>
        <h1 className="text-2xl font-bold">{team.name}</h1>
        <p className="text-sm text-muted-foreground">{team.player1_name}{team.player2_name ? ` · ${team.player2_name}` : ''}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-black">{ranking?.position ?? '—'}.º</p>
            <p className="text-xs text-muted-foreground mt-0.5">Posição</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-black text-green-600">{wins}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Vitórias</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-black text-red-500">{losses}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Derrotas</p>
          </CardContent>
        </Card>
      </div>

      {/* Histórico */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Swords className="size-4" />
          Histórico de jogos
        </h2>

        {(challenges?.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="pt-6 pb-6 text-center text-muted-foreground text-sm">
              Sem jogos registados.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {challenges!.map((c: any) => {
              const result = Array.isArray(c.result) ? c.result[0] : c.result
              const sets = result?.sets ?? []
              const won = result?.winner_team_id === teamId
              const isChallenger = c.challenger_team_id === teamId
              const opponent = isChallenger ? c.challenged_team : c.challenger_team
              const opponentObj = Array.isArray(opponent) ? opponent[0] : opponent

              return (
                <Card key={c.id} className={won ? 'border-green-300' : 'border-red-200'}>
                  <CardContent className="pt-3 pb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {won
                        ? <TrendingUp className="size-4 text-green-500 shrink-0" />
                        : <TrendingDown className="size-4 text-red-400 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {isChallenger ? 'vs ' : 'de '}{opponentObj?.name ?? '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(c.created_at), 'dd MMM yyyy', { locale: ptBR })}
                          {sets.length > 0 && ` · ${formatScore(sets)}`}
                        </p>
                      </div>
                    </div>
                    <Badge className={won
                      ? 'bg-green-100 text-green-800 border-0'
                      : 'bg-red-100 text-red-700 border-0'}>
                      {won ? 'Vitória' : 'Derrota'}
                    </Badge>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
