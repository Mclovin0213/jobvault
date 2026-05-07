import { useRef, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function useDebouncedFieldUpdate(id: string, field: keyof Application) {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  return (value: string | string[]) => {
    if (timeout.current) clearTimeout(timeout.current)
    timeout.current = setTimeout(() => {
      void updateDoc(doc(db, 'applications', id), { [field]: value }).catch(e => {
        toast.error(e instanceof Error ? e.message : 'Save failed')
      })
    }, 500)
  }
}

function EditableCell({
  initial,
  field,
  id,
  placeholder,
  className,
}: {
  initial: string
  field: keyof Application
  id: string
  placeholder?: string
  className?: string
}) {
  const [value, setValue] = useState(initial)
  const debouncedSave = useDebouncedFieldUpdate(id, field)
  return (
    <Input
      value={value}
      placeholder={placeholder}
      onChange={e => {
        setValue(e.target.value)
        debouncedSave(e.target.value)
      }}
      className={className}
    />
  )
}

function TagsCell({ id, tags }: { id: string; tags: string[] }) {
  const [value, setValue] = useState(tags.join(', '))
  const debouncedSave = useDebouncedFieldUpdate(id, 'tags')
  return (
    <Input
      value={value}
      placeholder="frontend, dream-job"
      onChange={e => {
        setValue(e.target.value)
        const parsed = e.target.value
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
        debouncedSave(parsed)
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

async function handleDelete(id: string) {
  if (!confirm('Delete this application?')) return
  try {
    await deleteDoc(doc(db, 'applications', id))
    toast.success('Deleted')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Delete failed')
  }
}

export function ApplicationRow({ app }: { app: Application }) {
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
        <EditableCell id={app.id} field="company" initial={app.company} placeholder="Company" />
      </div>
      <div className="col-span-6 md:col-span-2">
        <EditableCell id={app.id} field="role" initial={app.role} placeholder="Role" />
      </div>
      <div className="col-span-6 md:col-span-1">
        <EditableCell id={app.id} field="salary" initial={app.salary} placeholder="$" />
      </div>
      <div className="col-span-6 md:col-span-1">
        <EditableCell id={app.id} field="location" initial={app.location} placeholder="Loc" />
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
        <EditableCell id={app.id} field="source" initial={app.source} placeholder="Source" />
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
          <TagsCell id={app.id} tags={app.tags} />
        </div>
        <div className="col-span-5">
          <EditableCell id={app.id} field="notes" initial={app.notes} placeholder="Notes" />
        </div>
        <div className="col-span-1 flex items-center justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void handleDelete(app.id)}
            title="Delete"
          >
            <Trash2 className="size-4 text-[var(--color-destructive)]" />
          </Button>
        </div>
      </div>
    </div>
  )
}
