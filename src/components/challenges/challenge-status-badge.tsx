import { Badge } from '@/components/ui/badge'
import type { ChallengeStatus } from '@/types/database'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<ChallengeStatus, { label: string; className: string }> = {
  negotiating:    { label: 'A negociar',        className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' },
  scheduled:      { label: 'Agendado',           className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  result_pending: { label: 'Resultado pendente', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  disputed:       { label: 'Disputado',          className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  completed:      { label: 'Concluído',          className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  cancelled:      { label: 'Cancelado',          className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  expired:        { label: 'Expirado',           className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

export function ChallengeStatusBadge({ status }: { status: ChallengeStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge className={cn('text-xs font-medium border-0', config.className)}>
      {config.label}
    </Badge>
  )
}
