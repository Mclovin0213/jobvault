import { Hono } from 'hono'
import { z } from 'zod'
import { parseBody } from '../lib/parseBody.ts'
import { rateLimit } from '../lib/rateLimit.ts'
import {
  destroyAppSession,
  getAppSession,
  saveAppSession,
} from '../lib/session.ts'
import {
  countUsers,
  createInitialUser,
  findUserById,
  verifyUserPassword,
} from '../lib/users.ts'

const app = new Hono()

const LOGIN_RATE_LIMIT = 5

function clientIp(c: import('hono').Context): string {
  const xff = c.req.header('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return 'anon'
}

const setupSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(200),
})

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
})

function toPublicUser(u: { id: string; email: string; displayName: string; role: 'admin' }) {
  return { id: u.id, email: u.email, displayName: u.displayName, role: u.role }
}

app.get('/me', async c => {
  const userCount = await countUsers()
  if (userCount === 0) return c.json({ status: 'needs-setup' })
  const session = await getAppSession(c)
  if (!session.userId) return c.json({ status: 'signed-out' })
  const user = await findUserById(session.userId)
  if (!user) {
    if ((await countUsers()) === 0) return c.json({ status: 'needs-setup' })
    return c.json({ status: 'signed-out' })
  }
  return c.json({ status: 'signed-in', user: toPublicUser(user) })
})

app.post('/setup', async c => {
  if ((await countUsers()) > 0) {
    return c.json({ error: 'setup_already_complete' }, 410)
  }
  const limit = rateLimit(`setup:${clientIp(c)}`)
  if (!limit.ok) {
    c.header('Retry-After', String(limit.retryAfterSec))
    return c.json({ error: 'rate_limited', retryAfterSec: limit.retryAfterSec }, 429)
  }
  const parsed = await parseBody(c, setupSchema)
  if (!parsed.ok) return parsed.response

  let user
  try {
    user = await createInitialUser(parsed.data)
  } catch (e) {
    if (e instanceof Error && e.message === 'setup_already_complete') {
      return c.json({ error: 'setup_already_complete' }, 410)
    }
    throw e
  }
  await saveAppSession(c, { userId: user.id })
  return c.json({ status: 'signed-in', user: toPublicUser(user) })
})

app.post('/login', async c => {
  const limit = rateLimit(`login:${clientIp(c)}`, LOGIN_RATE_LIMIT)
  if (!limit.ok) {
    c.header('Retry-After', String(limit.retryAfterSec))
    return c.json({ error: 'rate_limited', retryAfterSec: limit.retryAfterSec }, 429)
  }
  const parsed = await parseBody(c, loginSchema)
  if (!parsed.ok) return parsed.response
  const user = await verifyUserPassword(parsed.data.email, parsed.data.password)
  if (!user) return c.json({ error: 'invalid_credentials' }, 401)
  await saveAppSession(c, { userId: user.id })
  return c.json({ status: 'signed-in', user: toPublicUser(user) })
})

app.post('/logout', c => {
  destroyAppSession(c)
  return c.body(null, 204)
})

export default app
