'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { overrideResult } from '@/actions/challenges'
import { parseMatchResult } from '@/lib/domain/result'
import { toast } from 'sonner'
import { ShieldAlert } from 'lucide-react'
import type { SetScore } from '@/lib/domain/result'

interface Props {
  challengeId: string
  challengerTeamId: string
  challengedTeamId: string
  challengerName: string
  challengedName: string
}

const EMPTY_SET: SetScore = { challenger: 0, challenged: 0 }

export function AdminResultOverride({
  challengeId,
  challengerTeamId,
  challengedTeamId,
  challengerName,
  challengedName,
}: Props) {
  const [open, setOpen] = useState(false)
  const [sets, setSets] = useState<SetScore[]>([{ ...EMPTY_SET }, { ...EMPTY_SET }])
  const [winner, setWinner] = useState<'challenger' | 'challenged'>('challenger')
  const [loading, setLoading] = useState(false)

  function updateSet(index: number, field: keyof SetScore, value: string) {
    const parsed = parseInt(value, 10)
    if (isNaN(parsed) || parsed < 0) return
    setSets((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: parsed }
      const s1 = next[0].challenger > next[0].challenged ? 'c' : 'd'
      const s2 = next[1].challenger > next[1].challenged ? 'c' : 'd'
      const needsThird =
        s1 !== s2 &&
        (next[0].challenger > 0 || next[0].challenged > 0) &&
        (next[1].challenger > 0 || next[1].challenged > 0)
      if (needsThird && next.length === 2) next.push({ ...EMPTY_SET })
      if (!needsThird && next.length === 3) next.splice(2, 1)
      return next
    })
  }

  async function handleSave() {
    const winnerTeamId = winner === 'challenger' ? challengerTeamId : challengedTeamId
    const result = parseMatchResult(sets)
    if (!result.valid) {
      toast.error(result.error ?? 'Resultado inválido')
      return
    }
    setLoading(true)
    try {
      await overrideResult(challengeId, winnerTeamId, sets)
      toast.success('Resultado corrigido com sucesso.')
      setOpen(false)
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao corrigir resultado')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="border-red-300 text-red-700 hover:bg-red-50"
        onClick={() => setOpen(true)}
      >
        <ShieldAlert className="size-3.5 mr-1.5" />
        Corrigir resultado (admin)
      </Button>
    )
  }

  return (
    <Card className="border-red-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-red-700">
          <ShieldAlert className="size-4" />
          Correção de resultado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vencedor */}
        <div className="space-y-1.5">
          <Label className="text-xs">Vencedor</Label>
          <div className="flex gap-2">
            {(['challenger', 'challenged'] as const).map((side) => {
              const name = side === 'challenger' ? challengerName : challengedName
              const isSelected = winner === side
              return (
                <button
                  key={side}
                  type="button"
                  onClick={() => setWinner(side)}
                  className={[
                    'flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted/50',
                  ].join(' ')}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sets */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs text-muted-foreground text-center">
          <span className="font-medium truncate">{challengerName}</span>
          <span>vs</span>
          <span className="font-medium truncate">{challengedName}</span>
        </div>

        {sets.map((set, i) => (
          <div key={i}>
            <Label className="text-xs mb-1 block">
              {i === 2 ? 'Super Tie-Break' : `Set ${i + 1}`}
            </Label>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Input
                type="number"
                min={0}
                max={i === 2 ? 99 : 7}
                value={set.challenger}
                onChange={(e) => updateSet(i, 'challenger', e.target.value)}
                className="text-center text-lg font-bold"
              />
              <span className="text-muted-foreground font-bold">–</span>
              <Input
                type="number"
                min={0}
                max={i === 2 ? 99 : 7}
                value={set.challenged}
                onChange={(e) => updateSet(i, 'challenged', e.target.value)}
                className="text-center text-lg font-bold"
              />
            </div>
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <Button onClick={handleSave} disabled={loading} className="flex-1">
            {loading ? 'A guardar...' : 'Guardar correção'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
