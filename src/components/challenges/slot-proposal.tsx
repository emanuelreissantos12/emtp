'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { proposeSlot, acceptSlot } from '@/actions/challenges'
import { toast } from 'sonner'
import { Calendar, CheckCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'
import type { ScheduleSlot } from '@/types/database'

interface Props {
  challengeId: string
  tournamentId: string
  pendingProposal: any
  canPropose: boolean
  myTeamId: string | null
  isAdmin: boolean
}

export function SlotProposal({
  challengeId,
  tournamentId,
  pendingProposal,
  canPropose,
  myTeamId,
  isAdmin,
}: Props) {
  const [freeSlots, setFreeSlots] = useState<(ScheduleSlot & { court: { name: string } })[]>([])
  const [loading, setLoading] = useState(false)
  const [proposing, setProposing] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('schedule_slots')
      .select('*, court:courts(name)')
      .eq('tournament_id', tournamentId)
      .eq('status', 'free')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(20)
      .then(({ data }) => setFreeSlots((data as any) ?? []))
  }, [tournamentId])

  async function handlePropose(slotId: string) {
    setLoading(true)
    try {
      await proposeSlot(challengeId, slotId)
      toast.success('Horário proposto!')
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao propor horário')
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept(proposalId: string) {
    setLoading(true)
    try {
      await acceptSlot(proposalId)
      toast.success('Horário aceite! Jogo agendado.')
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao aceitar horário')
    } finally {
      setLoading(false)
    }
  }

  const iAmProposer = pendingProposal && myTeamId && pendingProposal.proposed_by_team_id === myTeamId
  const canAcceptPendingProposal = pendingProposal && myTeamId && !iAmProposer

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="size-4" />
          Horário
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Proposta pendente */}
        {pendingProposal && (
          <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300">
            <p className="text-sm font-medium flex items-center gap-2">
              <Clock className="size-4 text-yellow-600" />
              {iAmProposer ? 'A aguardar resposta' : 'Proposta recebida'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {pendingProposal.slot?.court?.name} ·{' '}
              {format(
                new Date(pendingProposal.slot?.starts_at),
                "EEEE, dd MMM 'às' HH:mm",
                { locale: ptBR }
              )}
            </p>
            <div className="flex gap-2 mt-2">
              {canAcceptPendingProposal && (
                <Button
                  size="sm"
                  onClick={() => handleAccept(pendingProposal.id)}
                  disabled={loading}
                >
                  <CheckCircle className="size-3.5 mr-1" />
                  Aceitar
                </Button>
              )}
              {canPropose && !proposing && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setProposing(true)}
                  disabled={loading}
                >
                  {iAmProposer ? 'Alterar proposta' : 'Sugerir outro'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Lista de horários livres */}
        {(!pendingProposal || proposing) && canPropose && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {proposing ? 'Escolhe outro horário:' : 'Propõe um horário:'}
              </p>
              {proposing && (
                <button
                  onClick={() => setProposing(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
              )}
            </div>
            {freeSlots.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem horários livres disponíveis. Contacta a organização.
              </p>
            )}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {freeSlots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => handlePropose(slot.id)}
                  disabled={loading}
                  className="w-full text-left p-2.5 rounded-lg border hover:bg-muted transition-colors text-sm"
                >
                  <span className="font-medium">{slot.court?.name}</span>
                  <span className="text-muted-foreground ml-2">
                    {format(new Date(slot.starts_at), "EEE dd/MM 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
