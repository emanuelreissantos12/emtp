'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Tema</p>
        <p className="text-xs text-muted-foreground">{theme === 'dark' ? 'Modo escuro' : theme === 'light' ? 'Modo claro' : 'Sistema'}</p>
      </div>
      <div className="flex gap-2">
        {(['light', 'dark'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors',
              theme === t ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-muted/50',
            ].join(' ')}
          >
            {t === 'light' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            {t === 'light' ? 'Claro' : 'Escuro'}
          </button>
        ))}
      </div>
    </div>
  )
}
