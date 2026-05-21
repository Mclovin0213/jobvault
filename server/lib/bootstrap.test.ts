import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryAdapter } from './testHelpers'
import type { DataAdapter } from '@/storage/adapter'

let adapter: DataAdapter
vi.mock('./db.ts', () => ({
  getAdapter: async () => adapter,
}))

const { maybeBootstrapAdmin } = await import('./bootstrap')

beforeEach(() => {
  adapter = memoryAdapter()
  delete process.env.ADMIN_USERNAME
  delete process.env.ADMIN_PASSWORD
})

afterEach(() => {
  delete process.env.ADMIN_USERNAME
  delete process.env.ADMIN_PASSWORD
})

describe('maybeBootstrapAdmin', () => {
  it('does nothing when env vars are not set', async () => {
    await maybeBootstrapAdmin()
    expect(await adapter.countUsers()).toBe(0)
  })

  it('creates an admin when both env vars are set and DB is empty', async () => {
    process.env.ADMIN_USERNAME = 'Admin'
    process.env.ADMIN_PASSWORD = 'correct-horse-battery-staple'
    await maybeBootstrapAdmin()
    const u = await adapter.findUserByUsername('admin')
    expect(u).not.toBeNull()
    expect(u?.username).toBe('admin')
  })

  it('does nothing if a user already exists', async () => {
    await adapter.createUser({
      username: 'someone',
      passwordHash: 'scrypt$x$y$z$AA==$BB==',
      role: 'admin',
    })
    process.env.ADMIN_USERNAME = 'admin'
    process.env.ADMIN_PASSWORD = 'correct-horse-battery-staple'
    await maybeBootstrapAdmin()
    expect(await adapter.countUsers()).toBe(1)
    expect(await adapter.findUserByUsername('admin')).toBeNull()
  })

  it('throws if ADMIN_PASSWORD is shorter than 12 chars', async () => {
    process.env.ADMIN_USERNAME = 'admin'
    process.env.ADMIN_PASSWORD = 'short'
    await expect(maybeBootstrapAdmin()).rejects.toThrow(/ADMIN_PASSWORD/)
  })

  it('throws if ADMIN_USERNAME is invalid', async () => {
    process.env.ADMIN_USERNAME = 'no'
    process.env.ADMIN_PASSWORD = 'correct-horse-battery-staple'
    await expect(maybeBootstrapAdmin()).rejects.toThrow(/ADMIN_USERNAME/)
  })

  it('throws if only one of the two env vars is set', async () => {
    process.env.ADMIN_USERNAME = 'admin'
    await expect(maybeBootstrapAdmin()).rejects.toThrow(/ADMIN_PASSWORD/)
  })
})
