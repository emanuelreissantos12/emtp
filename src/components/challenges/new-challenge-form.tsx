'use client'

import { useState, useTransition, useEffect } from 'react'
import { createChallenge } from '@/actions/challenges'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar, MessageSquare } from 'lucide-react'

interface Target {
  id: string
  name: string
  position: number
  lockReason: string | null
}

interface Court {
  id: string
  name: string
}

interface Props {
  targets: Target[]
  courts: Court[]
  prefillTargetId?: string
}

export function NewChallengeForm({ targets, courts, prefillTargetId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [selectedId, setSelectedId] = useState(prefillTargetId ?? '')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [court, setCourt] = useState(courts[0]?.name ?? '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selected = targets.find((t) => t.id === selectedId)
  const canSubmit = !!selected && !selected.lockReason

  const [minDate, setMinDate] = useState('')
  useEffect(() => {
    const d = new Date()
    setMinDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')

    const formData = new FormData()
    formData.set('target_team_id', selectedId)
    if (date) {
      formData.set('proposed_datetime', `${date}T${time}:00`)
      formData.set('proposed_court', court)
    }
    if (message.trim()) formData.set('message', message.trim())

    startTransition(async () => {
      try {
        await createChallenge(formData)
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

      {/* Proposta de horário */}
      <div className="space-y-2">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Calendar className="size-4" />
          Propor horário
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Sugere uma data e hora. O admin confirma ou propõe outra opção.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data</label>
            <input
              type="date"
              value={date}
              min={minDate}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm w-full bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Hora</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              step={1800}
              className="border rounded-lg px-3 py-2 text-sm w-full bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </div>
        </div>
        {courts.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Campo</label>
            <div className="flex gap-2">
              {courts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCourt(c.name)}
                  className={[
                    'flex-1 py-2 px-3 rounded-lg border text-sm transition-colors',
                    court === c.name
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:bg-muted/50',
                  ].join(' ')}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {date && (
          <p className="text-xs text-muted-foreground">
            Proposta: {format(new Date(`${date}T${time}:00`), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })} — {court}
          </p>
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
        {isPending ? 'A criar desafio...' : `Desafiar ${selected?.name ?? ''}`}
      </Button>
    </form>
  )
}
