import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SlotCreateForm } from '@/components/admin/slot-create-form'
import { Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const SLOT_STATUS_LABEL: Record<string, string> = {
  free: 'Livre',
  proposed: 'Proposto',
  reserved: 'Reservado',
  closed: 'Fechado',
  completed: 'Concluído',
}

const SLOT_STATUS_CLASS: Record<string, string> = {
  free: 'bg-green-100 text-green-800 border-0',
  proposed: 'bg-yellow-100 text-yellow-800 border-0',
  reserved: 'bg-blue-100 text-blue-800 border-0',
  closed: 'bg-orange-100 text-orange-800 border-0',
  completed: 'bg-gray-100 text-gray-600 border-0',
}

export default async function AdminSlotsPage() {
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

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, season')
    .in('status', ['active', 'draft'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: courts } = await supabase
    .from('courts')
    .select('id, name')
    .eq('active', true)
    .order('name')

  const now = new Date()
  const twoWeeksLater = new Date()
  twoWeeksLater.setDate(twoWeeksLater.getDate() + 14)

  const { data: slots } = await supabase
    .from('schedule_slots')
    .select(`
      *,
      court:courts(name),
      challenge:challenges(
        id,
        challenger_team:teams!challenges_challenger_team_id_fkey(name),
        challenged_team:teams!challenges_challenged_team_id_fkey(name)
      )
    `)
    .gte('starts_at', now.toISOString())
    .lte('starts_at', twoWeeksLater.toISOString())
    .order('starts_at')

  const { data: pastSlots } = await supabase
    .from('schedule_slots')
    .select('*, court:courts(name)')
    .lt('starts_at', now.toISOString())
    .in('status', ['free', 'proposed', 'reserved'])
    .order('starts_at', { ascending: false })
    .limit(10)

  type Slot = NonNullable<typeof slots>[number]

  function SlotCard({ slot }: { slot: Slot }) {
    const court = Array.isArray(slot.court) ? slot.court[0] : slot.court
    const challenge = Array.isArray(slot.challenge) ? slot.challenge[0] : slot.challenge
    return (
      <Card>
        <CardContent className="pt-3 pb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">
                {format(new Date(slot.starts_at), "EEE dd MMM, HH:mm", { locale: ptBR })}
                {' – '}
                {format(new Date(slot.ends_at), "HH:mm")}
              </span>
              <Badge className={`text-xs ${SLOT_STATUS_CLASS[slot.status] ?? ''}`}>
                {SLOT_STATUS_LABEL[slot.status] ?? slot.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {court?.name}
              {challenge && (
                <> · {challenge.challenger_team?.name} vs {challenge.challenged_team?.name}</>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Clock className="size-6" />
        Horários
      </h1>

      {tournament && (courts?.length ?? 0) > 0 && (
        <SlotCreateForm
          tournamentId={tournament.id}
          courts={courts ?? []}
        />
      )}

      {(pastSlots?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-2 text-orange-600">
            Horários passados por fechar
          </h2>
          <div className="space-y-2">
            {pastSlots!.map((s: any) => (
              <SlotCard key={s.id} slot={s} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-base font-semibold mb-2">
          Próximas 2 semanas
          {slots && slots.length > 0 && (
            <span className="text-muted-foreground font-normal text-sm ml-2">
              ({slots.length} horário{slots.length !== 1 ? 's' : ''})
            </span>
          )}
        </h2>
        {(slots?.length ?? 0) === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            Sem horários nas próximas 2 semanas.
          </p>
        )}
        <div className="space-y-2">
          {(slots ?? []).map((s) => (
            <SlotCard key={s.id} slot={s} />
          ))}
        </div>
      </div>
    </div>
  )
}
