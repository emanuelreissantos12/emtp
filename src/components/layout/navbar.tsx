'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types/database'
import {
  LayoutDashboard,
  Trophy,
  Swords,
  Users,
  LogOut,
  Settings,
  Bell,
  User,
} from 'lucide-react'

interface NavbarProps {
  profile: Profile
  unreadCount: number
}

const navItems = (role: Profile['role']) => [
  { href: '/', label: 'Início', icon: LayoutDashboard },
  { href: '/ranking', label: 'Ranking', icon: Trophy },
  { href: '/challenges', label: 'Desafios', icon: Swords },
  ...(role === 'admin'
    ? [{ href: '/admin', label: 'Admin', icon: Settings }]
    : []),
]

export function Navbar({ profile, unreadCount }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <>
      {/* Desktop top bar */}
      <header className="hidden md:flex h-14 items-center border-b bg-background px-6 gap-6 sticky top-0 z-40">
        <Link href="/" className="font-black text-lg tracking-tight shrink-0">
          EMTP <span className="text-muted-foreground font-normal text-sm">Escada 26</span>
        </Link>

        <nav className="flex items-center gap-1 flex-1">
          {navItems(profile.role).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                pathname === href || (href !== '/' && pathname.startsWith(href))
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/notifications" className="relative p-2 rounded-lg hover:bg-muted transition-colors">
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground text-xs rounded-full size-4 flex items-center justify-center font-medium">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="size-7">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm hidden lg:block">{profile.name.split(' ')[0]}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{profile.name}</p>
                <p className="text-xs text-muted-foreground">{profile.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/perfil')}>
                <User className="size-4 mr-2" />
                Alterar password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="size-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t flex">
        {navItems(profile.role).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </Link>
          )
        })}
        <Link
          href="/notifications"
          className={cn(
            'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs relative',
            pathname === '/notifications' ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <div className="relative">
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full size-3.5 flex items-center justify-center font-medium text-[10px]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span>Alertas</span>
        </Link>
      </nav>
    </>
  )
}
