'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { setRankingPosition } from '@/actions/admin'

interface Props {
  teamId: string
  categoryId: string
  currentPosition: number
  maxPosition: number
}

export function RankingEditForm({ teamId, categoryId, currentPosition, maxPosition }: Props) {
  const [editing, setEditing] = useState(false)
  const [position, setPosition] = useState(currentPosition)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!reason.trim()) { setError('Motivo obrigatório'); return }
    if (position < 1 || position > maxPosition) { setError(`Posição deve ser entre 1 e ${maxPosition}`); return }
    startTransition(async () => {
      try {
        await setRankingPosition(teamId, categoryId, position, reason)
        setEditing(false)
        setReason('')
        setError('')
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  if (!editing) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7 px-2 text-xs">
        Editar
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[200px]">
      <div className="flex gap-2 items-center">
        <span className="text-xs text-muted-foreground">Pos:</span>
        <input
          type="number"
          min={1}
          max={maxPosition}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          className="border rounded px-2 py-0.5 text-sm w-14"
        />
      </div>
      <input
        type="text"
        placeholder="Motivo"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="border rounded px-2 py-1 text-sm"
        autoFocus
      />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <div className="flex gap-1.5">
        <Button size="sm" onClick={handleSave} disabled={isPending} className="h-7 px-3 text-xs">
          {isPending ? '...' : 'Guardar'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="h-7 px-2 text-xs">
          ✕
        </Button>
      </div>
    </div>
  )
}
