'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { registerPastMatch } from '@/actions/admin'
import { toast } from 'sonner'

interface Team {
  id: string
  name: string
  category_id: string
  category: { code: string } | { code: string }[] | null
}

interface Props {
  tournamentId: string
  teams: Team[]
}

export function RegisterMatchForm({ tournamentId, teams }: Props) {
  const [isPending, startTransition] = useTransition()
  const [challengerTeamId, setChallengerTeamId] = useState('')
  const [sets, setSets] = useState([
    { challenger: '', challenged: '' },
    { challenger: '', challenged: '' },
    { challenger: '', challenged: '' },
  ])

  // Filtra a equipa adversária para ser da mesma categoria
  const challengerTeam = teams.find((t) => t.id === challengerTeamId)
  const eligibleOpponents = challengerTeamId
    ? teams.filter((t) => t.id !== challengerTeamId && t.category_id === challengerTeam?.category_id)
    : []

  function updateSet(index: number, side: 'challenger' | 'challenged', value: string) {
    setSets((prev) => prev.map((s, i) => i === index ? { ...s, [side]: value } : s))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('tournament_id', tournamentId)
    // Adiciona os sets preenchidos
    sets.forEach((s, i) => {
      formData.set(`set_${i + 1}_challenger`, s.challenger)
      formData.set(`set_${i + 1}_challenged`, s.challenged)
    })

    startTransition(async () => {
      try {
        await registerPastMatch(formData)
        toast.success('Jogo registado! Ranking atualizado.')
        // Reset
        setChallengerTeamId('')
        setSets([{ challenger: '', challenged: '' }, { challenger: '', challenged: '' }, { challenger: '', challenged: '' }])
        ;(e.target as HTMLFormElement).reset()
      } catch (err: any) {
        toast.error(err.message ?? 'Erro ao registar jogo')
      }
    })
  }

  const filledSets = sets.filter((s) => s.challenger !== '' && s.challenged !== '')

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Novo jogo</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Dupla desafiante *</label>
              <select
                name="challenger_team_id"
                required
                value={challengerTeamId}
                onChange={(e) => setChallengerTeamId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">Escolher...</option>
                {teams.map((t) => {
                  const cat = Array.isArray(t.category) ? t.category[0] : t.category
                  return (
                    <option key={t.id} value={t.id}>
                      [{cat?.code}] {t.name}
                    </option>
                  )
                })}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Dupla desafiada *</label>
              <select
                name="challenged_team_id"
                required
                disabled={!challengerTeamId}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
              >
                <option value="">Escolher...</option>
                {eligibleOpponents.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sets */}
          <div>
            <label className="text-xs text-muted-foreground block mb-2">Sets (desafiante — desafiada)</label>
            <div className="space-y-2">
              {sets.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-12 shrink-0">Set {i + 1}</span>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    placeholder="0"
                    value={s.challenger}
                    onChange={(e) => updateSet(i, 'challenger', e.target.value)}
                    className="border rounded-lg px-2 py-1.5 text-sm w-16 text-center bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                  <span className="text-muted-foreground">—</span>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    placeholder="0"
                    value={s.challenged}
                    onChange={(e) => updateSet(i, 'challenged', e.target.value)}
                    className="border rounded-lg px-2 py-1.5 text-sm w-16 text-center bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                  {i === 2 && <span className="text-xs text-muted-foreground">(super tie-break)</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Vencedor */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Vencedor *</label>
            <div className="flex gap-2">
              {(['challenger', 'challenged'] as const).map((side) => (
                <label key={side} className="flex-1 flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="winner_team_id"
                    value={side}
                    required
                    className="accent-primary"
                  />
                  <span className="text-sm">{side === 'challenger' ? 'Desafiante' : 'Desafiada'}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Data do jogo (opcional)</label>
            <input
              type="date"
              name="played_at"
              className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </div>

          <Button type="submit" disabled={isPending || filledSets.length < 2} className="w-full">
            {isPending ? 'A registar...' : 'Registar jogo e atualizar ranking'}
          </Button>
          {filledSets.length < 2 && (
            <p className="text-xs text-muted-foreground text-center">Preenche pelo menos 2 sets</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
