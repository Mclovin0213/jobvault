import type { Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { sealData, unsealData } from 'iron-session'
import type { StoredUser } from '../../src/auth/adapter.ts'

export interface AppSession {
  user?: StoredUser
}

export interface OAuthStateSession {
  state?: string
}

const APP_COOKIE = 'app_session'
const STATE_COOKIE = 'oauth_state'
const APP_MAX_AGE_SEC = 60 * 60 * 24 * 30
const STATE_MAX_AGE_SEC = 60 * 10

function sessionPassword(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters')
  }
  return s
}

function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'Lax' as const,
    path: '/',
    maxAge,
  }
}

async function read<T extends object>(c: Context, name: string): Promise<T | null> {
  const raw = getCookie(c, name)
  if (!raw) return null
  try {
    return await unsealData<T>(raw, { password: sessionPassword() })
  } catch {
    return null
  }
}

async function write(c: Context, name: string, data: object, maxAge: number): Promise<void> {
  const sealed = await sealData(data, { password: sessionPassword(), ttl: maxAge })
  setCookie(c, name, sealed, cookieOpts(maxAge))
}

export async function getAppSession(c: Context): Promise<AppSession> {
  return (await read<AppSession>(c, APP_COOKIE)) ?? {}
}

export async function saveAppSession(c: Context, data: AppSession): Promise<void> {
  await write(c, APP_COOKIE, data, APP_MAX_AGE_SEC)
}

export function destroyAppSession(c: Context): void {
  deleteCookie(c, APP_COOKIE, { path: '/' })
}

export async function getOAuthStateSession(c: Context): Promise<OAuthStateSession> {
  return (await read<OAuthStateSession>(c, STATE_COOKIE)) ?? {}
}

export async function saveOAuthStateSession(c: Context, data: OAuthStateSession): Promise<void> {
  await write(c, STATE_COOKIE, data, STATE_MAX_AGE_SEC)
}

export function destroyOAuthStateSession(c: Context): void {
  deleteCookie(c, STATE_COOKIE, { path: '/' })
}

export async function readSessionUser(c: Context): Promise<StoredUser | null> {
  try {
    const s = await getAppSession(c)
    return s.user ?? null
  } catch {
    return null
  }
}
