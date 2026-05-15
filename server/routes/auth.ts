import { Hono } from 'hono'
import { requireUser } from '../lib/requireUser.ts'
import { rateLimit } from '../lib/rateLimit.ts'
import { isAllowed } from '../lib/allowlist.ts'
import {
  destroyAppSession,
  destroyOAuthStateSession,
  getOAuthStateSession,
  saveAppSession,
  saveOAuthStateSession,
} from '../lib/session.ts'
import {
  buildAuthorizeUrl,
  exchangeCode,
  fetchUserInfo,
  postLoginRedirect,
  redirectUriFor,
} from '../lib/oauthGoogle.ts'

const app = new Hono()

function clientIp(c: import('hono').Context): string {
  const xff = c.req.header('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return 'anon'
}

function denyPage(c: import('hono').Context, status: number, msg: string) {
  c.header('content-type', 'text/html')
  return c.body(
    `<!doctype html><html><head><title>Sign-in failed</title></head>` +
      `<body style="font-family:system-ui;padding:2rem;max-width:32rem;margin:auto">` +
      `<h1>Sign-in failed</h1><p>${msg}</p>` +
      `<p><a href="/">Return home</a></p></body></html>`,
    status as 400 | 403 | 500 | 502,
  )
}

app.get('/me', async c => {
  const auth = await requireUser(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status)
  return c.json(auth.user)
})

app.get('/login', async c => {
  if ((process.env.AUTH_MODE || 'none').toLowerCase() !== 'oauth') {
    return c.json({ error: 'oauth_not_enabled' }, 404)
  }
  const limit = rateLimit(`login:${clientIp(c)}`)
  if (!limit.ok) {
    c.header('Retry-After', String(limit.retryAfterSec))
    return c.json({ error: 'rate_limited', retryAfterSec: limit.retryAfterSec }, 429)
  }
  const state = crypto.randomUUID()
  const redirectUri = redirectUriFor(c)
  try {
    await saveOAuthStateSession(c, { state })
    return c.redirect(buildAuthorizeUrl(state, redirectUri), 302)
  } catch (e) {
    console.error('login_error', e)
    return c.json({ error: 'login_misconfigured' }, 500)
  }
})

app.get('/callback', async c => {
  if ((process.env.AUTH_MODE || 'none').toLowerCase() !== 'oauth') {
    return c.json({ error: 'oauth_not_enabled' }, 404)
  }
  const code = c.req.query('code')
  const state = c.req.query('state')
  if (!code || !state) return denyPage(c, 400, 'Missing code or state.')

  let expectedState: string | undefined
  try {
    const stateSession = await getOAuthStateSession(c)
    expectedState = stateSession.state
    destroyOAuthStateSession(c)
  } catch (e) {
    console.error('callback_state_error', e)
    return denyPage(c, 500, 'Session storage misconfigured.')
  }
  if (!expectedState || expectedState !== state) {
    return denyPage(c, 400, 'Invalid state — try signing in again.')
  }

  let user
  try {
    const tok = await exchangeCode(code, redirectUriFor(c))
    const info = await fetchUserInfo(tok.access_token)
    if (!info.email_verified) {
      return denyPage(c, 403, 'Your Google account email is not verified.')
    }
    user = {
      uid: info.sub,
      email: info.email,
      displayName: info.name || info.email,
    }
  } catch (e) {
    console.error('oauth_exchange_error', e)
    return denyPage(c, 502, 'OAuth provider error. Try again.')
  }

  if (!(await isAllowed(user.email))) {
    return denyPage(c, 403, `<code>${user.email}</code> is not in the allowlist for this deployment.`)
  }

  try {
    await saveAppSession(c, { user })
  } catch (e) {
    console.error('session_save_error', e)
    return denyPage(c, 500, 'Could not establish session.')
  }

  return c.redirect(postLoginRedirect(), 302)
})

app.post('/logout', async c => {
  if ((process.env.AUTH_MODE || 'none').toLowerCase() !== 'oauth') {
    return c.body(null, 204)
  }
  try {
    destroyAppSession(c)
  } catch (e) {
    console.error('logout_error', e)
  }
  return c.body(null, 204)
})

export default app
