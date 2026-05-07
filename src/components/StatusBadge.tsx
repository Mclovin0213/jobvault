import type { Status } from '@/types'
import { STATUS_LABELS } from '@/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_CLASS: Record<Status, string> = {
  pending: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100',
  applied: 'bg-blue-200 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100',
  interview: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100',
  offer: 'bg-teal-200 text-teal-900 dark:bg-teal-900/60 dark:text-teal-100',
  rejected: 'bg-rose-200 text-rose-900 dark:bg-rose-900/60 dark:text-rose-100',
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge className={cn(STATUS_CLASS[status], className)}>{STATUS_LABELS[status]}</Badge>
  )
}
