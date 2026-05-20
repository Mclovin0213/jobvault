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
  delete process.env.ADMIN_EMAIL
  delete process.env.ADMIN_PASSWORD
  delete process.env.ADMIN_DISPLAY_NAME
})

afterEach(() => {
  delete process.env.ADMIN_EMAIL
  delete process.env.ADMIN_PASSWORD
  delete process.env.ADMIN_DISPLAY_NAME
})

describe('maybeBootstrapAdmin', () => {
  it('does nothing when env vars are not set', async () => {
    await maybeBootstrapAdmin()
    expect(await adapter.countUsers()).toBe(0)
  })

  it('creates an admin when both env vars are set and DB is empty', async () => {
    process.env.ADMIN_EMAIL = 'Admin@Example.com'
    process.env.ADMIN_PASSWORD = 'correct-horse-battery-staple'
    await maybeBootstrapAdmin()
    const u = await adapter.findUserByEmail('admin@example.com')
    expect(u).not.toBeNull()
    expect(u?.displayName).toBe('admin')
  })

  it('uses ADMIN_DISPLAY_NAME when set', async () => {
    process.env.ADMIN_EMAIL = 'admin@example.com'
    process.env.ADMIN_PASSWORD = 'correct-horse-battery-staple'
    process.env.ADMIN_DISPLAY_NAME = 'Site Owner'
    await maybeBootstrapAdmin()
    const u = await adapter.findUserByEmail('admin@example.com')
    expect(u?.displayName).toBe('Site Owner')
  })

  it('does nothing if a user already exists', async () => {
    await adapter.createUser({
      email: 'someone@else.com',
      passwordHash: 'scrypt$x$y$z$AA==$BB==',
      displayName: 'Someone',
      role: 'admin',
    })
    process.env.ADMIN_EMAIL = 'admin@example.com'
    process.env.ADMIN_PASSWORD = 'correct-horse-battery-staple'
    await maybeBootstrapAdmin()
    expect(await adapter.countUsers()).toBe(1)
    expect(await adapter.findUserByEmail('admin@example.com')).toBeNull()
  })

  it('throws if ADMIN_PASSWORD is shorter than 12 chars', async () => {
    process.env.ADMIN_EMAIL = 'admin@example.com'
    process.env.ADMIN_PASSWORD = 'short'
    await expect(maybeBootstrapAdmin()).rejects.toThrow(/ADMIN_PASSWORD/)
  })

  it('throws if only one of the two env vars is set', async () => {
    process.env.ADMIN_EMAIL = 'admin@example.com'
    await expect(maybeBootstrapAdmin()).rejects.toThrow(/ADMIN_PASSWORD/)
  })
})
