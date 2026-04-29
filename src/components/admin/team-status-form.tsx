'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { updateTeamStatus } from '@/actions/admin'
import type { TeamStatus } from '@/types/database'

interface Props {
  teamId: string
  currentStatus: TeamStatus
}

export function TeamStatusForm({ teamId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showReason, setShowReason] = useState(false)
  const [targetStatus, setTargetStatus] = useState<TeamStatus | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  function handleClick(status: TeamStatus) {
    setTargetStatus(status)
    setShowReason(true)
    setReason('')
    setError('')
  }

  function handleCancel() {
    setShowReason(false)
    setTargetStatus(null)
    setReason('')
  }

  function handleSubmit() {
    if (!targetStatus || !reason.trim()) {
      setError('Motivo obrigatório')
      return
    }
    startTransition(async () => {
      try {
        await updateTeamStatus(teamId, targetStatus, reason)
        setShowReason(false)
        setTargetStatus(null)
        setReason('')
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  if (showReason) {
    return (
      <div className="flex flex-col gap-2 w-full">
        <input
          type="text"
          placeholder="Motivo (obrigatório)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="border rounded px-2 py-1 text-sm w-full"
          autoFocus
        />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={isPending}>
            {isPending ? '...' : 'Confirmar'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      {currentStatus === 'active' && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleClick('suspended')}
          className="text-orange-600 border-orange-300 hover:bg-orange-50"
        >
          Suspender
        </Button>
      )}
      {currentStatus === 'suspended' && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleClick('active')}
          className="text-green-600 border-green-300 hover:bg-green-50"
        >
          Reativar
        </Button>
      )}
      {currentStatus !== 'withdrawn' && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleClick('withdrawn')}
          className="text-red-600 border-red-300 hover:bg-red-50"
        >
          Retirar
        </Button>
      )}
    </div>
  )
}
