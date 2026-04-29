'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { createSlot } from '@/actions/admin'

interface Props {
  tournamentId: string
  courts: { id: string; name: string }[]
}

export function SlotCreateForm({ tournamentId, courts }: Props) {
  const [isPending, startTransition] = useTransition()
  const [courtId, setCourtId] = useState(courts[0]?.id ?? '')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    if (!date || !courtId) { setError('Preencha todos os campos'); return }

    const startsAt = new Date(`${date}T${startTime}:00`)
    const endsAt = new Date(`${date}T${endTime}:00`)
    if (endsAt <= startsAt) { setError('Hora de fim deve ser depois do início'); return }

    const formData = new FormData()
    formData.set('tournament_id', tournamentId)
    formData.set('court_id', courtId)
    formData.set('starts_at', startsAt.toISOString())
    formData.set('ends_at', endsAt.toISOString())

    startTransition(async () => {
      try {
        await createSlot(formData)
        setSuccess(true)
        setDate('')
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <h3 className="font-semibold text-sm">Novo horário livre</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Campo</label>
          <select
            value={courtId}
            onChange={(e) => setCourtId(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm w-full bg-background"
          >
            {courts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Data</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm w-full bg-background"
            required
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Início</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm w-full bg-background"
            step={1800}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Fim</label>
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              {[60, 90].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    if (!startTime) return
                    const [h, m] = startTime.split(':').map(Number)
                    const total = h * 60 + m + mins
                    const endH = String(Math.floor(total / 60) % 24).padStart(2, '0')
                    const endM = String(total % 60).padStart(2, '0')
                    setEndTime(`${endH}:${endM}`)
                  }}
                  className="text-xs px-2 py-1 rounded border border-border hover:bg-muted/60 bg-background transition-colors"
                >
                  {mins} min
                </button>
              ))}
            </div>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="border rounded px-2 py-1.5 text-sm w-full bg-background"
              step={1800}
            />
          </div>
        </div>
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      {success && <p className="text-green-600 text-xs">Horário criado com sucesso.</p>}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? 'A criar...' : 'Criar horário'}
      </Button>
    </form>
  )
}
