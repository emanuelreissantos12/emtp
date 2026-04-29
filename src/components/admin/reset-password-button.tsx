'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { resetTeamPassword } from '@/actions/admin'
import { toast } from 'sonner'
import { KeyRound, Copy, Check } from 'lucide-react'

interface Props {
  teamId: string
}

export function ResetPasswordButton({ teamId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  function handleReset() {
    startTransition(async () => {
      try {
        const data = await resetTeamPassword(teamId)
        setResult(data)
        toast.success('Password redefinida!')
      } catch (err: any) {
        toast.error(err.message ?? 'Erro ao redefinir password')
      }
    })
  }

  function copyCredentials() {
    if (!result) return
    navigator.clipboard.writeText(`Email: ${result.email}\nPassword: ${result.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (result) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{result.password}</span>
        <button onClick={copyCredentials} className="text-muted-foreground hover:text-foreground">
          {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    )
  }

  return (
    <Button size="sm" variant="outline" onClick={handleReset} disabled={isPending} className="h-7 px-2 text-xs gap-1">
      <KeyRound className="size-3" />
      {isPending ? '...' : 'Reset pass'}
    </Button>
  )
}
