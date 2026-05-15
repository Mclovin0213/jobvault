import { apiFetch, ApiError } from '@/storage/rest/client'
import type { AuthAdapter, StoredUser } from './adapter'

export class RestAuthAdapter implements AuthAdapter {
  async getCurrentUser(): Promise<StoredUser | null> {
    try {
      return await apiFetch<StoredUser>('/api/auth/me')
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null
      throw e
    }
  }

  signIn(): void {
    window.location.assign('/api/auth/login')
  }

  async signOut(): Promise<void> {
    await apiFetch('/api/auth/logout', { method: 'POST' })
  }
}

export const restAuthAdapter = new RestAuthAdapter()
