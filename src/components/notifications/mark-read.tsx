'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { markNotificationsRead } from '@/actions/notifications'

export function MarkNotificationsRead({ ids }: { ids: string[] }) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      await markNotificationsRead(ids)
    })
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? '...' : 'Marcar como lidas'}
    </Button>
  )
}
