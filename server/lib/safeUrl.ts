import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export type SafeUrlResult = { ok: true } | { ok: false; error: string }
export type ResolvedAddress = { address: string; family: 4 | 6 }
export type ResolvedSafeUrlResult =
  | { ok: true; parsed: URL; addresses: ResolvedAddress[] }
  | { ok: false; error: string }

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', 'broadcasthost'])

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true
  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0 && parts[2] === 0) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a >= 224) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return true
  if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.slice('::ffff:'.length)
    if (isIP(v4) === 4) return isPrivateIPv4(v4)
  }
  return false
}

function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip)
  if (v === 4) return isPrivateIPv4(ip)
  if (v === 6) return isPrivateIPv6(ip)
  return true
}

export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>

const defaultResolver: Resolver = async hostname => {
  const records = await lookup(hostname, { all: true })
  return records.map(r => ({ address: r.address, family: r.family as 4 | 6 }))
}

export async function resolveSafeUrl(
  input: string,
  resolver: Resolver = defaultResolver,
): Promise<ResolvedSafeUrlResult> {
  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return { ok: false, error: 'invalid_url' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'unsupported_protocol' }
  }
  const rawHost = parsed.hostname.toLowerCase()
  if (!rawHost) return { ok: false, error: 'invalid_url' }
  const hostname =
    rawHost.startsWith('[') && rawHost.endsWith(']') ? rawHost.slice(1, -1) : rawHost
  if (BLOCKED_HOSTNAMES.has(hostname)) return { ok: false, error: 'private_address' }
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { ok: false, error: 'private_address' }
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) return { ok: false, error: 'private_address' }
    return { ok: true, parsed, addresses: [{ address: hostname, family: isIP(hostname) as 4 | 6 }] }
  }
  let records: ResolvedAddress[]
  try {
    records = await resolver(hostname)
  } catch {
    return { ok: false, error: 'dns_lookup_failed' }
  }
  if (records.length === 0) return { ok: false, error: 'dns_lookup_failed' }
  for (const r of records) {
    if (isPrivateAddress(r.address)) return { ok: false, error: 'private_address' }
  }
  return { ok: true, parsed, addresses: records }
}

export async function safeUrl(input: string, resolver: Resolver = defaultResolver): Promise<SafeUrlResult> {
  const result = await resolveSafeUrl(input, resolver)
  return result.ok ? { ok: true } : result
}
