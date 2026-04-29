'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createInvite } from '@/actions/admin'
import { toast } from 'sonner'
import { Send } from 'lucide-react'

interface Props {
  teams: { id: string; name: string; category: { code: string } | null }[]
  prefillEmail?: string
  prefillTeamId?: string
}

export function InviteForm({ teams, prefillEmail, prefillTeamId }: Props) {
  const [email, setEmail] = useState(prefillEmail ?? '')
  const [teamId, setTeamId] = useState(prefillTeamId ?? 'none')
  const [role, setRole] = useState<'team_captain' | 'admin'>('team_captain')
  const [loading, setLoading] = useState(false)
  const [lastInvite, setLastInvite] = useState<{ token: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const invite = await createInvite(
        email,
        teamId === 'none' ? null : teamId,
        role
      )
      setLastInvite(invite)
      toast.success(`Convite criado para ${email}`)
      setEmail('')
      setTeamId('none')
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao criar convite')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Criar convite</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dupla (opcional)</Label>
              <Select value={teamId} onValueChange={(v: string | null) => setTeamId(v ?? 'none')}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem dupla" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem dupla</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      [{t.category?.code}] {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v: string | null) => { if (v) setRole(v as typeof role) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team_captain">Capitão</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            <Send className="size-4 mr-2" />
            {loading ? 'A criar...' : 'Criar e enviar convite'}
          </Button>
        </form>

        {lastInvite && (
          <div className="mt-3 p-2 bg-muted rounded text-xs font-mono break-all">
            Token: {lastInvite.token}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
