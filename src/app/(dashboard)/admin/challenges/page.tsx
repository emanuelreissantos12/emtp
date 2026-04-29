import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { ChallengeStatusBadge } from '@/components/challenges/challenge-status-badge'
import { daysUntilDeadline } from '@/lib/domain/challenge'
import Link from 'next/link'
import { Swords, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default async function AdminChallengesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: challenges } = await supabase
    .from('challenges')
    .select(`
      *,
      challenger_team:teams!challenges_challenger_team_id_fkey(id, name),
      challenged_team:teams!challenges_challenged_team_id_fkey(id, name),
      category:categories(code)
    `)
    .order('created_at', { ascending: false })

  const active = (challenges ?? []).filter(
    (c) => !['completed', 'cancelled', 'expired'].includes(c.status)
  )
  const history = (challenges ?? []).filter((c) =>
    ['completed', 'cancelled', 'expired'].includes(c.status)
  )

  type C = NonNullable<typeof challenges>[number]

  function ChallengeCard({ c }: { c: C }) {
    const days = daysUntilDeadline(c)
    const cat = (Array.isArray(c.category) ? c.category[0] : c.category)?.code
    const isFinished = ['completed', 'cancelled', 'expired'].includes(c.status)
    return (
      <Link href={`/challenges/${c.id}`}>
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <CardContent className="pt-3 pb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Swords className="size-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {c.challenger_team?.name}{' '}
                  <span className="text-muted-foreground font-normal">vs</span>{' '}
                  {c.challenged_team?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {cat} ·{' '}
                  {isFinished
                    ? format(new Date(c.created_at), 'dd MMM yyyy', { locale: ptBR })
                    : days > 0
                    ? `Prazo: ${days} dia${days !== 1 ? 's' : ''}`
                    : 'Prazo esgotado'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ChallengeStatusBadge status={c.status} />
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Swords className="size-6" />
          Todos os Desafios
        </h1>
        <span className="text-sm text-muted-foreground">
          {challenges?.length ?? 0} total
        </span>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Ativos {active.length > 0 && `(${active.length})`}
          </TabsTrigger>
          <TabsTrigger value="history">
            Histórico {history.length > 0 && `(${history.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 space-y-2">
          {active.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">
              Sem desafios ativos.
            </p>
          )}
          {active.map((c) => (
            <ChallengeCard key={c.id} c={c} />
          ))}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-2">
          {history.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">
              Sem histórico.
            </p>
          )}
          {history.map((c) => (
            <ChallengeCard key={c.id} c={c} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
