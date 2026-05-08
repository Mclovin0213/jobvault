import { useCallback, useRef } from 'react'
import { deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { ExternalLink, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/firebase'
import type { Application, Status, WorkArrangement } from '@/types'
import { STATUSES, WORK_ARRANGEMENTS, STATUS_LABELS } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/StatusBadge'
import { hostnameOf } from '@/lib/urls'
import { useDebouncedSaver, useReconciledDraft } from '@/lib/hooks'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type FieldUpdate = Partial<Pick<Application, 'company' | 'role' | 'salary' | 'location' | 'source' | 'notes' | 'tags'>>

function useRowSaver(id: string) {
  const pendingRef = useRef<FieldUpdate>({})
  const saver = useDebouncedSaver<FieldUpdate>(async update => {
    if (Object.keys(update).length === 0) return
    pendingRef.current = {}
    try {
      await updateDoc(doc(db, 'applications', id), update)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  })
  const queue = useCallback(
    (patch: FieldUpdate) => {
      pendingRef.current = { ...pendingRef.current, ...patch }
      saver.schedule(pendingRef.current)
    },
    [saver],
  )
  return { queue, flush: saver.flush, cancel: saver.cancel }
}

function EditableCell({
  initial,
  field,
  onChange,
  onBlur,
  placeholder,
  className,
}: {
  initial: string
  field: keyof Application
  onChange: (patch: FieldUpdate) => void
  onBlur: () => void
  placeholder?: string
  className?: string
}) {
  const draft = useReconciledDraft(initial)
  return (
    <Input
      value={draft.value}
      placeholder={placeholder}
      className={className}
      onFocus={draft.onFocus}
      onBlur={() => {
        draft.onBlur()
        onBlur()
      }}
      onChange={e => {
        draft.setValue(e.target.value)
        onChange({ [field]: e.target.value } as FieldUpdate)
      }}
    />
  )
}

function TagsCell({
  tags,
  onChange,
  onBlur,
}: {
  tags: string[]
  onChange: (patch: FieldUpdate) => void
  onBlur: () => void
}) {
  const draft = useReconciledDraft(tags.join(', '))
  return (
    <Input
      value={draft.value}
      placeholder="frontend, dream-job"
      onFocus={draft.onFocus}
      onBlur={() => {
        draft.onBlur()
        onBlur()
      }}
      onChange={e => {
        draft.setValue(e.target.value)
        const parsed = e.target.value
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
        onChange({ tags: parsed })
      }}
    />
  )
}

async function handleStatusChange(app: Application, status: Status) {
  const update: Record<string, unknown> = { status }
  if (status === 'applied' && !app.appliedAt) {
    update.appliedAt = serverTimestamp()
  }
  try {
    await updateDoc(doc(db, 'applications', app.id), update)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Update failed')
  }
}

export function ApplicationRow({ app }: { app: Application }) {
  const row = useRowSaver(app.id)

  const handleDelete = useCallback(async () => {
    if (!confirm('Delete this application?')) return
    await row.cancel()
    try {
      await deleteDoc(doc(db, 'applications', app.id))
      toast.success('Deleted')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }, [app.id, row])

  return (
    <div className="grid grid-cols-12 gap-2 border-b px-3 py-2 hover:bg-[var(--color-accent)]/40">
      <div className="col-span-12 flex items-center gap-2 md:col-span-3">
        <a
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          title={app.url}
        >
          {hostnameOf(app.url)}
          <ExternalLink className="size-3" />
        </a>
      </div>
      <div className="col-span-6 md:col-span-2">
        <EditableCell field="company" initial={app.company} placeholder="Company" onChange={row.queue} onBlur={() => void row.flush()} />
      </div>
      <div className="col-span-6 md:col-span-2">
        <EditableCell field="role" initial={app.role} placeholder="Role" onChange={row.queue} onBlur={() => void row.flush()} />
      </div>
      <div className="col-span-6 md:col-span-1">
        <EditableCell field="salary" initial={app.salary} placeholder="$" onChange={row.queue} onBlur={() => void row.flush()} />
      </div>
      <div className="col-span-6 md:col-span-1">
        <EditableCell field="location" initial={app.location} placeholder="Loc" onChange={row.queue} onBlur={() => void row.flush()} />
      </div>
      <div className="col-span-6 md:col-span-1">
        <Select
          value={app.workArrangement || '__none__'}
          onValueChange={v => {
            const next = (v === '__none__' ? '' : v) as WorkArrangement
            void updateDoc(doc(db, 'applications', app.id), { workArrangement: next })
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {WORK_ARRANGEMENTS.filter(Boolean).map(wa => (
              <SelectItem key={wa} value={wa}>
                {wa}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-6 md:col-span-1">
        <EditableCell field="source" initial={app.source} placeholder="Source" onChange={row.queue} onBlur={() => void row.flush()} />
      </div>
      <div className="col-span-12 md:col-span-1">
        <Select value={app.status} onValueChange={v => void handleStatusChange(app, v as Status)}>
          <SelectTrigger className="h-9">
            <SelectValue>
              <StatusBadge status={app.status} className="text-[11px]" />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map(s => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-12 grid grid-cols-12 gap-2 md:col-span-12 md:pl-[25%]">
        <div className="col-span-6">
          <TagsCell tags={app.tags} onChange={row.queue} onBlur={() => void row.flush()} />
        </div>
        <div className="col-span-5">
          <EditableCell field="notes" initial={app.notes} placeholder="Notes" onChange={row.queue} onBlur={() => void row.flush()} />
        </div>
        <div className="col-span-1 flex items-center justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void handleDelete()}
            title="Delete"
          >
            <Trash2 className="size-4 text-[var(--color-destructive)]" />
          </Button>
        </div>
      </div>
    </div>
  )
}
