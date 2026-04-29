import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/navbar'
import type { Profile } from '@/types/database'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profile.id)
    .is('read_at', null)

  return (
    <div className="flex flex-col min-h-screen">
      <div className="fixed inset-0 bg-background/80 dark:bg-background/88 backdrop-blur-[2px] -z-10" />
      <Navbar profile={profile as Profile} unreadCount={unreadCount ?? 0} />
      <main className="flex-1 container mx-auto px-4 py-6 pb-24 md:pb-6 max-w-4xl">
        {children}
      </main>
    </div>
  )
}
