import { useCallback, useEffect, useRef, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { Check, ExternalLink, Loader2, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import type { User } from 'firebase/auth'
import { db } from '@/firebase'
import { extractUrl } from '@/lib/extract'
import type { ExtractedFields, PendingUrl, WorkArrangement } from '@/types'
import { WORK_ARRANGEMENTS } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDebouncedSaver, useReconciledDraft } from '@/lib/hooks'
import { cn } from '@/lib/utils'

function StatusPill({ p }: { p: PendingUrl }) {
  if (p.extraction === 'loading') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[11px]">
        <Loader2 className="size-3 animate-spin" /> extracting
      </span>
    )
  }
  if (p.extraction === 'error') {
    return (
      <span
        title={p.extractError}
        className="inline-flex items-center gap-1 rounded-full bg-[var(--color-destructive)]/15 px-2 py-0.5 text-[11px] text-[var(--color-destructive)]"
      >
        <TriangleAlert className="size-3" /> failed
      </span>
    )
  }
  if (p.extraction === 'done') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/15 px-2 py-0.5 text-[11px]">
        <Check className="size-3" /> ready
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[11px] text-[var(--color-muted-foreground)]">
      queued
    </span>
  )
}

async function reject(id: string) {
  if (!confirm('Reject and discard this link?')) return
  try {
    await deleteDoc(doc(db, 'pendingUrls', id))
    toast.success('Rejected')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Reject failed')
  }
}

function ExtractedCell({
  remote,
  onChange,
  onBlur,
  placeholder,
}: {
  remote: string
  onChange: (value: string) => void
  onBlur: () => void
  placeholder?: string
}) {
  const draft = useReconciledDraft(remote)
  return (
    <Input
      value={draft.value}
      placeholder={placeholder}
      onFocus={draft.onFocus}
      onBlur={() => {
        draft.onBlur()
        onBlur()
      }}
      onChange={e => {
        draft.setValue(e.target.value)
        onChange(e.target.value)
      }}
    />
  )
}

