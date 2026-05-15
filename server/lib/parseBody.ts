import type { Context } from 'hono'
import type { ZodType } from 'zod'

export const MAX_BODY_BYTES = 1_000_000

export async function parseBody<T>(
  c: Context,
  schema: ZodType<T>,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  const contentLength = Number(c.req.header('content-length') ?? '0')
  if (contentLength > maxBytes) {
    return { ok: false, response: c.json({ error: 'body_too_large' }, 413) }
  }

  let raw: unknown
  try {
    const body = c.req.raw.body
    if (!body) {
      raw = undefined
    } else {
      const reader = body.getReader()
      const decoder = new TextDecoder()
      let received = 0
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        received += value.byteLength
        if (received > maxBytes) {
          try {
            await reader.cancel('body_too_large')
          } catch {
            // ignore
          }
          return { ok: false, response: c.json({ error: 'body_too_large' }, 413) }
        }
        text += decoder.decode(value, { stream: true })
      }
      text += decoder.decode()
      raw = text.length === 0 ? undefined : JSON.parse(text)
    }
  } catch {
    raw = undefined
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      response: c.json({ error: 'invalid_body', issues: result.error.issues }, 400),
    }
  }
  return { ok: true, data: result.data }
}
