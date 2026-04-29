'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createChallenge } from '@/actions/challenges'

interface Target {
  id: string
  name: string
  position: number
  lockReason: string | null
}

interface Props {
  targets: Target[]
  prefillTargetId?: string
}

export function NewChallengeForm({ targets, prefillTargetId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedId, setSelectedId] = useState(prefillTargetId ?? '')
  const [error, setError] = useState('')

  const selected = targets.find((t) => t.id === selectedId)
  const canSubmit = !!selected && !selected.lockReason

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    const formData = new FormData()
    formData.set('target_team_id', selectedId)
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
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
                  <span className="text-primary text-xs font-medium">Selecionado</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button
        type="submit"
        disabled={!canSubmit || isPending}
        className="w-full"
      >
        {isPending ? 'A criar desafio...' : `Desafiar ${selected?.name ?? ''}`}
      </Button>
    </form>
  )
}
