import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '@/firebase'

export type AuthStatus = 'loading' | 'signed-out' | 'checking-allowlist' | 'allowed' | 'denied'

export interface AuthState {
  user: User | null
  status: AuthStatus
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  error: string | null
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      setUser(u)
      if (!u) {
        setStatus('signed-out')
        return
      }
      if (!u.email) {
        setStatus('denied')
        return
      }
      setStatus('checking-allowlist')
      try {
        const snap = await getDoc(doc(db, 'allowlist', u.email))
        setStatus(snap.exists() ? 'allowed' : 'denied')
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setStatus('denied')
      }
    })
  }, [])

  async function signIn() {
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  return { user, status, signIn, signOut, error }
}
