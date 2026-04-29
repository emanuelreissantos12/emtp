'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export function ChangePasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < 8) {
      toast.error('A nova password deve ter pelo menos 8 caracteres.')
      return
    }
    if (next !== confirm) {
      toast.error('As passwords não coincidem.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    // Re-autentica com a password atual para confirmar identidade
    const { data: userData } = await supabase.auth.getUser()
    const email = userData.user?.email
    if (!email) { toast.error('Erro ao obter utilizador.'); setLoading(false); return }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: current })
    if (signInError) {
      toast.error('Password atual incorreta.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: next })
    setLoading(false)

    if (error) {
      toast.error('Erro ao alterar password: ' + error.message)
      return
    }

    toast.success('Password alterada com sucesso!')
    setCurrent('')
    setNext('')
    setConfirm('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="current">Password atual</Label>
        <Input
          id="current"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="next">Nova password</Label>
        <Input
          id="next"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirmar nova password</Label>
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'A alterar...' : 'Alterar password'}
      </Button>
    </form>
  )
}
