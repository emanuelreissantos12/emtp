import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChallengeStatusBadge } from '@/components/challenges/challenge-status-badge'
import { LinkButton } from '@/components/ui/link-button'
import Link from 'next/link'
import { daysUntilDeadline } from '@/lib/domain/challenge'
import {
  AlertTriangle,
  Clock,
  Swords,
  Users,
  Trophy,
  Mail,
  ShieldAlert,
  ChevronRight,
  CheckCircle,
  ClipboardList,
} from 'lucide-react'

export default async function AdminDashboardPage() {
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
  if (!profile || profile.role !== 'admin') redirect('/')

  // Torneio ativo
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .in('status', ['active', 'draft'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Desafios a expirar (< 2 dias)
  const soon = new Date()
  soon.setDate(soon.getDate() + 2)

  const { data: expiringChallenges } = await supabase
    .from('challenges')
    .select(`
      *,
      challenger_team:teams!challenges_challenger_team_id_fkey(name),
      challenged_team:teams!challenges_challenged_team_id_fkey(name)
    `)
    .not('status', 'in', '("completed","cancelled","expired")')
    .lte('deadline_at', soon.toISOString())
    .order('deadline_at')

  // Resultados por validar
  const { data: pendingResults } = await supabase
    .from('match_results')
    .select(`
      *,
      challenge:challenges(
        id,
        challenger_team:teams!challenges_challenger_team_id_fkey(name),
        challenged_team:teams!challenges_challenged_team_id_fkey(name)
      )
    `)
    .eq('status', 'pending_validation')
    .order('created_at')

  // Disputas abertas
  const { data: openDisputes } = await supabase
    .from('disputes')
    .select(`
      *,
      challenge:challenges(
        id,
        challenger_team:teams!challenges_challenger_team_id_fkey(name),
        challenged_team:teams!challenges_challenged_team_id_fkey(name)
      )
    `)
    .eq('status', 'open')
    .order('created_at')

  // Duplas suspensas
  const { data: suspendedTeams } = await supabase
    .from('teams')
    .select('*, category:categories(code)')
    .eq('status', 'suspended')

  // Capitães sem conta
  const { data: teamsWithoutCaptain } = await supabase
    .from('teams')
    .select('id, name, player1_email, category:categories(code)')
    .is('captain_profile_id', null)
    .eq('status', 'active')
    .limit(10)

  const stats = [
    {
      label: 'A expirar',
      value: expiringChallenges?.length ?? 0,
      icon: Clock,
      color: 'text-orange-500',
      urgent: (expiringChallenges?.length ?? 0) > 0,
    },
    {
      label: 'Resultados pendentes',
      value: pendingResults?.length ?? 0,
      icon: CheckCircle,
      color: 'text-yellow-500',
      urgent: (pendingResults?.length ?? 0) > 0,
    },
    {
      label: 'Disputas',
      value: openDisputes?.length ?? 0,
      icon: ShieldAlert,
      color: 'text-red-500',
      urgent: (openDisputes?.length ?? 0) > 0,
    },
    {
      label: 'Sem conta',
      value: teamsWithoutCaptain?.length ?? 0,
      icon: Mail,
      color: 'text-blue-500',
      urgent: false,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Admin</h1>
        <p className="text-muted-foreground text-sm">
          {tournament?.name} {tournament?.season}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, color, urgent }) => (
          <Card
            key={label}
            className={urgent && value > 0 ? 'border-orange-300' : ''}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`size-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-2xl font-black">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Links de gestão */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { href: '/admin/resultados', label: 'Registar jogo', icon: ClipboardList },
          { href: '/admin/teams', label: 'Duplas', icon: Users },
          { href: '/admin/ranking', label: 'Ranking', icon: Trophy },
          { href: '/admin/challenges', label: 'Desafios', icon: Swords },
          { href: '/admin/invites', label: 'Convites', icon: Mail },
        ].map(({ href, label, icon: Icon }) => (
          <LinkButton
            key={href}
            href={href}
            variant="outline"
            className="h-16 flex-col gap-1"
          >
            <Icon className="size-5" />
            <span className="text-sm">{label}</span>
          </LinkButton>
        ))}
      </div>

      {/* Desafios a expirar */}
      {(expiringChallenges?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
            <Clock className="size-4 text-orange-500" />
            A expirar em breve
          </h2>
          <div className="space-y-2">
            {expiringChallenges!.map((c) => {
              const days = daysUntilDeadline(c)
              return (
                <Link key={c.id} href={`/challenges/${c.id}`}>
                  <Card className="hover:bg-muted/50 cursor-pointer border-orange-200">
                    <CardContent className="pt-3 pb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {c.challenger_team?.name} vs {c.challenged_team?.name}
                        </p>
                        <p className="text-xs text-orange-600">
                          {days <= 0 ? 'Prazo esgotado!' : `${days} dia${days !== 1 ? 's' : ''} restante${days !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Resultados pendentes */}
      {(pendingResults?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
            <CheckCircle className="size-4 text-yellow-500" />
            Resultados por validar
          </h2>
          <div className="space-y-2">
            {pendingResults!.map((r) => (
              <Link key={r.id} href={`/challenges/${r.challenge?.id}`}>
                <Card className="hover:bg-muted/50 cursor-pointer">
                  <CardContent className="pt-3 pb-3 flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {r.challenge?.challenger_team?.name} vs{' '}
                      {r.challenge?.challenged_team?.name}
                    </p>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Disputas */}
      {(openDisputes?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
            <ShieldAlert className="size-4 text-red-500" />
            Disputas por decidir
          </h2>
          <div className="space-y-2">
            {openDisputes!.map((d) => (
              <Link key={d.id} href={`/challenges/${d.challenge?.id}`}>
                <Card className="hover:bg-muted/50 cursor-pointer border-red-200">
                  <CardContent className="pt-3 pb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {d.challenge?.challenger_team?.name} vs{' '}
                        {d.challenge?.challenged_team?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{d.reason}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Duplas sem conta */}
      {(teamsWithoutCaptain?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
            <Mail className="size-4 text-blue-500" />
            Sem conta de acesso
          </h2>
          <div className="space-y-2">
            {teamsWithoutCaptain!.map((t) => (
              <Card key={t.id}>
                <CardContent className="pt-3 pb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(Array.isArray(t.category) ? t.category[0] : t.category)?.code} · {t.player1_email}
                    </p>
                  </div>
                  <LinkButton
                    href={`/admin/invites?email=${encodeURIComponent(t.player1_email)}&team=${t.id}`}
                    size="sm"
                    variant="outline"
                  >
                    Convidar
                  </LinkButton>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
