'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function ChallengeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[challenge error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <AlertTriangle className="size-8 text-destructive" />
      <div>
        <p className="font-semibold">Ocorreu um erro a carregar este desafio.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Tenta novamente ou contacta a organização.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground mt-1 font-mono">#{error.digest}</p>
        )}
      </div>
      <Button variant="outline" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  )
}
