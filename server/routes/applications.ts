import { Hono } from 'hono'
import { getAdapter } from '../lib/db.ts'
import { requireUser } from '../lib/requireUser.ts'
import { rateLimit } from '../lib/rateLimit.ts'
import { parseBody } from '../lib/parseBody.ts'
import { applicationPatchSchema, newApplicationSchema } from '../lib/validation.ts'

const app = new Hono()

app.get('/', async c => {
  const auth = await requireUser(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status)
  const apps = await (await getAdapter()).listApplications()
  return c.json(apps)
})

app.post('/', async c => {
  const auth = await requireUser(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status)
  const limit = rateLimit(auth.user.email)
  if (!limit.ok) {
    c.header('Retry-After', String(limit.retryAfterSec))
    return c.json({ error: 'rate_limited', retryAfterSec: limit.retryAfterSec }, 429)
  }
  const parsed = await parseBody(c, newApplicationSchema)
  if (!parsed.ok) return parsed.response
  const created = await (await getAdapter()).createApplication({
    ...parsed.data,
    addedBy: auth.user.uid,
    addedByName: auth.user.displayName,
  })
  return c.json(created, 201)
})

app.patch('/:id', async c => {
  const auth = await requireUser(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status)
  const id = c.req.param('id')
  const limit = rateLimit(auth.user.email)
  if (!limit.ok) {
    c.header('Retry-After', String(limit.retryAfterSec))
    return c.json({ error: 'rate_limited', retryAfterSec: limit.retryAfterSec }, 429)
  }
  const parsed = await parseBody(c, applicationPatchSchema)
  if (!parsed.ok) return parsed.response
  const patch = parsed.data
  const adapter = await getAdapter()
  const current = await adapter.getApplication(id)
  if (!current) return c.json({ error: 'not_found' }, 404)
  const final = { ...patch }
  if (patch.status === 'applied' && patch.appliedAt === undefined && current.appliedAt == null) {
    final.appliedAt = Date.now()
  }
  await adapter.updateApplication(id, final)
  const updated = await adapter.getApplication(id)
  return c.json(updated)
})

app.delete('/:id', async c => {
  const auth = await requireUser(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status)
  const id = c.req.param('id')
  const limit = rateLimit(auth.user.email)
  if (!limit.ok) {
    c.header('Retry-After', String(limit.retryAfterSec))
    return c.json({ error: 'rate_limited', retryAfterSec: limit.retryAfterSec }, 429)
  }
  await (await getAdapter()).deleteApplication(id)
  return c.body(null, 204)
})

app.all('/', c => {
  c.header('Allow', 'GET, POST')
  return c.json({ error: 'method_not_allowed' }, 405)
})
app.all('/:id', c => {
  c.header('Allow', 'PATCH, DELETE')
  return c.json({ error: 'method_not_allowed' }, 405)
})

export default app
