'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { proposeTime, acceptProposal, confirmProposal } from '@/actions/challenges'
import { toast } from 'sonner'
import { Calendar, CheckCircle, Clock, ShieldCheck, ThumbsUp } from 'lucide-react'
import { formatPT } from '@/lib/utils'

const COURTS = ['Campo 1', 'Campo 2']

interface Props {
  challengeId: string
  pendingProposal: any
  canPropose: boolean
  myTeamId: string | null
  isAdmin: boolean
}

export function SlotProposal({ challengeId, pendingProposal, canPropose, myTeamId, isAdmin }: Props) {
  const [proposing, setProposing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [court, setCourt] = useState(COURTS[0])

  const [minDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  const iAmProposer = pendingProposal && myTeamId && pendingProposal.proposed_by_team_id === myTeamId
  const isTeamAccepted = pendingProposal?.status === 'team_accepted'
  const canAccept = pendingProposal && myTeamId && !iAmProposer && !isAdmin && !isTeamAccepted
  const canConfirm = isAdmin && pendingProposal && ['pending', 'team_accepted'].includes(pendingProposal?.status)

  async function handlePropose() {
    if (!date) { toast.error('Escolhe uma data.'); return }
    setLoading(true)
    try {
      await proposeTime(challengeId, new Date(`${date}T${time}:00`).toISOString(), court)
      toast.success('Horário proposto!')
      setProposing(false)
      setDate('')
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao propor')
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept() {
    setLoading(true)
    try {
      await acceptProposal(pendingProposal.id)
      toast.success('Acordado! A aguardar confirmação do admin.')
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao aceitar')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    setLoading(true)
    try {
      await confirmProposal(pendingProposal.id)
      toast.success('Horário confirmado! Jogo agendado.')
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao confirmar')
    } finally {
      setLoading(false)
    }
  }

  function formatProposal(p: any) {
    if (!p?.proposed_datetime) return '—'
    return formatPT(p.proposed_datetime, { weekday: true, date: true, time: true })
  }

  function proposalLabel() {
    if (isAdmin) return isTeamAccepted ? 'Acordo das duplas — confirmar' : 'Proposta pendente'
    if (isTeamAccepted) return 'Acordado — a aguardar confirmação do admin'
    if (iAmProposer) return 'A aguardar resposta da outra dupla'
    return 'Proposta recebida'
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="size-4" />
          Horário
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* Proposta existente */}
        {pendingProposal && (
          <div className={`p-3 rounded-lg border ${isTeamAccepted ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300' : 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300'}`}>
            <p className="text-sm font-medium flex items-center gap-2">
              {isTeamAccepted
                ? <ThumbsUp className="size-4 text-blue-600" />
                : <Clock className="size-4 text-yellow-600" />}
              {proposalLabel()}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {formatProposal(pendingProposal)}
              {pendingProposal.proposed_court && ` — ${pendingProposal.proposed_court}`}
            </p>

            {/* Passo 2: outra dupla aceita */}
            {canAccept && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={handleAccept} disabled={loading}>
                  <CheckCircle className="size-3.5 mr-1" />
                  Aceitar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setProposing(true)} disabled={loading}>
                  Sugerir outro
                </Button>
              </div>
            )}

            {/* Passo 3: admin confirma */}
            {canConfirm && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={handleConfirm} disabled={loading}>
                  <ShieldCheck className="size-3.5 mr-1" />
                  Confirmar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setProposing(true)} disabled={loading}>
                  Propor outro
                </Button>
              </div>
            )}

            {/* Proposer pode alterar */}
            {iAmProposer && !isTeamAccepted && canPropose && !proposing && (
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setProposing(true)} disabled={loading}>
                Alterar proposta
              </Button>
            )}
          </div>
        )}

        {/* Formulário de proposta */}
        {(!pendingProposal || proposing) && canPropose && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium">
              {proposing ? 'Propor outro horário:' : 'Propor horário:'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data</label>
                <input
                  type="date"
                  value={date}
                  min={minDate}
                  onChange={(e) => setDate(e.target.value)}
                  suppressHydrationWarning
                  className="border rounded-lg px-2 py-1.5 text-sm w-full bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Hora</label>
                <input
                  type="time"
                  value={time}
                  step={1800}
                  onChange={(e) => setTime(e.target.value)}
                  className="border rounded-lg px-2 py-1.5 text-sm w-full bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Campo</label>
              <div className="flex gap-2">
                {COURTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCourt(c)}
                    className={[
                      'flex-1 py-1.5 px-3 rounded-lg border text-sm transition-colors',
                      court === c ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-muted/50',
                    ].join(' ')}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handlePropose} disabled={loading || !date} className="flex-1">
                {loading ? 'A enviar...' : 'Propor'}
              </Button>
              {proposing && (
                <Button size="sm" variant="outline" onClick={() => { setProposing(false); setDate('') }} disabled={loading}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
