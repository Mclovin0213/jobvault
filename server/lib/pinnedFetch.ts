import * as http from 'node:http'
import * as https from 'node:https'
import { Readable } from 'node:stream'
import { checkServerIdentity } from 'node:tls'

export type PinnedInit = {
  method?: string
  headers?: Record<string, string>
  signal?: AbortSignal
  timeoutMs?: number
}

export type PinnedFetch = (
  parsed: URL,
  ip: string,
  family: 4 | 6,
  init?: PinnedInit,
) => Promise<Response>

/**
 * Performs an HTTP(S) request against a pre-validated IP address, with the
 * original hostname carried through the Host header and TLS SNI. Closes the
 * DNS-rebinding TOCTOU window that exists when `fetch(url)` re-resolves the
 * hostname at connect time after a separate validation step has already run.
 */
export const pinnedFetch: PinnedFetch = (parsed, ip, family, init = {}) => {
  const isHttps = parsed.protocol === 'https:'
  const lib = isHttps ? https : http
  const port = parsed.port ? Number(parsed.port) : isHttps ? 443 : 80
  const hostHeader = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname

  const headers: Record<string, string> = { ...(init.headers ?? {}), host: hostHeader }

  return new Promise<Response>((resolve, reject) => {
    const requestOptions: http.RequestOptions & {
      servername?: string
      checkServerIdentity?: https.RequestOptions['checkServerIdentity']
    } = {
      host: ip,
      port,
      path: parsed.pathname + parsed.search,
      method: init.method ?? 'GET',
      headers,
      family,
      timeout: init.timeoutMs,
    }

    if (isHttps) {
      requestOptions.servername = parsed.hostname
      requestOptions.checkServerIdentity = (_host, cert) =>
        checkServerIdentity(parsed.hostname, cert)
    }

    const req = lib.request(requestOptions, res => {
      const webStream = Readable.toWeb(res) as unknown as ReadableStream<Uint8Array>
      const headersOut = new Headers()
      for (const [k, v] of Object.entries(res.headers)) {
        if (v === undefined) continue
        if (Array.isArray(v)) for (const item of v) headersOut.append(k, item)
        else headersOut.set(k, String(v))
      }
      resolve(
        new Response(webStream, { status: res.statusCode ?? 0, headers: headersOut }),
      )
    })

    const onAbort = () => req.destroy(new Error('aborted'))
    if (init.signal) {
      if (init.signal.aborted) onAbort()
      else init.signal.addEventListener('abort', onAbort, { once: true })
    }

    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    req.end()
  })
}

export function pickAddress(
  addresses: { address: string; family: 4 | 6 }[],
): { address: string; family: 4 | 6 } {
  return addresses.find(a => a.family === 4) ?? addresses[0]!
}