function PendingRow({ p, user }: { p: PendingUrl; user: User }) {
  const [busy, setBusy] = useState<'approve' | 'reextract' | null>(null)
  const pendingPatchRef = useRef<Partial<ExtractedFields>>({})
  const latestExtractedRef = useRef<ExtractedFields>(p.extracted)
  useEffect(() => {
    latestExtractedRef.current = { ...p.extracted, ...pendingPatchRef.current }
  }, [p.extracted])

  const saver = useDebouncedSaver<Partial<ExtractedFields>>(async patch => {
    if (Object.keys(patch).length === 0) return
    pendingPatchRef.current = {}
    const update: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(patch)) update[`extracted.${k}`] = v
    try {
      await updateDoc(doc(db, 'pendingUrls', p.id), update)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  })

  const queue = useCallback(
    <K extends keyof ExtractedFields>(field: K, value: ExtractedFields[K]) => {
      pendingPatchRef.current = { ...pendingPatchRef.current, [field]: value }
      latestExtractedRef.current = { ...latestExtractedRef.current, [field]: value }
      saver.schedule(pendingPatchRef.current)
    },
    [saver],
  )

  const approve = useCallback(async () => {
    await saver.flush()
    const draft: ExtractedFields = latestExtractedRef.current
    pendingPatchRef.current = {}
    const batch = writeBatch(db)
    const newRef = doc(collection(db, 'applications'))
    batch.set(newRef, {
      url: p.url,
      company: draft.company ?? '',
      role: draft.role ?? '',
      salary: draft.salary ?? '',
      location: draft.location ?? '',
      workArrangement: draft.workArrangement ?? '',
      source: draft.source ?? '',
      tags: [],
      status: 'pending',
      notes: '',
      deadline: null,
      followUpDate: null,
      appliedAt: null,
      createdAt: serverTimestamp(),
      addedBy: p.addedBy || user.uid,
      addedByName: p.addedByName || (user.displayName ?? user.email ?? 'Unknown'),
    })
    batch.delete(doc(db, 'pendingUrls', p.id))
    try {
      await batch.commit()
      toast.success('Approved → moved to Applications')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approve failed')
    }
  }, [p, user, saver])

  const reextract = useCallback(async () => {
    await saver.flush()
    const ref = doc(db, 'pendingUrls', p.id)
    await updateDoc(ref, { extraction: 'loading', extractError: '' }).catch(() => {})
    const result = await extractUrl(p.url)
    if (result.ok) {
      latestExtractedRef.current = result.extracted
      pendingPatchRef.current = {}
      await updateDoc(ref, {
        extraction: 'done',
        extracted: result.extracted,
        extractError: '',
      }).catch(e => toast.error(e instanceof Error ? e.message : 'Save failed'))
    } else {
      await updateDoc(ref, {
        extraction: 'error',
        extractError: result.error,
      }).catch(() => {})
      toast.error(`Extract failed: ${result.error}`)
    }
  }, [p.id, p.url, saver])

  const handleReject = useCallback(async () => {
    await saver.cancel()
    pendingPatchRef.current = {}
    await reject(p.id)
  }, [p.id, saver])

  const hostLink = (
    <a
      href={p.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1 truncate text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      title={p.url}
    >
      <span className="truncate">{p.hostname || p.url}</span>
      <ExternalLink className="size-3 shrink-0" />
    </a>
  )

  const workArrangementSelect = (
    <Select
      value={p.extracted.workArrangement || '__none__'}
      onValueChange={v => {
        const next = (v === '__none__' ? '' : v) as WorkArrangement
        queue('workArrangement', next)
        void saver.flush()
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
  )

  const actionButtons = (
    <>
      <Button
        variant="ghost"
        size="icon"
        title="Re-extract"
        disabled={busy !== null || p.extraction === 'loading'}
        onClick={async () => {
          setBusy('reextract')
          await reextract()
          setBusy(null)
        }}
      >
        <RefreshCw className={cn('size-4', busy === 'reextract' && 'animate-spin')} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Approve"
        disabled={busy !== null}
        onClick={async () => {
          setBusy('approve')
          await approve()
          setBusy(null)
        }}
      >
        <Check className="size-4 text-[var(--color-primary)]" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Reject"
        disabled={busy !== null}
        onClick={() => void handleReject()}
      >
        <Trash2 className="size-4 text-[var(--color-destructive)]" />
      </Button>
    </>
  )

  const errorBlock =
    p.extraction === 'error' && p.extractError ? (
      <div className="text-[11px] text-[var(--color-destructive)]">{p.extractError}</div>
    ) : null

  return (
    <>
      {/* Mobile: stacked card */}
      <div className="flex flex-col gap-2 border-b px-3 py-3 md:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">{hostLink}</div>
          <StatusPill p={p} />
        </div>
        <ExtractedCell
          remote={p.extracted.company}
          placeholder="Company"
          onChange={v => queue('company', v)}
          onBlur={() => void saver.flush()}
        />
        <ExtractedCell
          remote={p.extracted.role}
          placeholder="Role"
          onChange={v => queue('role', v)}
          onBlur={() => void saver.flush()}
        />
        <div className="grid grid-cols-2 gap-2">
          <ExtractedCell
            remote={p.extracted.salary}
            placeholder="Salary"
            onChange={v => queue('salary', v)}
            onBlur={() => void saver.flush()}
          />
          <ExtractedCell
            remote={p.extracted.location}
            placeholder="Location"
            onChange={v => queue('location', v)}
            onBlur={() => void saver.flush()}
          />
          {workArrangementSelect}
          <ExtractedCell
            remote={p.extracted.source}
            placeholder="Source"
            onChange={v => queue('source', v)}
            onBlur={() => void saver.flush()}
          />
        </div>
        {errorBlock}
        <div className="flex justify-end gap-1">{actionButtons}</div>
      </div>

      {/* Desktop: existing 12-col grid */}
      <div className="hidden grid-cols-12 gap-2 border-b px-3 py-3 hover:bg-[var(--color-accent)]/40 md:grid">
        <div className="col-span-3 flex items-center gap-2">
          {hostLink}
          <StatusPill p={p} />
        </div>
        <div className="col-span-2">
          <ExtractedCell
            remote={p.extracted.company}
            placeholder="Company"
            onChange={v => queue('company', v)}
            onBlur={() => void saver.flush()}
          />
        </div>
        <div className="col-span-2">
          <ExtractedCell
            remote={p.extracted.role}
            placeholder="Role"
            onChange={v => queue('role', v)}
            onBlur={() => void saver.flush()}
          />
        </div>
        <div className="col-span-1">
          <ExtractedCell
            remote={p.extracted.salary}
            placeholder="$"
            onChange={v => queue('salary', v)}
            onBlur={() => void saver.flush()}
          />
        </div>
        <div className="col-span-1">
          <ExtractedCell
            remote={p.extracted.location}
            placeholder="Loc"
            onChange={v => queue('location', v)}
            onBlur={() => void saver.flush()}
          />
        </div>
        <div className="col-span-1">{workArrangementSelect}</div>
        <div className="col-span-1">
          <ExtractedCell
            remote={p.extracted.source}
            placeholder="Source"
            onChange={v => queue('source', v)}
            onBlur={() => void saver.flush()}
          />
        </div>
        <div className="col-span-1 flex items-center justify-end gap-1">{actionButtons}</div>
        {p.extraction === 'error' && p.extractError ? (
          <div className="col-span-12 text-[11px] text-[var(--color-destructive)]">
            {p.extractError}
          </div>
        ) : null}
      </div>
    </>
  )
}

export function Pending({
  user,
  pending,
  loading,
}: {
  user: User
  pending: PendingUrl[]
  loading: boolean
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <div className="flex items-baseline gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pending</h1>
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {pending.length} awaiting review
        </span>
      </div>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Auto-extracted from each URL. Approve to move into Applications, or reject to discard.
      </p>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-sm text-[var(--color-muted-foreground)]">
              Loading…
            </div>
          ) : pending.length === 0 ? (
            <div className="p-10 text-center text-sm text-[var(--color-muted-foreground)]">
              Nothing pending. Paste links in Add Links to queue them up.
            </div>
          ) : (
            <div className="divide-y">
              {pending.map(p => (
                <PendingRow key={p.id} p={p} user={user} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
