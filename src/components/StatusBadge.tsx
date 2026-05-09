import type { Status } from '@/types'
import { STATUS_LABELS } from '@/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_CLASS: Record<Status, string> = {
  pending:
    'bg-zinc-500/15 text-zinc-700 ring-1 ring-inset ring-zinc-500/25 dark:text-zinc-200 dark:ring-zinc-400/25',
  applied:
    'bg-indigo-500/15 text-indigo-700 ring-1 ring-inset ring-indigo-500/30 dark:text-indigo-200 dark:ring-indigo-400/30',
  interview:
    'bg-violet-500/15 text-violet-700 ring-1 ring-inset ring-violet-500/30 dark:text-violet-200 dark:ring-violet-400/30',
  offer:
    'bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-200 dark:ring-emerald-400/30',
  rejected:
    'bg-rose-500/15 text-rose-700 ring-1 ring-inset ring-rose-500/30 dark:text-rose-200 dark:ring-rose-400/30',
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge className={cn('font-medium', STATUS_CLASS[status], className)}>{STATUS_LABELS[status]}</Badge>
  )
}
