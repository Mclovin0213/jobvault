import type { StoredLocalUser } from '@/storage/adapter'
import { getAdapter } from './db.ts'
import { getDummyHash, hashPassword, verifyPassword } from './password.ts'

export interface CreateUserInput {
  username: string
  password: string
}

export async function countUsers(): Promise<number> {
  return (await getAdapter()).countUsers()
}

export async function findUserById(id: string): Promise<StoredLocalUser | null> {
  return (await getAdapter()).findUserById(id)
}

export async function findUserByUsername(username: string): Promise<StoredLocalUser | null> {
  return (await getAdapter()).findUserByUsername(username)
}

export async function createUser(input: CreateUserInput): Promise<StoredLocalUser> {
  const passwordHash = await hashPassword(input.password)
  return (await getAdapter()).createUser({
    username: input.username,
    passwordHash,
    role: 'admin',
  })
}

export async function createInitialUser(input: CreateUserInput): Promise<StoredLocalUser> {
  const passwordHash = await hashPassword(input.password)
  return (await getAdapter()).createInitialUser({
    username: input.username,
    passwordHash,
    role: 'admin',
  })
}

export async function verifyUserPassword(
  username: string,
  password: string,
): Promise<StoredLocalUser | null> {
  const user = await findUserByUsername(username)
  if (!user) {
    // Spend roughly the same time as a real verify to avoid leaking
    // existence via timing.
    await verifyPassword(password, await getDummyHash())
    return null
  }
  const ok = await verifyPassword(password, user.passwordHash)
  return ok ? user : null
}
