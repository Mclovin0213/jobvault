import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { memoryAdapter } from '../lib/testHelpers'
import { _resetRateLimitForTests } from '../lib/rateLimit'
import { MAX_PENDING_BATCH } from '../lib/validation'
import type { DataAdapter, StoredLocalUser } from '@/storage/adapter'

let adapter: DataAdapter
let sessionUser: StoredLocalUser | null = null

vi.mock('../lib/db.ts', () => ({
  getAdapter: async () => adapter,
}))

vi.mock('../lib/session.ts', () => ({
  getAppSession: async () => (sessionUser ? { userId: sessionUser.id } : {}),
  saveAppSession: async () => {},
  destroyAppSession: () => {},
}))

vi.mock('../lib/users.ts', () => ({
  countUsers: async () => (sessionUser ? 1 : 0),
  findUserById: async (id: string) =>
    sessionUser && sessionUser.id === id ? sessionUser : null,
  findUserByUsername: async () => null,
  createUser: async () => sessionUser!,
  createInitialUser: async () => sessionUser!,
  verifyUserPassword: async () => null,
}))

const applicationsRoute = (await import('./applications')).default
const pendingRoute = (await import('./pending')).default

function buildApp() {
  const app = new Hono()
  app.route('/api/applications', applicationsRoute)
  app.route('/api/pending', pendingRoute)
  return app
}

const EMPTY_EXTRACTED = {
  company: '',
  role: '',
  salary: '',
  location: '',
  workArrangement: '' as const,
  source: '',
}

const TEST_USER: StoredLocalUser = {
  id: 'u-1',
  username: 'tester',
  passwordHash: 'scrypt$x$y$z$AA==$BB==',
  role: 'admin',
  createdAt: 0,
}

beforeEach(() => {
  adapter = memoryAdapter()
  sessionUser = null
  _resetRateLimitForTests()
})

async function jsonReq(app: Hono, url: string, method: string, body?: unknown) {
  return app.request(url, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('auth shim', () => {
  it('returns 401 when no session is set', async () => {
    const r = await buildApp().request('/api/applications')
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ error: 'unauthenticated' })
  })

  it('returns 401 when session points to a missing user', async () => {
    sessionUser = null
    const r = await buildApp().request('/api/applications')
    expect(r.status).toBe(401)
  })

  it('serves a request when a session user is present', async () => {
    sessionUser = TEST_USER
    const r = await buildApp().request('/api/applications')
    expect(r.status).toBe(200)
  })
})

describe('POST /api/applications', () => {
  it('400s on invalid body', async () => {
    sessionUser = TEST_USER
    const r = await jsonReq(buildApp(), '/api/applications', 'POST', { bogus: 1 })
    expect(r.status).toBe(400)
  })

  it('400s on non-http URL scheme', async () => {
    sessionUser = TEST_USER
    const r = await jsonReq(buildApp(), '/api/applications', 'POST', { url: 'javascript:alert(1)' })
    expect(r.status).toBe(400)
  })

  it('creates with server-stamped addedBy/addedByName', async () => {
    sessionUser = TEST_USER
    const r = await jsonReq(buildApp(), '/api/applications', 'POST', {
      url: 'https://example.com/x',
      addedBy: 'attacker',
      addedByName: 'spoof',
    })
    expect(r.status).toBe(201)
    const body = (await r.json()) as { addedBy: string; addedByName: string }
    expect(body.addedBy).toBe('u-1')
    expect(body.addedByName).toBe('tester')
  })
})

describe('PATCH /api/applications/[id]', () => {
  it('auto-stamps appliedAt when status flips to applied', async () => {
    sessionUser = TEST_USER
    const created = await adapter.createApplication({
      url: 'https://example.com/x',
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
      addedBy: 'u-1',
      addedByName: 'A',
    })
    const r = await jsonReq(buildApp(), `/api/applications/${created.id}`, 'PATCH', { status: 'applied' })
    expect(r.status).toBe(200)
    const body = (await r.json()) as { appliedAt: number | null }
    expect(typeof body.appliedAt).toBe('number')
  })

  it('does not overwrite an existing appliedAt', async () => {
    sessionUser = TEST_USER
    const created = await adapter.createApplication({
      url: 'https://example.com/x',
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
      appliedAt: 1000,
      addedBy: 'u-1',
      addedByName: 'A',
    })
    const r = await jsonReq(buildApp(), `/api/applications/${created.id}`, 'PATCH', { status: 'applied' })
    const body = (await r.json()) as { appliedAt: number | null }
    expect(body.appliedAt).toBe(1000)
  })

  it('404s on missing row', async () => {
    sessionUser = TEST_USER
    const r = await jsonReq(buildApp(), '/api/applications/missing', 'PATCH', { notes: 'x' })
    expect(r.status).toBe(404)
  })
})

