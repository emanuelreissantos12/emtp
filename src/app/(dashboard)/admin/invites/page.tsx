import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InviteForm } from '@/components/admin/invite-form'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Mail, CheckCircle, Clock, XCircle } from 'lucide-react'

export default async function InvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; team?: string }>
}) {
  const { email: prefillEmail, team: prefillTeam } = await searchParams
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

  const { data: invites } = await supabase
    .from('invites')
    .select('*, team:teams(name), created_by_profile:profiles!invites_created_by_fkey(name)')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, category:categories(code)')
    .is('captain_profile_id', null)
    .eq('status', 'active')
    .order('name')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .in('status', ['active', 'draft'])
    .limit(1)
    .maybeSingle()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Mail className="size-6" />
        Convites
      </h1>

      <InviteForm
        teams={(teams ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          category: Array.isArray(t.category) ? (t.category[0] ?? null) : t.category,
        }))}
        prefillEmail={prefillEmail}
        prefillTeamId={prefillTeam}
      />

      <div className="space-y-2">
        <h2 className="text-base font-semibold">Convites enviados</h2>
        {(invites ?? []).length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            Sem convites ainda.
          </p>
        )}
        {(invites ?? []).map((inv: any) => {
          const isUsed = !!inv.used_at
          const isExpired = !isUsed && new Date(inv.expires_at) < new Date()

          return (
            <Card key={inv.id}>
              <CardContent className="pt-3 pb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{inv.email}</span>
                    {isUsed ? (
                      <Badge className="bg-green-100 text-green-800 border-0 text-xs">Usado</Badge>
                    ) : isExpired ? (
                      <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">Expirado</Badge>
                    ) : (
                      <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">Pendente</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {inv.team?.name ? `${inv.team.name} · ` : ''}
                    {inv.role} ·{' '}
                    {format(new Date(inv.created_at), 'dd MMM yyyy', { locale: ptBR })}
                  </p>
                </div>
                {!isUsed && !isExpired && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="size-3" />
                    Expira {format(new Date(inv.expires_at), 'dd/MM', { locale: ptBR })}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
