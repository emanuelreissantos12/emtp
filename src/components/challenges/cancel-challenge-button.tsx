'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cancelChallenge } from '@/actions/challenges'
import { toast } from 'sonner'
import { XCircle } from 'lucide-react'

export function CancelChallengeButton({ challengeId }: { challengeId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirming) { setConfirming(true); return }
    startTransition(async () => {
      const result = await cancelChallenge(challengeId)
      if (result?.error) {
        toast.error(result.error)
        setConfirming(false)
      } else {
        toast.success('Desafio anulado.')
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {confirming && !isPending && (
        <span className="text-xs text-muted-foreground">Tens a certeza?</span>
      )}
      <Button
        size="sm"
        variant={confirming ? 'destructive' : 'outline'}
        onClick={handleClick}
        disabled={isPending}
        onBlur={() => setConfirming(false)}
      >
        <XCircle className="size-3.5 mr-1" />
        {isPending ? 'A anular...' : confirming ? 'Confirmar anulação' : 'Anular desafio'}
      </Button>
    </div>
  )
}
