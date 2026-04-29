import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RankingEditForm } from '@/components/admin/ranking-edit-form'
import { Trophy } from 'lucide-react'

const CAT_LABEL: Record<string, string> = {
  M3: 'M3', M4: 'M4', M5: 'M5', F54: 'F5/4', MX: 'MX',
}
const CAT_ORDER = ['M3', 'M4', 'M5', 'F54', 'MX']

export default async function AdminRankingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: rankings } = await supabase
    .from('rankings')
    .select(`
      *,
      team:teams(id, name, status),
      category:categories(id, code, name)
    `)
    .order('position')

  const { data: rankingEvents } = await supabase
    .from('ranking_events')
    .select('*, team:teams(name), created_by_profile:profiles!ranking_events_created_by_fkey(name)')
    .order('created_at', { ascending: false })
    .limit(20)

  type RankingRow = NonNullable<typeof rankings>[number]
  const byCategory: Record<string, RankingRow[]> = {}
  for (const r of rankings ?? []) {
    const cat = (Array.isArray(r.category) ? r.category[0] : r.category)?.code ?? '?'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat]!.push(r)
  }

  const sortedCats = Object.keys(byCategory).sort(
    (a, b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b)
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Trophy className="size-6" />
        Ranking
      </h1>

      <div className="grid gap-4 md:grid-cols-2">
        {sortedCats.map((cat) => {
          const rows = byCategory[cat] ?? []
          const catData = (Array.isArray(rows[0]?.category) ? rows[0]?.category[0] : rows[0]?.category)
          return (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{CAT_LABEL[cat] ?? cat}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {rows.map((r) => {
                  const team = Array.isArray(r.team) ? r.team[0] : r.team
                  const category = Array.isArray(r.category) ? r.category[0] : r.category
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-black tabular-nums w-6 text-center">
                          {r.position}
                        </span>
                        <span className={`text-sm ${team?.status !== 'active' ? 'text-muted-foreground line-through' : ''}`}>
                          {team?.name}
                        </span>
                      </div>
                      <RankingEditForm
                        teamId={r.team_id}
                        categoryId={r.category_id}
                        currentPosition={r.position}
                        maxPosition={rows.length}
                      />
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {(rankingEvents?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-2">Histórico de alterações</h2>
          <div className="space-y-1">
            {rankingEvents!.map((ev) => {
              const team = Array.isArray(ev.team) ? ev.team[0] : ev.team
              const by = Array.isArray(ev.created_by_profile) ? ev.created_by_profile[0] : ev.created_by_profile
              return (
                <div key={ev.id} className="text-xs text-muted-foreground flex gap-2">
                  <span className="font-medium text-foreground">{team?.name}</span>
                  <span>{ev.old_position} → {ev.new_position}</span>
                  <span className="truncate">{ev.reason}</span>
                  {by && <span className="shrink-0">({by.name})</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
