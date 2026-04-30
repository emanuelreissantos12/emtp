'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { submitResult } from '@/actions/challenges'
import { parseMatchResult } from '@/lib/domain/result'
import { toast } from 'sonner'
import { Trophy } from 'lucide-react'
import type { SetScore } from '@/lib/domain/result'

interface Props {
  challengeId: string
  challengerTeamId: string
  challengedTeamId: string
  challengerName: string
  challengedName: string
}

const EMPTY_SET: SetScore = { challenger: 0, challenged: 0 }

export function ResultForm({
  challengeId,
  challengerTeamId,
  challengedTeamId,
  challengerName,
  challengedName,
}: Props) {
  const [sets, setSets] = useState<SetScore[]>([
    { ...EMPTY_SET },
    { ...EMPTY_SET },
  ])
  const [loading, setLoading] = useState(false)

  // Determina se precisa de 3.º set
  const set1Winner =
    sets[0].challenger > sets[0].challenged ? 'challenger' : 'challenged'
  const set2Winner =
    sets[1].challenger > sets[1].challenged ? 'challenger' : 'challenged'
  const needs3rdSet =
    sets[0].challenger > 0 ||
    sets[0].challenged > 0 ||
    sets[1].challenger > 0 ||
    sets[1].challenged > 0
      ? set1Winner !== set2Winner
      : false

  function updateSet(index: number, field: keyof SetScore, value: string) {
    const parsed = parseInt(value, 10)
    if (isNaN(parsed) || parsed < 0) return
    setSets((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: parsed }
      // Adiciona/remove 3.º set automaticamente
      const s1 = next[0].challenger > next[0].challenged ? 'c' : 'd'
      const s2 = next[1].challenger > next[1].challenged ? 'c' : 'd'
      const needsThird = s1 !== s2 && (next[0].challenger > 0 || next[0].challenged > 0) && (next[1].challenger > 0 || next[1].challenged > 0)
      if (needsThird && next.length === 2) next.push({ ...EMPTY_SET })
      if (!needsThird && next.length === 3) next.splice(2, 1)
      return next
    })
  }

  async function handleSubmit() {
    const result = parseMatchResult(sets)
    if (!result.valid) {
      toast.error(result.error ?? 'Resultado inválido')
      return
    }

    const winnerTeamId =
      result.winner === 'challenger' ? challengerTeamId : challengedTeamId

    setLoading(true)
    try {
      await submitResult(challengeId, sets, winnerTeamId)
      toast.success('Resultado submetido com sucesso!')
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao submeter resultado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="size-4" />
          Submeter resultado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cabeçalho */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs text-muted-foreground text-center">
          <span className="font-medium truncate">{challengerName}</span>
          <span>vs</span>
          <span className="font-medium truncate">{challengedName}</span>
        </div>

        {sets.map((set, i) => (
          <div key={i}>
            <Label className="text-xs mb-1 block">
              {i === 2 ? '3.º Set' : `Set ${i + 1}`}
            </Label>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Input
                type="number"
                min={0}
                max={7}
                value={set.challenger}
                onChange={(e) => updateSet(i, 'challenger', e.target.value)}
                className="text-center text-lg font-bold"
              />
              <span className="text-muted-foreground font-bold">–</span>
              <Input
                type="number"
                min={0}
                max={7}
                value={set.challenged}
                onChange={(e) => updateSet(i, 'challenged', e.target.value)}
                className="text-center text-lg font-bold"
              />
            </div>
          </div>
        ))}

        {needs3rdSet && sets.length < 3 && (
          <p className="text-xs text-muted-foreground">
            Sets empatados 1-1 — preenche o 3.º set.
          </p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'A submeter...' : 'Submeter resultado'}
        </Button>
      </CardContent>
    </Card>
  )
}
