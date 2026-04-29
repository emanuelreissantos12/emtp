'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createChallenge } from '@/actions/challenges'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar, MessageSquare } from 'lucide-react'

interface Target {
  id: string
  name: string
  position: number
  lockReason: string | null
}

interface Slot {
  id: string
  startsAt: string
  endsAt: string
  courtName: string
}

interface Props {
  targets: Target[]
  slots: Slot[]
  prefillTargetId?: string
}

export function NewChallengeForm({ targets, slots, prefillTargetId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedId, setSelectedId] = useState(prefillTargetId ?? '')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selected = targets.find((t) => t.id === selectedId)
  const canSubmit = !!selected && !selected.lockReason

  // Agrupar slots por data
  const slotsByDate: Record<string, Slot[]> = {}
  for (const s of slots) {
    const day = format(new Date(s.startsAt), 'yyyy-MM-dd')
    if (!slotsByDate[day]) slotsByDate[day] = []
    slotsByDate[day].push(s)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    const formData = new FormData()
    formData.set('target_team_id', selectedId)
    if (selectedSlot) formData.set('slot_id', selectedSlot)
    if (message.trim()) formData.set('message', message.trim())
    startTransition(async () => {
      try {
        await createChallenge(formData)
        router.push('/challenges')
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  if (targets.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Não há adversários elegíveis para desafiar de momento.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Selecionar adversário */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Adversário</p>
        <p className="text-xs text-muted-foreground">
          Podes desafiar as duplas imediatamente acima de ti no ranking.
        </p>
        <div className="space-y-2">
          {targets.map((t) => {
            const isLocked = !!t.lockReason
            const isSelected = selectedId === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => !isLocked && setSelectedId(t.id)}
                disabled={isLocked}
                className={[
                  'w-full text-left p-3 rounded-lg border transition-colors',
                  isLocked ? 'opacity-50 cursor-not-allowed bg-muted/30' : 'cursor-pointer hover:bg-muted/50',
                  isSelected ? 'border-primary bg-primary/5' : 'border-border',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-sm">{t.position}. {t.name}</span>
                    {isLocked && (
                      <p className="text-xs text-muted-foreground mt-0.5">{t.lockReason}</p>
                    )}
                  </div>
                  {isSelected && !isLocked && (
                    <span className="text-primary text-xs font-medium">✓</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selecionar horário */}
      <div className="space-y-2">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Calendar className="size-4" />
          Horário proposto
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </p>
        {slots.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Não há horários livres disponíveis. Podes propor um horário depois de criar o desafio.
          </p>
        ) : (
          <div className="space-y-3">
            {Object.entries(slotsByDate).map(([day, daySlots]) => (
              <div key={day}>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                  {format(new Date(day + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {daySlots.map((s) => {
                    const isSelected = selectedSlot === s.id
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSlot(isSelected ? '' : s.id)}
                        className={[
                          'text-left p-2.5 rounded-lg border text-sm transition-colors',
                          isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
                        ].join(' ')}
                      >
                        <p className="font-medium">
                          {format(new Date(s.startsAt), 'HH:mm')}
                          {' – '}
                          {format(new Date(s.endsAt), 'HH:mm')}
                        </p>
                        <p className="text-xs text-muted-foreground">{s.courtName}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mensagem */}
      <div className="space-y-2">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <MessageSquare className="size-4" />
          Mensagem
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ex: Olá! Estou disponível à tarde. Que tal sábado?"
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring/50"
          maxLength={500}
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button type="submit" disabled={!canSubmit || isPending} className="w-full">
        {isPending
          ? 'A criar desafio...'
          : `Desafiar ${selected?.name ?? ''}`}
      </Button>
    </form>
  )
}
