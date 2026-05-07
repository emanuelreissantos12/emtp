'use client'

import { Shield } from 'lucide-react'
import { toast } from 'sonner'

export function LockReasonButton({ reason }: { reason: string }) {
  return (
    <button
      type="button"
      onClick={() => toast.info(reason, { duration: 4000 })}
      className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
      aria-label={reason}
    >
      <Shield className="size-4 text-muted-foreground" />
    </button>
  )
}
