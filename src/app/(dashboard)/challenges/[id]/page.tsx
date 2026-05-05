import { createClient, createAdminClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ChallengeStatusBadge } from '@/components/challenges/challenge-status-badge'
import { ResultForm } from '@/components/challenges/result-form'
import { ChatBox } from '@/components/challenges/chat-box'
import { SlotProposal } from '@/components/challenges/slot-proposal'
import { AdminResultOverride } from '@/components/challenges/admin-result-override'
import { CancelChallengeButton } from '@/components/challenges/cancel-challenge-button'
import { validateResult } from '@/actions/challenges'
import { daysUntilDeadline, isChallengeExpired } from '@/lib/domain/challenge'
import { formatScore } from '@/lib/domain/result'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatPT } from '@/lib/utils'
import { Clock, Trophy, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  // Usa admin client para evitar bloqueio por RLS; acesso verificado manualmente abaixo
  const admin = createAdminClient()
  const { data: challenge, error: challengeError } = await admin
    .from('challenges')
    .select(`
      *,
      challenger_team:teams!challenges_challenger_team_id_fkey(*),
      challenged_team:teams!challenges_challenged_team_id_fkey(*),
      category:categories(code, name),
      messages:challenge_messages(*, author:profiles(name)),
      proposals:challenge_proposals(*),
      result:match_results(*, sets:match_sets(*))
    `)
    .eq('id', id)
    .single()

  if (challengeError) console.error('[challenge page]', challengeError)

  if (!challenge) notFound()

  // Verifica acesso
  const isAdmin = profile.role === 'admin'
  const isChallenger = challenge.challenger_team?.captain_profile_id === profile.id
  const isChallenged = challenge.challenged_team?.captain_profile_id === profile.id
  if (!isAdmin && !isChallenger && !isChallenged) notFound()

  const myTeam = isChallenger
    ? challenge.challenger_team
    : isChallenged
    ? challenge.challenged_team
    : null

  const days = daysUntilDeadline(challenge)
  const expired = isChallengeExpired(challenge)
  const result = Array.isArray(challenge.result) ? challenge.result[0] : challenge.result
  const sets = result?.sets ?? []
  const pendingProposal = (challenge.proposals ?? []).find(
    (p: any) => p.status === 'pending' || p.status === 'team_accepted'
  )
  const canSubmitResult =
    (isChallenger || isChallenged) &&
    ['scheduled', 'negotiating'].includes(challenge.status) &&
    !result
  const canValidateResult =
    result?.status === 'pending_validation' &&
    (isAdmin || (myTeam && myTeam.id !== result.submitted_by_team_id))

  const messages = [...(challenge.messages ?? [])].sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">
            {challenge.challenger_team?.name}
            <span className="text-muted-foreground font-normal mx-2">vs</span>
            {challenge.challenged_team?.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {challenge.category?.code} · Criado a{' '}
            {format(new Date(challenge.created_at), 'dd MMM yyyy', { locale: ptBR })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ChallengeStatusBadge status={challenge.status} />
          {!['completed', 'cancelled', 'expired'].includes(challenge.status) && (isAdmin || isChallenger || isChallenged) && (
            <CancelChallengeButton challengeId={challenge.id} />
          )}
        </div>
      </div>

      {/* Prazo */}
      {!['completed', 'cancelled', 'expired'].includes(challenge.status) && (
        <div
          className={`flex items-center gap-2 text-sm p-3 rounded-lg ${
            expired || days <= 0
              ? 'bg-red-50 text-red-700 dark:bg-red-950/30'
              : days <= 2
              ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/30'
              : 'bg-muted'
          }`}
        >
          <Clock className="size-4 shrink-0" />
          {expired || days <= 0
            ? 'Prazo esgotado! Contacta a organização.'
            : `Prazo: ${days} dia${days !== 1 ? 's' : ''} restante${days !== 1 ? 's' : ''}`}
        </div>
      )}

      {/* Horário confirmado */}
      {challenge.status === 'scheduled' && (() => {
        const confirmed = (challenge.proposals ?? []).find((p: any) => p.status === 'accepted')
        if (!confirmed) return null
        return (
          <Card className="border-green-400">
            <CardContent className="pt-3 pb-3 flex items-center gap-3">
              <CheckCircle className="size-4 text-green-500 shrink-0" />
              <div>
                <p className="font-medium text-sm">Horário confirmado</p>
                <p className="text-xs text-muted-foreground">
                  {confirmed.proposed_court && `${confirmed.proposed_court} · `}
                  {confirmed.proposed_datetime && formatPT(confirmed.proposed_datetime)}
                </p>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Resultado */}
      {result && (
        <Card className={result.status === 'validated' ? 'border-green-400' : result.status === 'rejected' ? 'border-red-400' : 'border-orange-400'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {result.status === 'validated' ? (
                <CheckCircle className="size-4 text-green-500" />
              ) : result.status === 'rejected' ? (
                <XCircle className="size-4 text-red-500" />
              ) : (
                <Clock className="size-4 text-orange-500" />
              )}
              {result.status === 'validated'
                ? 'Resultado validado'
                : result.status === 'rejected'
                ? 'Resultado rejeitado'
                : 'Resultado pendente de validação'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 space-y-2">
            <p className="text-sm">
              Vencedor:{' '}
              <span className="font-semibold">
                {result.winner_team_id === challenge.challenger_team_id
                  ? challenge.challenger_team?.name
                  : challenge.challenged_team?.name}
              </span>
            </p>
            {sets.length > 0 && (
              <p className="text-sm text-muted-foreground font-mono">
                {formatScore(sets)}
              </p>
            )}

            {canValidateResult && (
              <div className="flex gap-2 pt-2">
                <form action={validateResult.bind(null, result.id, true)}>
                  <Button type="submit" size="sm" variant="default">
                    Confirmar resultado
                  </Button>
                </form>
                <form action={validateResult.bind(null, result.id, false)}>
                  <Button type="submit" size="sm" variant="destructive">
                    Contestar
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Proposta de horário */}
      {(challenge.status === 'negotiating' || challenge.status === 'scheduled') && (
        <SlotProposal
          challengeId={challenge.id}
          pendingProposal={pendingProposal}
          canPropose={isChallenger || isChallenged || isAdmin}
          myTeamId={myTeam?.id ?? null}
          isAdmin={isAdmin}
        />
      )}

      {/* Formulário de resultado */}
      {canSubmitResult && (
        <ResultForm
          challengeId={challenge.id}
          challengerTeamId={challenge.challenger_team_id}
          challengedTeamId={challenge.challenged_team_id}
          challengerName={challenge.challenger_team?.name ?? ''}
          challengedName={challenge.challenged_team?.name ?? ''}
        />
      )}

      {/* Admin: corrigir resultado */}
      {isAdmin && (
        <AdminResultOverride
          challengeId={challenge.id}
          challengerTeamId={challenge.challenger_team_id}
          challengedTeamId={challenge.challenged_team_id}
          challengerName={challenge.challenger_team?.name ?? ''}
          challengedName={challenge.challenged_team?.name ?? ''}
        />
      )}

      <Separator />

      {/* Chat */}
      <ChatBox
        challengeId={challenge.id}
        messages={messages}
        profileId={profile.id}
        profileName={profile.name}
        canMessage={isChallenger || isChallenged || isAdmin}
      />
    </div>
  )
}
