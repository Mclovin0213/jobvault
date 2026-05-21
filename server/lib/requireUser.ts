import type { Context } from 'hono'
import type { StoredLocalUser } from '@/storage/adapter'
import { getAppSession } from './session.ts'
import { findUserById } from './users.ts'

export type UserResult =
  | { ok: true; user: StoredLocalUser }
  | { ok: false; status: 401; error: 'unauthenticated' }

export async function requireUser(c: Context): Promise<UserResult> {
  const session = await getAppSession(c)
  if (!session.userId) return { ok: false, status: 401, error: 'unauthenticated' }
  const user = await findUserById(session.userId)
  if (!user) return { ok: false, status: 401, error: 'unauthenticated' }
  return { ok: true, user }
}
