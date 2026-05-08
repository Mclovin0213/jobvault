import { auth } from '@/firebase'
import type { ExtractedFields } from '@/types'

export type ExtractResult =
  | { ok: true; extracted: ExtractedFields }
  | { ok: false; error: string }

const EMPTY: ExtractedFields = {
  company: '',
  role: '',
  salary: '',
  location: '',
  workArrangement: '',
  source: '',
}

export async function extractUrl(url: string): Promise<ExtractResult> {
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return { ok: false, error: 'not_signed_in' }
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: text || `HTTP ${res.status}` }
    }
    const data = (await res.json()) as { extracted?: Partial<ExtractedFields>; error?: string }
    if (data.error) return { ok: false, error: data.error }
    return { ok: true, extracted: { ...EMPTY, ...(data.extracted ?? {}) } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}
