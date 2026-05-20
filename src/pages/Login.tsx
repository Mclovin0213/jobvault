import { useState, type FormEvent } from 'react'
import { LogIn, Loader2 } from 'lucide-react'
import { apiFetch, ApiError } from '@/storage/rest/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      onSignedIn()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid email or password.')
      } else if (err instanceof ApiError && err.status === 429) {
        setError('Too many attempts. Try again in a minute.')
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-[var(--color-accent)]">
            <LogIn className="size-6" />
          </div>
          <h1 className="text-center text-2xl font-semibold tracking-tight">Jobvault</h1>
          <p className="mt-2 text-center text-sm text-[var(--color-muted-foreground)]">
            Sign in to continue.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <Input
              type="email"
              autoComplete="email"
              required
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={busy}
            />
            <Input
              type="password"
              autoComplete="current-password"
              required
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={busy}
            />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Sign in
            </Button>
            {error ? (
              <p className="text-center text-sm text-[var(--color-destructive)]">{error}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
