import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TeamStatusForm } from '@/components/admin/team-status-form'
import { AddTeamForm } from '@/components/admin/add-team-form'
import { ResetPasswordButton } from '@/components/admin/reset-password-button'
import { Users } from 'lucide-react'

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativa',
  suspended: 'Suspensa',
  withdrawn: 'Retirada',
}

const STATUS_CLASS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 border-0',
  suspended: 'bg-orange-100 text-orange-800 border-0',
  withdrawn: 'bg-gray-100 text-gray-600 border-0',
}

export default async function AdminTeamsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

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

  const { data: teams } = await admin
    .from('teams')
    .select('*, category:categories(code, name)')
    .order('status')
    .order('name')

  const { data: categories } = await admin
    .from('categories')
    .select('id, code, name')
    .order('code')

  const { data: tournament } = await admin
    .from('tournaments')
    .select('id')
    .in('status', ['active', 'draft'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const byCategory: Record<string, typeof teams> = {}
  for (const t of teams ?? []) {
    const cat = (Array.isArray(t.category) ? t.category[0] : t.category)?.code ?? '?'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat]!.push(t)
  }

  const catOrder = ['M3', 'M4', 'M5', 'F54', 'MX']
  const sortedCats = Object.keys(byCategory).sort(
    (a, b) => catOrder.indexOf(a) - catOrder.indexOf(b)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="size-6" />
          Duplas
          <span className="text-sm text-muted-foreground font-normal">({teams?.length ?? 0})</span>
        </h1>
        {tournament && (
          <AddTeamForm
            tournamentId={tournament.id}
            categories={(categories ?? []).map((c: { id: string; code: string; name: string }) => ({ id: c.id, code: c.code, name: c.name }))}
          />
        )}
      </div>

      {sortedCats.map((cat) => (
        <div key={cat}>
          <h2 className="text-base font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
            {cat === 'F54' ? 'F5/4' : cat}
          </h2>
          <div className="space-y-2">
            {(byCategory[cat] ?? []).map((t: any) => (
              <Card key={t.id} className={t.status !== 'active' ? 'opacity-70' : ''}>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{t.name}</span>
                        <Badge className={`text-xs ${STATUS_CLASS[t.status] ?? ''}`}>
                          {STATUS_LABEL[t.status] ?? t.status}
                        </Badge>
                        {!t.captain_profile_id && (
                          <Badge className="text-xs bg-blue-100 text-blue-800 border-0">
                            Sem conta
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.player1_name}{t.player2_name ? ` · ${t.player2_name}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">{t.player1_email}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      {t.captain_profile_id && (
                        <ResetPasswordButton teamId={t.id} />
                      )}
                      <TeamStatusForm teamId={t.id} currentStatus={t.status} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
