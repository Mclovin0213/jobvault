import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPage } from './extract'

const PUBLIC_URL = 'http://93.184.216.34/job'
const PUBLIC_REDIRECT_URL = 'http://93.184.216.34/final'

function htmlWithBody(text: string): string {
  return `<!doctype html><html><head><title>Job</title></head><body>${text}</body></html>`
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchPage', () => {
  it('validates a redirect target before fetching it', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/private' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchPage(PUBLIC_URL)

    expect(result).toEqual({ ok: false, error: 'redirect_private_address' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('follows public redirects manually', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === PUBLIC_URL) {
        return new Response(null, {
          status: 302,
          headers: { location: PUBLIC_REDIRECT_URL },
        })
      }
      return new Response(
        htmlWithBody(
          'Senior software engineer role at Example Company with enough detail to pass the extractor minimum text length.',
        ),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchPage(PUBLIC_URL)

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith(
      PUBLIC_REDIRECT_URL,
      expect.objectContaining({ redirect: 'manual' }),
    )
  })
})
