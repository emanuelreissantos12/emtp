'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      toast.error('Email ou password incorretos.')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: "url('/padel-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo / título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-white/10 backdrop-blur border border-white/20 mb-4">
            <span className="text-2xl font-black text-white tracking-tight">EM</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">EMTP</h1>
          <p className="text-white/70 text-sm mt-1">Torneio Escada 2026</p>
        </div>

        {/* Formulário */}
        <div className="bg-white/10 dark:bg-black/30 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/90 text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="o.teu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-white/90 text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/30"
              />
            </div>
            <Button
              type="submit"
              className="w-full mt-2 bg-white text-black hover:bg-white/90 font-semibold"
              disabled={loading}
            >
              {loading ? 'A entrar...' : 'Entrar'}
            </Button>
          </form>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          Escola Municipal de Ténis e Padel · Oliveira do Bairro
        </p>
      </div>
    </div>
  )
}
