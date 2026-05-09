import type { Status } from '@/types'

export const STATUS_BADGE: Record<Status, string> = {
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

export const STATUS_COLUMN_TINT: Record<Status, string> = {
  pending: 'bg-zinc-500/5 dark:bg-zinc-500/10',
  applied: 'bg-indigo-500/5 dark:bg-indigo-500/10',
  interview: 'bg-violet-500/5 dark:bg-violet-500/10',
  offer: 'bg-emerald-500/5 dark:bg-emerald-500/10',
  rejected: 'bg-rose-500/5 dark:bg-rose-500/10',
}

export const STATUS_DOT: Record<Status, string> = {
  pending: 'bg-zinc-500',
  applied: 'bg-indigo-500',
  interview: 'bg-violet-500',
  offer: 'bg-emerald-500',
  rejected: 'bg-rose-500',
}

export const STATUS_BORDER: Record<Status, string> = {
  pending: 'border-l-zinc-400 dark:border-l-zinc-500',
  applied: 'border-l-indigo-500',
  interview: 'border-l-violet-500',
  offer: 'border-l-emerald-500',
  rejected: 'border-l-rose-500',
}
