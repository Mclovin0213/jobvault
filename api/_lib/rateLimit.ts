// Best-effort per-instance rate limiter. Vercel Fluid Compute reuses warm
// instances, so this is a sensible first line of defense — a determined caller
// can still hit a cold instance, but the cost ceiling per warm instance is
// strictly bounded. For global limits, swap in Upstash/Vercel KV later.

type Bucket = { count: number; windowStart: number }

const DEFAULT_LIMIT = 20
const DEFAULT_WINDOW_MS = 5 * 60 * 1000

const store = new Map<string, Bucket>()

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number }

export function rateLimit(
  key: string,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS,
): RateLimitResult {
  const now = Date.now()
  const bucket = store.get(key)
  if (!bucket || now - bucket.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now })
    return { ok: true }
  }
  if (bucket.count < limit) {
    bucket.count += 1
    return { ok: true }
  }
  const retryAfterSec = Math.ceil((bucket.windowStart + windowMs - now) / 1000)
  return { ok: false, retryAfterSec: Math.max(retryAfterSec, 1) }
}

export function _resetRateLimitForTests() {
  store.clear()
}
