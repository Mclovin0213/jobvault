import { useState } from 'react'
import { toast } from 'sonner'
import { parseUrlsFromPaste } from '@/lib/urls'
import { extractUrl } from '@/lib/extract'
import type { NewPendingUrl } from '@/storage/adapter'
import type { ExtractedFields, PendingUrl } from '@/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const EMPTY_EXTRACTED: ExtractedFields = {
  company: '',
  role: '',
  salary: '',
  location: '',
  workArrangement: '',
  source: '',
}

const EXTRACT_CONCURRENCY = 4

type UpdatePendingFn = (id: string, patch: Partial<PendingUrl>) => Promise<void>

async function runExtractions(
  jobs: { id: string; url: string }[],
  updatePending: UpdatePendingFn,
) {
  let i = 0
  const workers = Array.from({ length: Math.min(EXTRACT_CONCURRENCY, jobs.length) }, async () => {
    while (i < jobs.length) {
      const job = jobs[i++]
      await updatePending(job.id, { extraction: 'loading' }).catch(() => {})
      const result = await extractUrl(job.url)
      if (result.ok) {
        await updatePending(job.id, {
          extraction: 'done',
          extracted: result.extracted,
          extractError: '',
        }).catch(() => {})
      } else {
        await updatePending(job.id, {
          extraction: 'error',
          extractError: result.error,
        }).catch(() => {})
      }
    }
  })
  await Promise.all(workers)
}

export function AddLinks({
  createPending,
  updatePending,
}: {
  createPending: (inputs: NewPendingUrl[]) => Promise<PendingUrl[]>
  updatePending: UpdatePendingFn
}) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const preview = parseUrlsFromPaste(text)

  async function handleSubmit() {
    if (preview.valid.length === 0) return
    setSubmitting(true)
    try {
      const inputs: NewPendingUrl[] = preview.valid.map(url => ({
        url,
        hostname: '',
        extraction: 'idle',
        extracted: { ...EMPTY_EXTRACTED },
        extractError: '',
        addedBy: '',
        addedByName: '',
      }))
      const created = await createPending(inputs)
      if (created.length > 0) {
        toast.success(
          `Added ${created.length} to Pending — extracting…` +
            (preview.invalid.length ? ` · ${preview.invalid.length} skipped` : ''),
        )
        setText('')
        void runExtractions(
          created.map(c => ({ id: c.id, url: c.url })),
          updatePending,
        )
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add links')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Links</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Paste one URL per line. Each one lands in <span className="font-medium">Pending</span> for review — we'll auto-extract company, role, salary, etc.
        </p>
      </div>
      <Card>
        <CardContent className="p-4">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={'https://example.com/job/123\nhttps://linkedin.com/jobs/view/456'}
            className="min-h-[260px] font-mono text-sm"
          />
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-[var(--color-muted-foreground)]">
              {preview.valid.length} valid
              {preview.invalid.length ? ` · ${preview.invalid.length} invalid` : ''}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting || preview.valid.length === 0}
            >
              {submitting ? 'Adding…' : `Add ${preview.valid.length || ''}`.trim()}
            </Button>
          </div>
        </CardContent>
      </Card>
      {preview.invalid.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Skipped (not valid URLs)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs">
              {preview.invalid.slice(0, 20).map((line, i) => (
                <li key={i} className="font-mono text-[var(--color-muted-foreground)]">{line}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
