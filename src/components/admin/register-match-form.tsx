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
  const [categoryId, setCategoryId] = useState('')
  const [sets, setSets] = useState([
    { challenger: '', challenged: '' },
    { challenger: '', challenged: '' },
    { challenger: '', challenged: '' },
  ])

  // Categorias únicas
  const categories = Array.from(
    new Map(
      teams.map((t) => {
        const cat = Array.isArray(t.category) ? t.category[0] : t.category
        return [t.category_id, { id: t.category_id, code: cat?.code ?? '?' }]
      })
    ).values()
  ).sort((a, b) => a.code.localeCompare(b.code))

  const categoryTeams = categoryId ? teams.filter((t) => t.category_id === categoryId) : []

  function updateSet(index: number, side: 'challenger' | 'challenged', value: string) {
    setSets((prev) => prev.map((s, i) => i === index ? { ...s, [side]: value } : s))
  }

  function reset() {
    setCategoryId('')
    setSets([{ challenger: '', challenged: '' }, { challenger: '', challenged: '' }, { challenger: '', challenged: '' }])
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('tournament_id', tournamentId)
    sets.forEach((s, i) => {
      formData.set(`set_${i + 1}_challenger`, s.challenger)
      formData.set(`set_${i + 1}_challenged`, s.challenged)
    })

    startTransition(async () => {
      try {
        await registerPastMatch(formData)
        toast.success('Jogo registado! Ranking atualizado.')
        reset()
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

          {/* 1. Categoria */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Categoria *</label>
            <div className="flex gap-2 flex-wrap">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={[
                    'px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                    categoryId === c.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-muted/50',
                  ].join(' ')}
                >
                  {c.code}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Duplas (só aparece após escolher categoria) */}
          {categoryId && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Dupla desafiante *</label>
                <select
                  name="challenger_team_id"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
                >
                  <option value="">Escolher...</option>
                  {categoryTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Dupla desafiada *</label>
                <select
                  name="challenged_team_id"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
                >
                  <option value="">Escolher...</option>
                  {categoryTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* 3. Sets */}
          {categoryId && (
            <div>
              <label className="text-xs text-muted-foreground block mb-2">Sets (desafiante — desafiada)</label>
              <div className="space-y-2">
                {sets.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-12 shrink-0">Set {i + 1}</span>
                    <input
                      type="number" min={0} max={7} placeholder="0"
                      value={s.challenger}
                      onChange={(e) => updateSet(i, 'challenger', e.target.value)}
                      className="border rounded-lg px-2 py-1.5 text-sm w-16 text-center bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
                    />
                    <span className="text-muted-foreground">—</span>
                    <input
                      type="number" min={0} max={7} placeholder="0"
                      value={s.challenged}
                      onChange={(e) => updateSet(i, 'challenged', e.target.value)}
                      className="border rounded-lg px-2 py-1.5 text-sm w-16 text-center bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
                    />
                    {i === 2 && <span className="text-xs text-muted-foreground">(super tie-break)</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Vencedor */}
          {categoryId && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Vencedor *</label>
              <div className="flex gap-2">
                {(['challenger', 'challenged'] as const).map((side) => (
                  <label key={side} className="flex-1 flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input type="radio" name="winner_team_id" value={side} required className="accent-primary" />
                    <span className="text-sm">{side === 'challenger' ? 'Desafiante' : 'Desafiada'}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 5. Data */}
          {categoryId && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data do jogo (opcional)</label>
              <input
                type="date" name="played_at"
                className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>
          )}

          {categoryId && (
            <div className="flex gap-2">
              <Button type="submit" disabled={isPending || filledSets.length < 2} className="flex-1">
                {isPending ? 'A registar...' : 'Registar jogo'}
              </Button>
              <Button type="button" variant="outline" onClick={reset} disabled={isPending}>
                Limpar
              </Button>
            </div>
          )}
          {categoryId && filledSets.length < 2 && (
            <p className="text-xs text-muted-foreground text-center">Preenche pelo menos 2 sets</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
