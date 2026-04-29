import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RegisterMatchForm } from '@/components/admin/register-match-form'
import { Card, CardContent } from '@/components/ui/card'
import { formatScore } from '@/lib/domain/result'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ClipboardList, TrendingUp, TrendingDown } from 'lucide-react'

export default async function AdminResultadosPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('auth_user_id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: tournament } = await admin
    .from('tournaments')
    .select('id')
    .in('status', ['active', 'draft'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Todas as equipas agrupadas por categoria
  const { data: teams } = await admin
    .from('teams')
    .select('id, name, category_id, category:categories(code)')
    .eq('status', 'active')
    .order('name')

  // Últimos jogos registados
  const { data: recentMatches } = await admin
    .from('challenges')
    .select(`
      id, created_at,
      challenger_team:teams!challenges_challenger_team_id_fkey(name),
      challenged_team:teams!challenges_challenged_team_id_fkey(name),
      result:match_results(winner_team_id, sets:match_sets(*))
    `)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ClipboardList className="size-6" />
        Registar jogo
      </h1>

      {tournament && (
        <RegisterMatchForm tournamentId={tournament.id} teams={teams ?? []} />
      )}

      {/* Histórico */}
      {(recentMatches?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3">Últimos jogos</h2>
          <div className="space-y-2">
            {recentMatches!.map((m: any) => {
              const result = Array.isArray(m.result) ? m.result[0] : m.result
              const sets = result?.sets ?? []
              const challengerWon = result?.winner_team_id === m.challenger_team_id
              const challenger = Array.isArray(m.challenger_team) ? m.challenger_team[0] : m.challenger_team
              const challenged = Array.isArray(m.challenged_team) ? m.challenged_team[0] : m.challenged_team

              return (
                <Card key={m.id}>
                  <CardContent className="pt-3 pb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        <span className={challengerWon ? 'text-green-600 dark:text-green-400 font-bold' : ''}>
                          {challenger?.name}
                        </span>
                        <span className="text-muted-foreground mx-1.5">vs</span>
                        <span className={!challengerWon ? 'text-green-600 dark:text-green-400 font-bold' : ''}>
                          {challenged?.name}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(m.created_at), 'dd MMM yyyy', { locale: ptBR })}
                        {sets.length > 0 && ` · ${formatScore(sets)}`}
                      </p>
                    </div>
                    {challengerWon
                      ? <TrendingUp className="size-4 text-green-500 shrink-0" />
                      : <TrendingDown className="size-4 text-muted-foreground shrink-0" />}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
