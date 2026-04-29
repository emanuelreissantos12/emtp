import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChallengeStatusBadge } from '@/components/challenges/challenge-status-badge'
import { LinkButton } from '@/components/ui/link-button'
import Link from 'next/link'
import { daysUntilDeadline } from '@/lib/domain/challenge'
import {
  Trophy,
  Swords,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react'

export default async function DashboardPage() {
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

  // Admin vai para painel de admin
  if (profile.role === 'admin') redirect('/admin')

  // Carrega equipa do capitão no torneio ativo
  const { data: team } = await supabase
    .from('teams')
    .select('*, category:categories(*), ranking:rankings(*)')
    .eq('captain_profile_id', profile.id)
    .eq('status', 'active')
    .maybeSingle()

  // Desafios ativos
  const { data: activeChallenges } = await supabase
    .from('challenges')
    .select(`
      *,
      challenger_team:teams!challenges_challenger_team_id_fkey(*),
      challenged_team:teams!challenges_challenged_team_id_fkey(*)
    `)
    .or(`challenger_team_id.eq.${team?.id},challenged_team_id.eq.${team?.id}`)
    .not('status', 'in', '("completed","cancelled","expired")')
    .order('created_at', { ascending: false })

  // Resultado por validar
  const pendingResult = activeChallenges?.find(
    (c) => c.status === 'result_pending'
  )

  // Proposta de horário pendente
  const negotiating = activeChallenges?.find(
    (c) => c.status === 'negotiating'
  )

  // Desafio desafiante (recebido)
  const receivedChallenge = activeChallenges?.find(
    (c) =>
      c.challenged_team_id === team?.id &&
      c.status === 'negotiating'
  )

  const ranking = Array.isArray(team?.ranking) ? team.ranking[0] : team?.ranking

  // Determina o próximo passo
  function getNextAction() {
    if (!team) return null
    if (team.status === 'suspended') {
      return {
        type: 'warning' as const,
        message: 'A tua dupla está suspensa. Contacta a organização.',
        href: null,
      }
    }
    if (pendingResult) {
      return {
        type: 'urgent' as const,
        message: 'Tens um resultado por validar.',
        href: `/challenges/${pendingResult.id}`,
        label: 'Validar resultado',
      }
    }
    if (receivedChallenge) {
      return {
        type: 'urgent' as const,
        message: `Recebeste um desafio de ${receivedChallenge.challenger_team?.name}.`,
        href: `/challenges/${receivedChallenge.id}`,
        label: 'Ver desafio',
      }
    }
    if (negotiating) {
      const days = daysUntilDeadline(negotiating)
      return {
        type: days <= 2 ? 'urgent' : ('info' as const),
        message:
          days > 0
            ? `Desafio a negociar. Prazo: ${days} dia${days !== 1 ? 's' : ''}.`
            : 'Prazo do desafio esgotado!',
        href: `/challenges/${negotiating.id}`,
        label: 'Negociar horário',
      }
    }
    return {
      type: 'ok' as const,
      message: 'Nenhuma ação pendente. Podes lançar um desafio.',
      href: '/ranking',
      label: 'Ver ranking e desafiar',
    }
  }

  const nextAction = getNextAction()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Olá, {profile.name.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground text-sm">Torneio Escada EMTP 2026</p>
      </div>

      {/* Próximo passo */}
      {nextAction && (
        <Card
          className={
            nextAction.type === 'urgent'
              ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30'
              : nextAction.type === 'warning'
              ? 'border-red-400 bg-red-50 dark:bg-red-950/30'
              : nextAction.type === 'ok'
              ? 'border-green-400 bg-green-50 dark:bg-green-950/30'
              : ''
          }
        >
          <CardContent className="pt-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {nextAction.type === 'urgent' ? (
                <AlertTriangle className="size-5 text-orange-500 mt-0.5 shrink-0" />
              ) : nextAction.type === 'warning' ? (
                <AlertTriangle className="size-5 text-red-500 mt-0.5 shrink-0" />
              ) : nextAction.type === 'ok' ? (
                <CheckCircle className="size-5 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <Clock className="size-5 text-blue-500 mt-0.5 shrink-0" />
              )}
              <p className="font-medium text-sm">{nextAction.message}</p>
            </div>
            {nextAction.href && nextAction.label && (
              <LinkButton href={nextAction.href} size="sm" className="shrink-0">
                {nextAction.label}
              </LinkButton>
            )}
          </CardContent>
        </Card>
      )}

      {/* Posição no ranking */}
      {team && ranking && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              A tua posição
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-black">{ranking.position}.º</span>
                  <Trophy className="size-5 text-yellow-500" />
                </div>
                <p className="font-semibold">{team.name}</p>
                <p className="text-sm text-muted-foreground">
                  {team.category?.name ?? team.category_id}
                </p>
              </div>
              <LinkButton href="/ranking" variant="outline" size="sm">
                Ver ranking
                <ChevronRight className="size-4 ml-1" />
              </LinkButton>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Desafios ativos */}
      {activeChallenges && activeChallenges.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3">Desafios ativos</h2>
          <div className="space-y-2">
            {activeChallenges.map((c) => {
              const isChallenger = c.challenger_team_id === team?.id
              const opponent = isChallenger
                ? c.challenged_team
                : c.challenger_team
              const days = daysUntilDeadline(c)

              return (
                <Link key={c.id} href={`/challenges/${c.id}`}>
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="pt-3 pb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Swords className="size-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {isChallenger ? 'vs ' : 'de '}
                            {opponent?.name ?? '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {days > 0
                              ? `Prazo: ${days} dia${days !== 1 ? 's' : ''}`
                              : 'Prazo esgotado'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ChallengeStatusBadge status={c.status} />
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Link para histórico */}
      {team && (
        <LinkButton href={`/ranking/equipa/${team.id}`} variant="outline" className="w-full">
          <Swords className="size-4 mr-2" />
          Ver histórico de jogos
        </LinkButton>
      )}

      {!team && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p>Não estás associado a nenhuma dupla neste torneio.</p>
            <p className="text-sm mt-1">Contacta a organização.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
