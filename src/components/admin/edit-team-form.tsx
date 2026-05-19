'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { editTeam } from '@/actions/admin'
import { toast } from 'sonner'
import { Pencil, X } from 'lucide-react'

interface Props {
  team: {
    id: string
    name: string
    player1_name: string
    player1_email: string
    player2_name: string
    player2_email: string
  }
}

export function EditTeamForm({ team }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: team.name,
    player1_name: team.player1_name,
    player1_email: team.player1_email,
    player2_name: team.player2_name,
    player2_email: team.player2_email,
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await editTeam(team.id, form)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Dupla atualizada.')
        setOpen(false)
      }
    })
  }

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="h-7 px-2">
        <Pencil className="size-3.5 mr-1" />
        Editar
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 border rounded-lg p-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Editar dupla</p>
        <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <Label className="text-xs">Nome da dupla</Label>
          <Input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="h-8 text-sm mt-1"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Jogador 1 — nome</Label>
            <Input
              value={form.player1_name}
              onChange={e => setForm(f => ({ ...f, player1_name: e.target.value }))}
              className="h-8 text-sm mt-1"
              required
            />
          </div>
          <div>
            <Label className="text-xs">Jogador 1 — email</Label>
            <Input
              type="email"
              value={form.player1_email}
              onChange={e => setForm(f => ({ ...f, player1_email: e.target.value }))}
              className="h-8 text-sm mt-1"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Jogador 2 — nome</Label>
            <Input
              value={form.player2_name}
              onChange={e => setForm(f => ({ ...f, player2_name: e.target.value }))}
              className="h-8 text-sm mt-1"
              required
            />
          </div>
          <div>
            <Label className="text-xs">Jogador 2 — email</Label>
            <Input
              type="email"
              value={form.player2_email}
              onChange={e => setForm(f => ({ ...f, player2_email: e.target.value }))}
              className="h-8 text-sm mt-1"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'A guardar...' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
