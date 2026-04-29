'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createTeamWithAccount } from '@/actions/admin'
import { toast } from 'sonner'
import { UserPlus, Copy, Check } from 'lucide-react'

interface Category {
  id: string
  code: string
  name: string
}

interface Props {
  tournamentId: string
  categories: Category[]
}

export function AddTeamForm({ tournamentId, categories }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('tournament_id', tournamentId)
    startTransition(async () => {
      try {
        const result = await createTeamWithAccount(formData)
        setCreated({ email: formData.get('player1_email') as string, password: result.password })
        toast.success('Dupla criada com sucesso!')
      } catch (err: any) {
        toast.error(err.message ?? 'Erro ao criar dupla')
      }
    })
  }

  function copyCredentials() {
    if (!created) return
    navigator.clipboard.writeText(`Email: ${created.email}\nPassword: ${created.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-2">
        <UserPlus className="size-4" />
        Nova dupla
      </Button>
    )
  }

  if (created) {
    return (
      <Card className="border-green-400">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-green-700 dark:text-green-400">Dupla criada!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-muted rounded-lg p-3 font-mono text-sm space-y-1">
            <p><span className="text-muted-foreground">Email:</span> {created.email}</p>
            <p><span className="text-muted-foreground">Password:</span> {created.password}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copyCredentials} className="gap-1.5">
              {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
              {copied ? 'Copiado!' : 'Copiar credenciais'}
            </Button>
            <Button size="sm" onClick={() => { setCreated(null); setOpen(false) }}>
              Fechar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus className="size-4" />
          Nova dupla
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Categoria *</label>
              <select
                name="category_id"
                required
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">Escolher...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nome da dupla *</label>
              <input
                name="name"
                required
                placeholder="Ex: Silva / Ferreira"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nome jogador 1 *</label>
              <input
                name="player1_name"
                required
                placeholder="Nome completo"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Email jogador 1 * (login)</label>
              <input
                name="player1_email"
                type="email"
                required
                placeholder="email@exemplo.com"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nome jogador 2</label>
              <input
                name="player2_name"
                placeholder="Nome completo"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Email jogador 2</label>
              <input
                name="player2_email"
                type="email"
                placeholder="email@exemplo.com"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? 'A criar...' : 'Criar dupla e conta'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
