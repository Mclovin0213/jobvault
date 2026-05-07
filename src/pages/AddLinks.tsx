import { useState } from 'react'
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { toast } from 'sonner'
import type { User } from 'firebase/auth'
import { db } from '@/firebase'
import { parseUrlsFromPaste } from '@/lib/urls'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AddLinks({ user }: { user: User }) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const preview = parseUrlsFromPaste(text)

  async function handleSubmit() {
    if (preview.valid.length === 0) return
    setSubmitting(true)
    try {
      const chunks: string[][] = []
      for (let i = 0; i < preview.valid.length; i += 400) {
        chunks.push(preview.valid.slice(i, i + 400))
      }
      for (const chunk of chunks) {
        const batch = writeBatch(db)
        for (const url of chunk) {
          const ref = doc(collection(db, 'applications'))
          batch.set(ref, {
            url,
            company: '',
            role: '',
            salary: '',
            location: '',
            workArrangement: '',
            source: '',
            tags: [],
            status: 'pending',
            notes: '',
            deadline: null,
            followUpDate: null,
            appliedAt: null,
            createdAt: serverTimestamp(),
            addedBy: user.uid,
            addedByName: user.displayName ?? user.email ?? 'Unknown',
          })
        }
        await batch.commit()
      }
      toast.success(
        `Added ${preview.valid.length} link${preview.valid.length === 1 ? '' : 's'}` +
          (preview.invalid.length ? ` · ${preview.invalid.length} skipped` : ''),
      )
      setText('')
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
          Paste one URL per line. We'll create a pending application for each.
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
