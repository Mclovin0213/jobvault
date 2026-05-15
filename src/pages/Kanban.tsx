import { useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ExternalLink } from 'lucide-react'
import type { Application, Status } from '@/types'
import { STATUSES, STATUS_LABELS } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { hostnameOf } from '@/lib/urls'
import { STATUS_COLUMN_TINT, STATUS_DOT } from '@/lib/statusColors'
import { cn } from '@/lib/utils'

function KanbanCard({ app }: { app: Application }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: app.id,
  })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm shadow-sm transition-all hover:border-[var(--color-primary)]/40 hover:shadow-[0_8px_20px_-8px_oklch(0.55_0.22_275/0.35)]',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-[var(--color-primary)]/40',
      )}
    >
      <div className="font-medium">{app.company || 'Untitled'}</div>
      {app.role ? (
        <div className="text-xs text-[var(--color-muted-foreground)]">{app.role}</div>
      ) : null}
      <a
        href={app.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        {hostnameOf(app.url)} <ExternalLink className="size-3" />
      </a>
    </div>
  )
}

function ColumnBody({ apps }: { apps: Application[] }) {
  return (
    <div className="flex flex-col gap-2">
      {apps.map(a => (
        <KanbanCard key={a.id} app={a} />
      ))}
      {apps.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-center text-xs text-[var(--color-muted-foreground)]">
          Drop here
        </div>
      ) : null}
    </div>
  )
}

function Column({ status, apps }: { status: Status; apps: Application[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: status })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex h-full min-h-[400px] w-72 shrink-0 flex-col rounded-lg border border-[var(--color-border)] p-3 transition-colors',
        STATUS_COLUMN_TINT[status],
        isOver && 'ring-2 ring-[var(--color-primary)]/50',
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className={cn('size-2 rounded-full', STATUS_DOT[status])} />
          <span>{STATUS_LABELS[status]}</span>
        </div>
        <span className="rounded-full bg-[var(--color-background)]/60 px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--color-muted-foreground)]">
          {apps.length}
        </span>
      </div>
      <ColumnBody apps={apps} />
    </div>
  )
}

function MobileTab({
  status,
  count,
  active,
  onSelect,
}: {
  status: Status
  count: number
  active: boolean
  onSelect: () => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status })
  return (
    <button
      ref={setNodeRef}
      onClick={onSelect}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
        active
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
          : 'border-[var(--color-border)] text-[var(--color-muted-foreground)]',
        isOver && 'ring-2 ring-[var(--color-primary)]/60',
      )}
    >
      <span className={cn('size-2 rounded-full', STATUS_DOT[status])} />
      <span>{STATUS_LABELS[status]}</span>
      <span className="rounded-full bg-[var(--color-background)]/60 px-1.5 text-[10px] tabular-nums">
        {count}
      </span>
    </button>
  )
}

export function Kanban({
  apps,
  updateApp,
}: {
  apps: Application[]
  updateApp: (id: string, patch: Partial<Application>) => Promise<void>
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [mobileStatus, setMobileStatus] = useState<Status>('pending')
  const grouped = useMemo(() => {
    const g: Record<Status, Application[]> = {
      pending: [],
      applied: [],
      interview: [],
      offer: [],
      rejected: [],
    }
    for (const a of apps) g[a.status].push(a)
    return g
  }, [apps])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const target = over.id as Status
    if (!STATUSES.includes(target)) return
    const app = apps.find(a => a.id === active.id)
    if (!app || app.status === target) return
    await updateApp(app.id, { status: target })
  }

  return (
    <div className="mx-auto max-w-[100rem] space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Kanban</h1>
      <Card>
        <CardContent className="p-3">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="hidden gap-3 overflow-x-auto pb-2 md:flex">
              {STATUSES.map(s => (
                <Column key={s} status={s} apps={grouped[s]} />
              ))}
            </div>
            <div className="md:hidden">
              <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {STATUSES.map(s => (
                  <MobileTab
                    key={s}
                    status={s}
                    count={grouped[s].length}
                    active={mobileStatus === s}
                    onSelect={() => setMobileStatus(s)}
                  />
                ))}
              </div>
              <div
                className={cn(
                  'min-h-[400px] rounded-lg border border-[var(--color-border)] p-3',
                  STATUS_COLUMN_TINT[mobileStatus],
                )}
              >
                <ColumnBody apps={grouped[mobileStatus]} />
              </div>
              <p className="mt-2 text-center text-[11px] text-[var(--color-muted-foreground)]">
                Drag a card onto a status pill to move it.
              </p>
            </div>
          </DndContext>
        </CardContent>
      </Card>
    </div>
  )
}
