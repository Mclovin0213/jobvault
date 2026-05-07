import { useMemo } from 'react'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/firebase'
import type { Application, Status } from '@/types'
import { STATUSES, STATUS_LABELS } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { hostnameOf } from '@/lib/urls'
import { cn } from '@/lib/utils'

const COLUMN_TINTS: Record<Status, string> = {
  pending: 'bg-zinc-50 dark:bg-zinc-900/50',
  applied: 'bg-blue-50 dark:bg-blue-950/30',
  interview: 'bg-emerald-50 dark:bg-emerald-950/30',
  offer: 'bg-teal-50 dark:bg-teal-950/30',
  rejected: 'bg-rose-50 dark:bg-rose-950/30',
}

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
        'cursor-grab rounded-md border bg-[var(--color-card)] p-3 text-sm shadow-sm transition-shadow hover:shadow-md',
        isDragging && 'opacity-50 shadow-lg',
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

function Column({ status, apps }: { status: Status; apps: Application[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: status })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex h-full min-h-[400px] w-72 shrink-0 flex-col rounded-lg border p-3 transition-colors',
        COLUMN_TINTS[status],
        isOver && 'ring-2 ring-[var(--color-ring)]',
      )}
    >
      <div className="mb-2 flex items-center justify-between text-sm font-medium">
        <span>{STATUS_LABELS[status]}</span>
        <span className="text-xs text-[var(--color-muted-foreground)]">{apps.length}</span>
      </div>
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
    </div>
  )
}

export function Kanban({ apps }: { apps: Application[] }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
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
    const update: Record<string, unknown> = { status: target }
    if (target === 'applied' && !app.appliedAt) {
      update.appliedAt = serverTimestamp()
    }
    try {
      await updateDoc(doc(db, 'applications', app.id), update)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Move failed')
    }
  }

  return (
    <div className="mx-auto max-w-[100rem] space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Kanban</h1>
      <Card>
        <CardContent className="p-3">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {STATUSES.map(s => (
                <Column key={s} status={s} apps={grouped[s]} />
              ))}
            </div>
          </DndContext>
        </CardContent>
      </Card>
    </div>
  )
}
