import type { Status } from '@/types'
import { STATUS_LABELS } from '@/types'
import { Badge } from '@/components/ui/badge'
import { STATUS_BADGE } from '@/lib/statusColors'
import { cn } from '@/lib/utils'

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge className={cn('font-medium', STATUS_BADGE[status], className)}>{STATUS_LABELS[status]}</Badge>
  )
}
