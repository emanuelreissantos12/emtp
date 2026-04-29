import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { MarkNotificationsRead } from '@/components/notifications/mark-read'
import { Bell, Swords, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const TYPE_ICON: Record<string, React.ElementType> = {
  challenge_received: Swords,
  challenge_scheduled: CheckCircle,
  result_submitted: AlertTriangle,
  result_validated: CheckCircle,
  dispute_opened: AlertTriangle,
}

export default async function NotificationsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!profile) redirect('/login')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const unreadIds = (notifications ?? [])
    .filter((n) => !n.read_at)
    .map((n) => n.id)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="size-6" />
          Notificações
        </h1>
        {unreadIds.length > 0 && (
          <MarkNotificationsRead ids={unreadIds} />
        )}
      </div>

      {(notifications?.length ?? 0) === 0 && (
        <p className="text-muted-foreground text-sm text-center py-16">
          Sem notificações.
        </p>
      )}

      <div className="space-y-2">
        {(notifications ?? []).map((n) => {
          const Icon = TYPE_ICON[n.type] ?? Info
          const isUnread = !n.read_at
          return (
            <div key={n.id}>
              {n.action_url ? (
                <Link href={n.action_url}>
                  <Card className={cn('hover:bg-muted/50 transition-colors cursor-pointer', isUnread && 'border-primary/30 bg-primary/5')}>
                    <NotificationContent n={n} Icon={Icon} isUnread={isUnread} />
                  </Card>
                </Link>
              ) : (
                <Card className={cn(isUnread && 'border-primary/30 bg-primary/5')}>
                  <NotificationContent n={n} Icon={Icon} isUnread={isUnread} />
                </Card>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NotificationContent({
  n,
  Icon,
  isUnread,
}: {
  n: { title: string; body: string; created_at: string }
  Icon: React.ElementType
  isUnread: boolean
}) {
  return (
    <CardContent className="pt-3 pb-3 flex items-start gap-3">
      <Icon className={cn('size-4 mt-0.5 shrink-0', isUnread ? 'text-primary' : 'text-muted-foreground')} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', isUnread ? 'font-semibold' : 'font-medium')}>{n.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {format(new Date(n.created_at), "dd MMM 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>
      {isUnread && (
        <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
      )}
    </CardContent>
  )
}