describe('DELETE /api/applications/[id]', () => {
  it('returns 204', async () => {
    sessionUser = TEST_USER
    const created = await adapter.createApplication({
      url: 'https://example.com/x',
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
      addedBy: 'u-1',
      addedByName: 'A',
    })
    const r = await buildApp().request(`/api/applications/${created.id}`, { method: 'DELETE' })
    expect(r.status).toBe(204)
    expect(await adapter.getApplication(created.id)).toBeNull()
  })
})

describe('method not allowed', () => {
  it('PATCH on /api/applications collection returns 405', async () => {
    sessionUser = TEST_USER
    const r = await jsonReq(buildApp(), '/api/applications', 'PATCH', {})
    expect(r.status).toBe(405)
    expect(r.headers.get('Allow')).toContain('GET')
  })
})

describe('pending handlers', () => {
  it('POST /api/pending derives hostname server-side and ignores client-sent value', async () => {
    sessionUser = TEST_USER
    const r = await jsonReq(buildApp(), '/api/pending', 'POST', [
      { url: 'https://www.example.com/job', extracted: EMPTY_EXTRACTED },
    ])
    expect(r.status).toBe(201)
    const body = (await r.json()) as Array<{ hostname: string; addedBy: string }>
    expect(body[0].hostname).toBe('example.com')
    expect(body[0].addedBy).toBe('u-1')
  })

  it('POST /api/pending rejects non-http URL', async () => {
    sessionUser = TEST_USER
    const r = await jsonReq(buildApp(), '/api/pending', 'POST', [
      { url: 'file:///etc/passwd', extracted: EMPTY_EXTRACTED },
    ])
    expect(r.status).toBe(400)
  })

  it('POST /api/pending rejects oversized batches', async () => {
    sessionUser = TEST_USER
    const r = await jsonReq(
      buildApp(),
      '/api/pending',
      'POST',
      Array.from({ length: MAX_PENDING_BATCH + 1 }, (_, i) => ({
        url: `https://example.com/job-${i}`,
        extracted: EMPTY_EXTRACTED,
      })),
    )
    expect(r.status).toBe(400)
  })

  it('PATCH /api/pending/[id] re-derives hostname when url changes', async () => {
    sessionUser = TEST_USER
    const [p] = await adapter.createPendingUrls([
      {
        url: 'https://old.example.com/x',
        hostname: 'old.example.com',
        extraction: 'idle',
        extracted: EMPTY_EXTRACTED,
        extractError: '',
        addedBy: 'u-1',
        addedByName: 'A',
      },
    ])
    const r = await jsonReq(buildApp(), `/api/pending/${p.id}`, 'PATCH', {
      url: 'https://www.new.example.com/y',
    })
    expect(r.status).toBe(200)
    const body = (await r.json()) as { hostname: string; url: string }
    expect(body.hostname).toBe('new.example.com')
  })

  it('approve 404s when pending row missing', async () => {
    sessionUser = TEST_USER
    const r = await jsonReq(buildApp(), '/api/pending/missing/approve', 'POST', {
      url: 'https://example.com/x',
    })
    expect(r.status).toBe(404)
    expect(await r.json()).toEqual({ error: 'not_found' })
  })

  it('approve atomically deletes pending and creates application with appliedAt stamp', async () => {
    sessionUser = TEST_USER
    const [p] = await adapter.createPendingUrls([
      {
        url: 'https://example.com/job',
        hostname: 'example.com',
        extraction: 'done',
        extracted: EMPTY_EXTRACTED,
        extractError: '',
        addedBy: 'u-1',
        addedByName: 'A',
      },
    ])
    const r = await jsonReq(buildApp(), `/api/pending/${p.id}/approve`, 'POST', {
      url: 'https://example.com/job',
      status: 'applied',
    })
    expect(r.status).toBe(201)
    const body = (await r.json()) as { appliedAt: number | null; status: string }
    expect(body.status).toBe('applied')
    expect(typeof body.appliedAt).toBe('number')
    expect(await adapter.listPendingUrls()).toEqual([])
  })
})
