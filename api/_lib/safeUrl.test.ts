import { describe, expect, it, vi } from 'vitest'
import { safeUrl, type Resolver } from './safeUrl'

const publicResolver: Resolver = async () => [{ address: '93.184.216.34', family: 4 }]
const privateResolver: Resolver = async () => [{ address: '10.0.0.1', family: 4 }]
const linkLocalResolver: Resolver = async () => [{ address: '169.254.169.254', family: 4 }]
const ipv6LoopbackResolver: Resolver = async () => [{ address: '::1', family: 6 }]
const ipv6PublicResolver: Resolver = async () => [{ address: '2606:4700::1', family: 6 }]

describe('safeUrl', () => {
  it('rejects non-http(s) protocols', async () => {
    expect(await safeUrl('ftp://example.com', publicResolver)).toEqual({
      ok: false,
      error: 'unsupported_protocol',
    })
  })

  it('rejects unparseable urls', async () => {
    expect(await safeUrl('not a url', publicResolver)).toEqual({ ok: false, error: 'invalid_url' })
  })

  it('rejects literal localhost', async () => {
    expect(await safeUrl('http://localhost:3000', publicResolver)).toEqual({
      ok: false,
      error: 'private_address',
    })
  })

  it('rejects .local hostnames', async () => {
    expect(await safeUrl('http://my-printer.local', publicResolver)).toEqual({
      ok: false,
      error: 'private_address',
    })
  })

  it('rejects loopback IPv4 literals', async () => {
    expect(await safeUrl('http://127.0.0.1', publicResolver)).toEqual({
      ok: false,
      error: 'private_address',
    })
  })

  it('rejects RFC1918 IPv4 literals', async () => {
    expect(await safeUrl('http://10.0.0.1', publicResolver)).toEqual({
      ok: false,
      error: 'private_address',
    })
    expect(await safeUrl('http://192.168.1.1', publicResolver)).toEqual({
      ok: false,
      error: 'private_address',
    })
    expect(await safeUrl('http://172.16.0.1', publicResolver)).toEqual({
      ok: false,
      error: 'private_address',
    })
  })

  it('rejects link-local IPv4 literals (AWS metadata)', async () => {
    expect(await safeUrl('http://169.254.169.254/latest/meta-data', publicResolver)).toEqual({
      ok: false,
      error: 'private_address',
    })
  })

  it('rejects IPv6 loopback literal', async () => {
    expect(await safeUrl('http://[::1]', publicResolver)).toEqual({
      ok: false,
      error: 'private_address',
    })
  })

  it('rejects hostnames that resolve to private IPs', async () => {
    expect(await safeUrl('https://internal.example.com', privateResolver)).toEqual({
      ok: false,
      error: 'private_address',
    })
  })

  it('rejects hostnames that resolve to link-local addresses', async () => {
    expect(await safeUrl('https://metadata.example.com', linkLocalResolver)).toEqual({
      ok: false,
      error: 'private_address',
    })
  })

  it('rejects hostnames that resolve to IPv6 loopback', async () => {
    expect(await safeUrl('https://internal.example.com', ipv6LoopbackResolver)).toEqual({
      ok: false,
      error: 'private_address',
    })
  })

  it('allows public hostnames that resolve to public IPv4', async () => {
    expect(await safeUrl('https://example.com/path', publicResolver)).toEqual({ ok: true })
  })

  it('allows public hostnames that resolve to public IPv6', async () => {
    expect(await safeUrl('https://example.com', ipv6PublicResolver)).toEqual({ ok: true })
  })

  it('returns dns_lookup_failed when resolver throws', async () => {
    const failing: Resolver = vi.fn(async () => {
      throw new Error('NXDOMAIN')
    })
    expect(await safeUrl('https://example.com', failing)).toEqual({
      ok: false,
      error: 'dns_lookup_failed',
    })
  })
})
