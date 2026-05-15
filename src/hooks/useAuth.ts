import { useEffect, useState } from 'react'
import { restAuthAdapter } from '@/auth/rest'
import type { StoredUser } from '@/auth/adapter'

export type AuthStatus = 'loading' | 'signed-out' | 'allowed'

export interface AuthState {
  user: StoredUser | null
  status: AuthStatus
  signIn: () => void
  signOut: () => Promise<void>
  error: string | null
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<StoredUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const u = await restAuthAdapter.getCurrentUser()
        if (cancelled) return
        if (u) {
          setUser(u)
          setStatus('allowed')
        } else {
          setUser(null)
          setStatus('signed-out')
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setStatus('signed-out')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function signIn() {
    setError(null)
    restAuthAdapter.signIn()
  }

  async function signOut() {
    try {
      await restAuthAdapter.signOut()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setUser(null)
    setStatus('signed-out')
  }

  return { user, status, signIn, signOut, error }
}
