import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChangePasswordForm } from '@/components/profile/change-password-form'
import { LogoutButton } from '@/components/profile/logout-button'
import { ThemeToggle } from '@/components/profile/theme-toggle'
import { User } from 'lucide-react'

export default async function PerfilPage() {
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

  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <User className="size-6" />
        O meu perfil
      </h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Informação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Nome:</span> {profile.name}</p>
          <p><span className="text-muted-foreground">Email:</span> {profile.email ?? user.email}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Alterar password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Aparência</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <LogoutButton />
    </div>
  )
}
