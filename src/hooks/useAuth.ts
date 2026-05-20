import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/storage/rest/client'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  role: 'admin'
}

export type AuthStatus = 'loading' | 'needs-setup' | 'signed-out' | 'signed-in'

export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  error: string | null
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

type MeResponse =
  | { status: 'needs-setup' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: AuthUser }

export function useAuth(): AuthState {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const me = await apiFetch<MeResponse>('/api/auth/me')
      if (me.status === 'signed-in') {
        setUser(me.user)
        setStatus('signed-in')
      } else {
        setUser(null)
        setStatus(me.status)
      }
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('signed-out')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const me = await apiFetch<MeResponse>('/api/auth/me')
        if (cancelled) return
        if (me.status === 'signed-in') {
          setUser(me.user)
          setStatus('signed-in')
        } else {
          setUser(null)
          setStatus(me.status)
        }
        setError(null)
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

  const signOut = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setUser(null)
    setStatus('signed-out')
  }, [])

  return { status, user, error, refresh, signOut }
}
