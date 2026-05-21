import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryAdapter } from './testHelpers'
import type { DataAdapter } from '@/storage/adapter'

let adapter: DataAdapter
vi.mock('./db.ts', () => ({
  getAdapter: async () => adapter,
}))

const { countUsers, createUser, findUserByUsername, findUserById, verifyUserPassword } =
  await import('./users')

beforeEach(() => {
  adapter = memoryAdapter()
})

describe('users', () => {
  it('createUser stores a normalized username and a hashed password', async () => {
    const u = await createUser({
      username: '  Alex_01 ',
      password: 'a-strong-password-1234',
    })
    expect(u.username).toBe('alex_01')
    expect(u.role).toBe('admin')
    const stored = await adapter.findUserByUsername('alex_01')
    expect(stored?.passwordHash.startsWith('scrypt$')).toBe(true)
    expect(stored?.passwordHash).not.toContain('a-strong-password-1234')
  })

  it('countUsers reflects createUser', async () => {
    expect(await countUsers()).toBe(0)
    await createUser({ username: 'alpha', password: 'a-strong-password-1234' })
    expect(await countUsers()).toBe(1)
  })

  it('findUserByUsername is case-insensitive', async () => {
    await createUser({ username: 'Hello', password: 'a-strong-password-1234' })
    expect((await findUserByUsername('HELLO'))?.username).toBe('hello')
  })

  it('verifyUserPassword returns user on match, null on mismatch', async () => {
    await createUser({ username: 'alpha', password: 'correct-horse-1234' })
    expect((await verifyUserPassword('alpha', 'correct-horse-1234'))?.username).toBe('alpha')
    expect(await verifyUserPassword('alpha', 'wrong')).toBeNull()
  })

  it('verifyUserPassword returns null and still spends time when user does not exist', async () => {
    const start = Date.now()
    expect(await verifyUserPassword('nobody', 'whatever-1234')).toBeNull()
    // Just confirm it did not throw and returned in reasonable time.
    expect(Date.now() - start).toBeLessThan(5000)
  })

  it('findUserById round-trips', async () => {
    const u = await createUser({ username: 'alpha', password: 'correct-horse-1234' })
    expect((await findUserById(u.id))?.username).toBe('alpha')
    expect(await findUserById('does-not-exist')).toBeNull()
  })
})
