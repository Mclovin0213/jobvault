# Self-host Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Google OAuth + email allowlist with local email/password auth gated by a first-run `/setup` flow, plus headless `ADMIN_EMAIL`/`ADMIN_PASSWORD` bootstrap.

**Architecture:** A new `users` SQLite table holds local accounts (scrypt hashes). `GET /api/auth/me` returns one of `needs-setup` / `signed-out` / `signed-in`; the SPA branches off that. `/api/auth/setup` only succeeds when zero users exist (atomic check + insert via unique email constraint). All `AUTH_MODE`/`ALLOW_NO_AUTH`/`ALLOWLIST`/OAuth code is deleted.

**Tech Stack:** Bun runtime, Hono, Drizzle ORM + `bun:sqlite`, iron-session (existing), `node:crypto` scrypt (no new dep), React 19, Vite, Tailwind v4, shadcn-style primitives.

**Source spec:** `docs/superpowers/specs/2026-05-20-self-host-onboarding-design.md`

---

## Progress (handoff snapshot — 2026-05-20)

**Branch:** `feat/self-host-onboarding` (off `main` at `4c61c78`).
**Last commit:** `6e1023a refactor(auth): requireUser uses local DB lookup, drops AUTH_MODE`.

### Completed

- ✅ **Task 1** — schema + migration `0002_local_auth.sql`. Drizzle-kit refused to generate (needed TTY for an "is this a rename?" prompt), so the migration + snapshot + journal were written by hand following `0001`'s format. Initial commit shipped a 2025 `when` timestamp older than `0001`'s — code review caught it as Critical (the bun-sqlite migrator would silently skip the migration on existing installs). Fixed in follow-up commits: `7ce8b4c` (bump timestamp) and `d505538` (replace placeholder snapshot UUID).
- ✅ **Task 2** — `server/lib/password.ts` + tests (4/4 pass). Follow-up commit `e5241b2` corrected a misleading `MAXMEM` comment ("headroom above node's default" — actually below it; it's an explicit ceiling).
- ✅ **Task 3** — `DataAdapter` user CRUD + SqliteDataAdapter + memoryAdapter. **Plan gap caught by code review:** `src/storage/rest/adapter.ts` had to gain throw-stubs for the new user methods (it can't implement them — browser-side). Fixed in `3db6683`, applying the same throw-stub pattern already used for AI settings and the removed allowlist method. **Update the plan when picking up later tasks if RestDataAdapter is mentioned again** — it now has user-CRUD stubs.
- ✅ **Task 4** — `server/lib/users.ts` + tests (6/6 pass). Verbatim plan source. No changes needed.
- ✅ **Task 5** — `session.ts` refactored to `{ userId }` payload, OAuth state helpers dropped. Verbatim plan source. Follow-up commit `ec0670d` cleaned up lint errors caused by the Task 3 throw-stub params (eslint's default `no-unused-vars` doesn't respect `_` prefix; we omit the param entirely, matching the existing pattern in the file).
- ✅ **Task 6** — `requireUser.ts` rewritten + `auth.user.uid` → `auth.user.id` in `applications.ts` and `pending.ts` (3 call sites total — `pending.ts` has two, plan said one). Lint clean.

### In progress / next up

- ⏳ **Task 7** — `routes/auth.ts` rewrite + new `auth.test.ts`. Task was marked in_progress but the implementer was not dispatched. Pick up here.

### Pending

- Task 8 — bootstrap module (TDD)
- Task 9 — wire bootstrap into server entry
- Task 10 — delete OAuth + allowlist; fix `handlers.test.ts`
- Task 11 — drop allowlist refs from sqlite adapter test (2 tests in `src/storage/sqlite/adapter.test.ts` currently fail referencing the removed `listAllowedEmails` — expected mid-stream)
- Task 12 — extract `SettingsForm`
- Task 13 — rewrite `useAuth` + delete `src/auth/`
- Task 14 — Login page
- Task 15 — Setup page
- Task 16 — AuthGate rewrite
- Task 17 — App.tsx + Nav.tsx use `AuthUser`
- Task 18 — manual end-to-end smoke test
- Task 19 — docs + env + Docker

### Known mid-stream state

These will be resolved by Tasks 7–11; do not "fix" them inside earlier tasks:

- `bun run build` is **red**: `server/lib/allowlist.ts` references the removed `listAllowedEmails`, and `server/routes/auth.ts` + `server/routes/handlers.test.ts` still reference deleted session helpers / OAuth code. Tasks 7 and 10 fix these.
- `bun run test src/storage/sqlite/adapter.test.ts` has 2 failures (the stale `listAllowedEmails` tests). Task 11 removes them.
- `bun run lint` is **clean** as of `6e1023a`.

### Notes for the next agent

- The plan's executor is using `superpowers:subagent-driven-development`: fresh implementer subagent per task → spec review → code quality review → fix loop → next task. Tasks 1–6 each used a sonnet implementer + sonnet reviewer.
- For Task 7 (and beyond), task tracking is in TaskCreate (`TaskList` shows current state). Tasks 1–6 are marked `completed`; Task 7 is `in_progress`.
- Each task ends in its own commit. Follow-up fixes from code review go in additional commits, not amend.
- Branch is not pushed anywhere yet; safe to rebase if needed.

---

## File Structure

**New files:**
- `src/storage/sqlite/migrations/0002_local_auth.sql` — adds `users`, drops `allowlist`
- `server/lib/password.ts` — scrypt hash/verify (pure, side-effect free)
- `server/lib/password.test.ts`
- `server/lib/users.ts` — user lookup/create + thin wrappers
- `server/lib/users.test.ts`
- `server/lib/bootstrap.ts` — env-var admin bootstrap on server start
- `server/lib/bootstrap.test.ts`
- `server/routes/auth.test.ts` — handler tests for `me`/`setup`/`login`/`logout`
- `src/pages/Login.tsx`
- `src/pages/Setup.tsx`
- `src/components/SettingsForm.tsx` — extracted from `Settings.tsx` so Setup can reuse

**Rewritten files:**
- `src/storage/sqlite/schema.ts` (add `users`, drop `allowlist`)
- `src/storage/adapter.ts` (drop `listAllowedEmails`, add user methods)
- `src/storage/sqlite/adapter.ts` (drop `listAllowedEmails`, add user methods)
- `server/lib/testHelpers.ts` (drop `allowedEmails`, add users to memory adapter)
- `server/lib/session.ts` (payload `{userId}`, drop OAuthStateSession)
- `server/lib/requireUser.ts` (DB lookup; no AUTH_MODE)
- `server/routes/auth.ts` (me/setup/login/logout)
- `server/index.ts` (call `maybeBootstrapAdmin`, drop AUTH_MODE log)
- `server/routes/handlers.test.ts` (new auth shim mocks)
- `src/hooks/useAuth.ts` (new state shape with `needs-setup`)
- `src/components/AuthGate.tsx` (render Login/Setup based on status)
- `src/App.tsx` (use new auth shape)
- `src/components/Nav.tsx` (real logout; new user type)
- `src/pages/Settings.tsx` (consume extracted `SettingsForm`)
- `README.md`, `.env.example`, `docker-compose.yml`, `CLAUDE.md` (env + docs)

**Deleted files:**
- `server/lib/oauthGoogle.ts`
- `server/lib/allowlist.ts`
- `src/auth/adapter.ts`, `src/auth/rest.ts`, `src/auth/noauth.ts` (entire `src/auth/` directory)

---

## Task 1: Add `users` schema + migration `0002`

**Files:**
- Modify: `src/storage/sqlite/schema.ts`
- Create: `src/storage/sqlite/migrations/0002_local_auth.sql`
- Create: `src/storage/sqlite/migrations/meta/0002_snapshot.json` (Drizzle-generated)

- [ ] **Step 1: Add `users` table and remove `allowlist` from `schema.ts`**

Modify `src/storage/sqlite/schema.ts`:

Remove the existing `allowlist` table declaration entirely. After the `pendingUrls` declaration, add:

```ts
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role').$type<'admin'>().notNull().default('admin'),
  createdAt: integer('created_at').notNull(),
})
```

- [ ] **Step 2: Generate Drizzle migration**

Run: `bunx drizzle-kit generate --config drizzle.config.ts`
Expected: creates `src/storage/sqlite/migrations/0002_*.sql` and updates `meta/_journal.json`.

Rename the generated SQL file to `0002_local_auth.sql` (and update the entry in `meta/_journal.json` accordingly if Drizzle named it differently). Verify its contents match:

```sql
CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `password_hash` text NOT NULL,
  `display_name` text NOT NULL,
  `role` text DEFAULT 'admin' NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
DROP TABLE `allowlist`;
```

If Drizzle generated it in a different order, manually reorder so `DROP TABLE allowlist` is last.

- [ ] **Step 3: Run typecheck to confirm no broken imports yet**

Run: `bun run lint`
Expected: errors about `allowlist` being undefined in `src/storage/sqlite/adapter.ts` and `server/lib/testHelpers.ts`. **That's expected** — we'll fix them in the next tasks. Note them and move on.

- [ ] **Step 4: Commit**

```bash
git add src/storage/sqlite/schema.ts src/storage/sqlite/migrations/
git commit -m "feat(db): add users table, drop allowlist in migration 0002"
```

---

## Task 2: scrypt password module (TDD)

**Files:**
- Create: `server/lib/password.ts`
- Create: `server/lib/password.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/lib/password.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password', () => {
  it('round-trips a password through hash + verify', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('produces different hashes for the same password (random salt)', async () => {
    const a = await hashPassword('same-password-1234')
    const b = await hashPassword('same-password-1234')
    expect(a).not.toBe(b)
    expect(await verifyPassword('same-password-1234', a)).toBe(true)
    expect(await verifyPassword('same-password-1234', b)).toBe(true)
  })

  it('returns false on a malformed hash string instead of throwing', async () => {
    expect(await verifyPassword('whatever', 'not-a-real-hash')).toBe(false)
    expect(await verifyPassword('whatever', 'scrypt$broken')).toBe(false)
    expect(await verifyPassword('whatever', '')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `bun run test server/lib/password.test.ts`
Expected: FAIL with "Cannot find module './password'".

- [ ] **Step 3: Implement `password.ts`**

Create `server/lib/password.ts`:

```ts
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem?: number },
) => Promise<Buffer>

const N = 1 << 15 // CPU/memory cost
const R = 8
const P = 1
const KEYLEN = 64
const SALT_BYTES = 16
const MAXMEM = 128 * N * R * 4 // headroom above node's default

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const derived = await scryptAsync(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${derived.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$')
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false
    const n = Number(parts[1])
    const r = Number(parts[2])
    const p = Number(parts[3])
    if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false
    const salt = Buffer.from(parts[4], 'base64')
    const expected = Buffer.from(parts[5], 'base64')
    if (salt.length === 0 || expected.length === 0) return false
    const derived = await scryptAsync(password, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: MAXMEM,
    })
    if (derived.length !== expected.length) return false
    return timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

// Pre-computed hash of a value that can never match a real password.
// Used by the login route to keep the timing of "no such user" similar to
// "user exists but wrong password" so we don't leak account existence.
let dummyHashCache: string | null = null
export async function getDummyHash(): Promise<string> {
  if (dummyHashCache) return dummyHashCache
  dummyHashCache = await hashPassword('jobvault-dummy-hash-not-a-real-password')
  return dummyHashCache
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `bun run test server/lib/password.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/lib/password.ts server/lib/password.test.ts
git commit -m "feat(auth): scrypt password hash/verify with timing-safe dummy"
```

---

## Task 3: Add user methods to `DataAdapter` + SQLite implementation + memory adapter

**Files:**
- Modify: `src/storage/adapter.ts`
- Modify: `src/storage/sqlite/adapter.ts`
- Modify: `server/lib/testHelpers.ts`

- [ ] **Step 1: Update `DataAdapter` interface**

Modify `src/storage/adapter.ts`. Replace the file body with:

```ts
import type { AiSettingsRow, Application, PendingUrl } from '@/types'

export type NewApplication = Omit<Application, 'id' | 'createdAt'>
export type NewPendingUrl = Omit<PendingUrl, 'id' | 'createdAt'>

export interface StoredLocalUser {
  id: string
  email: string
  passwordHash: string
  displayName: string
  role: 'admin'
  createdAt: number
}

export type NewLocalUser = Omit<StoredLocalUser, 'id' | 'createdAt'>

export interface DataAdapter {
  listApplications(): Promise<Application[]>
  getApplication(id: string): Promise<Application | null>
  createApplication(input: NewApplication): Promise<Application>
  updateApplication(id: string, patch: Partial<Application>): Promise<void>
  deleteApplication(id: string): Promise<void>

  listPendingUrls(): Promise<PendingUrl[]>
  createPendingUrls(inputs: NewPendingUrl[]): Promise<PendingUrl[]>
  updatePendingUrl(id: string, patch: Partial<PendingUrl>): Promise<void>
  deletePendingUrl(id: string): Promise<void>

  approvePending(pendingId: string, application: NewApplication): Promise<Application>

  countUsers(): Promise<number>
  findUserById(id: string): Promise<StoredLocalUser | null>
  findUserByEmail(email: string): Promise<StoredLocalUser | null>
  createUser(input: NewLocalUser): Promise<StoredLocalUser>

  getAiSettings(): Promise<AiSettingsRow | null>
  setAiSettings(patch: Partial<Omit<AiSettingsRow, 'updatedAt'>>): Promise<void>
}
```

Note `listAllowedEmails` is gone.

- [ ] **Step 2: Update `SqliteDataAdapter`**

Modify `src/storage/sqlite/adapter.ts`:

1. Update the import line `import { aiSettings, allowlist, applications, pendingUrls } from './schema'` to:
   ```ts
   import { aiSettings, applications, pendingUrls, users } from './schema'
   ```

2. Update the `import type` line at the top to include `NewLocalUser` and `StoredLocalUser`:
   ```ts
   import type { DataAdapter, NewApplication, NewLocalUser, NewPendingUrl, StoredLocalUser } from '../adapter'
   ```

3. Delete the `listAllowedEmails` method (the one at `src/storage/sqlite/adapter.ts:164-167`).

4. Add these methods immediately before `getAiSettings`:

   ```ts
   async countUsers(): Promise<number> {
     const rows = await this.db.select({ id: users.id }).from(users)
     return rows.length
   }

   async findUserById(id: string): Promise<StoredLocalUser | null> {
     const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1)
     const r = rows[0]
     return r ? rowToUser(r) : null
   }

   async findUserByEmail(email: string): Promise<StoredLocalUser | null> {
     const normalized = email.trim().toLowerCase()
     const rows = await this.db.select().from(users).where(eq(users.email, normalized)).limit(1)
     const r = rows[0]
     return r ? rowToUser(r) : null
   }

   async createUser(input: NewLocalUser): Promise<StoredLocalUser> {
     const row: typeof users.$inferInsert = {
       id: crypto.randomUUID(),
       email: input.email.trim().toLowerCase(),
       passwordHash: input.passwordHash,
       displayName: input.displayName,
       role: input.role,
       createdAt: Date.now(),
     }
     await this.db.insert(users).values(row)
     return rowToUser(row as typeof users.$inferSelect)
   }
   ```

5. Add a `rowToUser` helper near the other row mappers (after `rowToPending`):

   ```ts
   type UserRow = typeof users.$inferSelect

   function rowToUser(r: UserRow): StoredLocalUser {
     return {
       id: r.id,
       email: r.email,
       passwordHash: r.passwordHash,
       displayName: r.displayName,
       role: r.role,
       createdAt: r.createdAt,
     }
   }
   ```

- [ ] **Step 3: Update `memoryAdapter` in `testHelpers.ts`**

Replace the body of `server/lib/testHelpers.ts` with:

```ts
import type { AiSettingsRow, Application, PendingUrl } from '@/types'
import type {
  DataAdapter,
  NewApplication,
  NewLocalUser,
  NewPendingUrl,
  StoredLocalUser,
} from '@/storage/adapter'

let nextId = 1
function id(): string {
  nextId += 1
  return `id_${nextId}`
}

export function memoryAdapter(initial: { users?: StoredLocalUser[] } = {}): DataAdapter {
  const apps: Application[] = []
  const pendings: PendingUrl[] = []
  const users: StoredLocalUser[] = (initial.users ?? []).slice()
  let aiSettings: AiSettingsRow | null = null

  return {
    async listApplications() {
      return apps.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    },
    async getApplication(appId) {
      return apps.find(a => a.id === appId) ?? null
    },
    async createApplication(input: NewApplication) {
      const app: Application = { ...input, id: id(), createdAt: Date.now() }
      apps.push(app)
      return app
    },
    async updateApplication(appId, patch) {
      const i = apps.findIndex(a => a.id === appId)
      if (i === -1) return
      apps[i] = { ...apps[i], ...patch }
    },
    async deleteApplication(appId) {
      const i = apps.findIndex(a => a.id === appId)
      if (i !== -1) apps.splice(i, 1)
    },
    async listPendingUrls() {
      return pendings.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    },
    async createPendingUrls(inputs: NewPendingUrl[]) {
      const created = inputs.map(p => ({ ...p, id: id(), createdAt: Date.now() }))
      pendings.push(...created)
      return created
    },
    async updatePendingUrl(pendingId, patch) {
      const i = pendings.findIndex(p => p.id === pendingId)
      if (i === -1) return
      pendings[i] = { ...pendings[i], ...patch }
    },
    async deletePendingUrl(pendingId) {
      const i = pendings.findIndex(p => p.id === pendingId)
      if (i !== -1) pendings.splice(i, 1)
    },
    async approvePending(pendingId, application) {
      const i = pendings.findIndex(p => p.id === pendingId)
      if (i === -1) throw new Error(`pending_not_found:${pendingId}`)
      pendings.splice(i, 1)
      const app: Application = { ...application, id: id(), createdAt: Date.now() }
      apps.push(app)
      return app
    },
    async countUsers() {
      return users.length
    },
    async findUserById(userId) {
      return users.find(u => u.id === userId) ?? null
    },
    async findUserByEmail(email) {
      const t = email.trim().toLowerCase()
      return users.find(u => u.email === t) ?? null
    },
    async createUser(input: NewLocalUser) {
      const email = input.email.trim().toLowerCase()
      if (users.some(u => u.email === email)) {
        throw new Error('user_email_taken')
      }
      const user: StoredLocalUser = {
        id: id(),
        email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        role: input.role,
        createdAt: Date.now(),
      }
      users.push(user)
      return user
    },
    async getAiSettings() {
      return aiSettings ? { ...aiSettings } : null
    },
    async setAiSettings(patch) {
      const base: AiSettingsRow = aiSettings ?? {
        provider: 'minimax',
        apiKey: '',
        model: '',
        baseUrl: '',
        updatedAt: 0,
      }
      aiSettings = { ...base, ...patch, updatedAt: Date.now() }
    },
  }
}
```

- [ ] **Step 4: Run the existing storage adapter test**

Run: `bun run test src/storage/sqlite/adapter.test.ts`
Expected: existing tests still pass (the `listAllowedEmails` method is gone — search the test file; if the test references it, delete that test case. As of this plan there's no such test in `adapter.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/storage/adapter.ts src/storage/sqlite/adapter.ts server/lib/testHelpers.ts
git commit -m "feat(db): add user CRUD to DataAdapter, drop listAllowedEmails"
```

---

## Task 4: `server/lib/users.ts` thin wrapper (TDD)

**Files:**
- Create: `server/lib/users.ts`
- Create: `server/lib/users.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/lib/users.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryAdapter } from './testHelpers'
import type { DataAdapter } from '@/storage/adapter'

let adapter: DataAdapter
vi.mock('./db.ts', () => ({
  getAdapter: async () => adapter,
}))

const { countUsers, createUser, findUserByEmail, findUserById, verifyUserPassword } = await import(
  './users'
)

beforeEach(() => {
  adapter = memoryAdapter()
})

describe('users', () => {
  it('createUser stores a normalized email and a hashed password', async () => {
    const u = await createUser({
      email: '  User@Example.COM ',
      password: 'a-strong-password-1234',
      displayName: 'Alex',
    })
    expect(u.email).toBe('user@example.com')
    expect(u.role).toBe('admin')
    const stored = await adapter.findUserByEmail('user@example.com')
    expect(stored?.passwordHash.startsWith('scrypt$')).toBe(true)
    expect(stored?.passwordHash).not.toContain('a-strong-password-1234')
  })

  it('countUsers reflects createUser', async () => {
    expect(await countUsers()).toBe(0)
    await createUser({ email: 'a@b.com', password: 'a-strong-password-1234', displayName: 'A' })
    expect(await countUsers()).toBe(1)
  })

  it('findUserByEmail is case-insensitive', async () => {
    await createUser({ email: 'Hello@Example.com', password: 'a-strong-password-1234', displayName: 'H' })
    expect((await findUserByEmail('HELLO@example.COM'))?.email).toBe('hello@example.com')
  })

  it('verifyUserPassword returns user on match, null on mismatch', async () => {
    await createUser({ email: 'a@b.com', password: 'correct-horse-1234', displayName: 'A' })
    expect((await verifyUserPassword('a@b.com', 'correct-horse-1234'))?.email).toBe('a@b.com')
    expect(await verifyUserPassword('a@b.com', 'wrong')).toBeNull()
  })

  it('verifyUserPassword returns null and still spends time when user does not exist', async () => {
    const start = Date.now()
    expect(await verifyUserPassword('nobody@example.com', 'whatever-1234')).toBeNull()
    // Just confirm it did not throw and returned in reasonable time.
    expect(Date.now() - start).toBeLessThan(5000)
  })

  it('findUserById round-trips', async () => {
    const u = await createUser({ email: 'a@b.com', password: 'correct-horse-1234', displayName: 'A' })
    expect((await findUserById(u.id))?.email).toBe('a@b.com')
    expect(await findUserById('does-not-exist')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `bun run test server/lib/users.test.ts`
Expected: FAIL with "Cannot find module './users'".

- [ ] **Step 3: Implement `users.ts`**

Create `server/lib/users.ts`:

```ts
import type { StoredLocalUser } from '@/storage/adapter'
import { getAdapter } from './db.ts'
import { getDummyHash, hashPassword, verifyPassword } from './password.ts'

export interface CreateUserInput {
  email: string
  password: string
  displayName: string
}

export async function countUsers(): Promise<number> {
  return (await getAdapter()).countUsers()
}

export async function findUserById(id: string): Promise<StoredLocalUser | null> {
  return (await getAdapter()).findUserById(id)
}

export async function findUserByEmail(email: string): Promise<StoredLocalUser | null> {
  return (await getAdapter()).findUserByEmail(email)
}

export async function createUser(input: CreateUserInput): Promise<StoredLocalUser> {
  const passwordHash = await hashPassword(input.password)
  return (await getAdapter()).createUser({
    email: input.email,
    displayName: input.displayName,
    passwordHash,
    role: 'admin',
  })
}

export async function verifyUserPassword(
  email: string,
  password: string,
): Promise<StoredLocalUser | null> {
  const user = await findUserByEmail(email)
  if (!user) {
    // Spend roughly the same time as a real verify to avoid leaking
    // existence via timing.
    await verifyPassword(password, await getDummyHash())
    return null
  }
  const ok = await verifyPassword(password, user.passwordHash)
  return ok ? user : null
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `bun run test server/lib/users.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/lib/users.ts server/lib/users.test.ts
git commit -m "feat(auth): users.ts wrapper with timing-safe verify"
```

---

## Task 5: Session module — switch payload to `{userId}` and drop OAuth state

**Files:**
- Modify: `server/lib/session.ts`

- [ ] **Step 1: Rewrite `session.ts`**

Replace the entire body of `server/lib/session.ts` with:

```ts
import type { Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { sealData, unsealData } from 'iron-session'

export interface AppSession {
  userId?: string
}

const APP_COOKIE = 'app_session'
const APP_MAX_AGE_SEC = 60 * 60 * 24 * 30

function sessionPassword(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters')
  }
  return s
}

function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'Lax' as const,
    path: '/',
    maxAge,
  }
}

export async function getAppSession(c: Context): Promise<AppSession> {
  const raw = getCookie(c, APP_COOKIE)
  if (!raw) return {}
  try {
    return (await unsealData<AppSession>(raw, { password: sessionPassword() })) ?? {}
  } catch {
    return {}
  }
}

export async function saveAppSession(c: Context, data: AppSession): Promise<void> {
  const sealed = await sealData(data, { password: sessionPassword(), ttl: APP_MAX_AGE_SEC })
  setCookie(c, APP_COOKIE, sealed, cookieOpts(APP_MAX_AGE_SEC))
}

export function destroyAppSession(c: Context): void {
  deleteCookie(c, APP_COOKIE, { path: '/' })
}
```

- [ ] **Step 2: Quick build check**

Run: `bun run lint`
Expected: errors about `readSessionUser`, `OAuthStateSession`, `getOAuthStateSession`, `saveOAuthStateSession`, `destroyOAuthStateSession` still being referenced from `oauthGoogle.ts`, `routes/auth.ts`, `requireUser.ts`, `handlers.test.ts`. We fix those in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add server/lib/session.ts
git commit -m "refactor(auth): session payload is {userId}, drop OAuth state cookie"
```

---

## Task 6: Rewrite `requireUser.ts` for local-only auth

**Files:**
- Modify: `server/lib/requireUser.ts`

- [ ] **Step 1: Replace `requireUser.ts`**

Replace the entire body of `server/lib/requireUser.ts` with:

```ts
import type { Context } from 'hono'
import type { StoredLocalUser } from '@/storage/adapter'
import { getAppSession } from './session.ts'
import { findUserById } from './users.ts'

export type UserResult =
  | { ok: true; user: StoredLocalUser }
  | { ok: false; status: 401; error: 'unauthenticated' }

export async function requireUser(c: Context): Promise<UserResult> {
  const session = await getAppSession(c)
  if (!session.userId) return { ok: false, status: 401, error: 'unauthenticated' }
  const user = await findUserById(session.userId)
  if (!user) return { ok: false, status: 401, error: 'unauthenticated' }
  return { ok: true, user }
}
```

- [ ] **Step 2: Update call sites that read `auth.user.uid`**

`server/routes/applications.ts:29` uses `auth.user.uid`. The new `StoredLocalUser` shape uses `id`. Update — also check `pending.ts`, `extract.ts`, `settings.ts`, and any other route. Run:

```bash
grep -rn "auth\.user\.uid" server/
```

For each match, replace `auth.user.uid` with `auth.user.id`.

- [ ] **Step 3: Run lint**

Run: `bun run lint`
Expected: errors now move to references in `routes/auth.ts` (still importing OAuth helpers), `oauthGoogle.ts`, `allowlist.ts`, and tests. Continue.

- [ ] **Step 4: Commit**

```bash
git add server/lib/requireUser.ts server/routes/
git commit -m "refactor(auth): requireUser uses local DB lookup, drops AUTH_MODE"
```

---

## Task 7: Rewrite `routes/auth.ts` + new handler tests

**Files:**
- Modify: `server/routes/auth.ts`
- Create: `server/routes/auth.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/routes/auth.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { memoryAdapter } from '../lib/testHelpers'
import { _resetRateLimitForTests } from '../lib/rateLimit'
import type { DataAdapter } from '@/storage/adapter'

let adapter: DataAdapter
let session: { userId?: string } = {}

vi.mock('../lib/db.ts', () => ({
  getAdapter: async () => adapter,
}))

vi.mock('../lib/session.ts', () => ({
  getAppSession: async () => session,
  saveAppSession: async (_c: unknown, data: { userId?: string }) => {
    session = { ...data }
  },
  destroyAppSession: () => {
    session = {}
  },
}))

const authRoute = (await import('./auth')).default

function buildApp() {
  const app = new Hono()
  app.route('/api/auth', authRoute)
  return app
}

async function json(app: Hono, url: string, method: string, body?: unknown) {
  return app.request(url, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  adapter = memoryAdapter()
  session = {}
  _resetRateLimitForTests()
})

describe('GET /api/auth/me', () => {
  it('returns needs-setup when no users exist', async () => {
    const r = await buildApp().request('/api/auth/me')
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ status: 'needs-setup' })
  })

  it('returns signed-out when users exist but no session', async () => {
    await adapter.createUser({
      email: 'a@b.com',
      passwordHash: 'scrypt$x$y$z$AA==$BB==',
      displayName: 'A',
      role: 'admin',
    })
    const r = await buildApp().request('/api/auth/me')
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ status: 'signed-out' })
  })

  it('returns signed-in when session matches a user', async () => {
    const u = await adapter.createUser({
      email: 'a@b.com',
      passwordHash: 'scrypt$x$y$z$AA==$BB==',
      displayName: 'A',
      role: 'admin',
    })
    session = { userId: u.id }
    const r = await buildApp().request('/api/auth/me')
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({
      status: 'signed-in',
      user: { id: u.id, email: 'a@b.com', displayName: 'A', role: 'admin' },
    })
  })

  it('falls back to signed-out when session userId references a deleted user', async () => {
    session = { userId: 'ghost' }
    const r = await buildApp().request('/api/auth/me')
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ status: 'needs-setup' })
  })
})

describe('POST /api/auth/setup', () => {
  it('creates the first admin and signs them in', async () => {
    const r = await json(buildApp(), '/api/auth/setup', 'POST', {
      displayName: 'Alex',
      email: 'Alex@Example.com',
      password: 'correct-horse-battery-staple',
    })
    expect(r.status).toBe(200)
    const body = (await r.json()) as { status: string; user: { email: string } }
    expect(body.status).toBe('signed-in')
    expect(body.user.email).toBe('alex@example.com')
    expect(session.userId).toBeDefined()
  })

  it('returns 410 once a user already exists', async () => {
    await adapter.createUser({
      email: 'a@b.com',
      passwordHash: 'scrypt$x$y$z$AA==$BB==',
      displayName: 'A',
      role: 'admin',
    })
    const r = await json(buildApp(), '/api/auth/setup', 'POST', {
      displayName: 'Alex',
      email: 'alex@example.com',
      password: 'correct-horse-battery-staple',
    })
    expect(r.status).toBe(410)
    expect(await r.json()).toEqual({ error: 'setup_already_complete' })
  })

  it('rejects passwords shorter than 12 chars', async () => {
    const r = await json(buildApp(), '/api/auth/setup', 'POST', {
      displayName: 'Alex',
      email: 'alex@example.com',
      password: 'short',
    })
    expect(r.status).toBe(400)
  })

  it('rejects malformed emails', async () => {
    const r = await json(buildApp(), '/api/auth/setup', 'POST', {
      displayName: 'Alex',
      email: 'not-an-email',
      password: 'correct-horse-battery-staple',
    })
    expect(r.status).toBe(400)
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    // We need a real hash here, so use the users module to create one.
    const { createUser } = await import('../lib/users')
    await createUser({
      email: 'alex@example.com',
      password: 'correct-horse-battery-staple',
      displayName: 'Alex',
    })
  })

  it('signs in with valid credentials (case-insensitive email)', async () => {
    const r = await json(buildApp(), '/api/auth/login', 'POST', {
      email: 'Alex@Example.com',
      password: 'correct-horse-battery-staple',
    })
    expect(r.status).toBe(200)
    const body = (await r.json()) as { status: string }
    expect(body.status).toBe('signed-in')
    expect(session.userId).toBeDefined()
  })

  it('returns 401 generic error on bad password', async () => {
    const r = await json(buildApp(), '/api/auth/login', 'POST', {
      email: 'alex@example.com',
      password: 'wrong-but-long-enough',
    })
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ error: 'invalid_credentials' })
    expect(session.userId).toBeUndefined()
  })

  it('returns 401 generic error on unknown email (no enumeration)', async () => {
    const r = await json(buildApp(), '/api/auth/login', 'POST', {
      email: 'nobody@example.com',
      password: 'correct-horse-battery-staple',
    })
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ error: 'invalid_credentials' })
  })

  it('rate-limits after repeated failures', async () => {
    const app = buildApp()
    for (let i = 0; i < 5; i++) {
      await json(app, '/api/auth/login', 'POST', {
        email: 'alex@example.com',
        password: 'wrong-but-long-enough',
      })
    }
    const r = await json(app, '/api/auth/login', 'POST', {
      email: 'alex@example.com',
      password: 'correct-horse-battery-staple',
    })
    expect(r.status).toBe(429)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the session', async () => {
    session = { userId: 'someone' }
    const r = await buildApp().request('/api/auth/logout', { method: 'POST' })
    expect(r.status).toBe(204)
    expect(session.userId).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `bun run test server/routes/auth.test.ts`
Expected: tests fail because the route exports the old OAuth-shape responses.

- [ ] **Step 3: Replace `routes/auth.ts`**

Replace the entire body of `server/routes/auth.ts` with:

```ts
import { Hono } from 'hono'
import { z } from 'zod'
import { parseBody } from '../lib/parseBody.ts'
import { rateLimit } from '../lib/rateLimit.ts'
import {
  destroyAppSession,
  getAppSession,
  saveAppSession,
} from '../lib/session.ts'
import {
  countUsers,
  createUser,
  findUserById,
  verifyUserPassword,
} from '../lib/users.ts'

const app = new Hono()

function clientIp(c: import('hono').Context): string {
  const xff = c.req.header('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return 'anon'
}

const setupSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(200),
})

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
})

function toPublicUser(u: { id: string; email: string; displayName: string; role: 'admin' }) {
  return { id: u.id, email: u.email, displayName: u.displayName, role: u.role }
}

app.get('/me', async c => {
  const userCount = await countUsers()
  if (userCount === 0) return c.json({ status: 'needs-setup' })
  const session = await getAppSession(c)
  if (!session.userId) return c.json({ status: 'signed-out' })
  const user = await findUserById(session.userId)
  if (!user) {
    // Session refers to a deleted user. If the DB is now empty, fall back to
    // needs-setup so the UI shows the setup flow rather than a dead login.
    if ((await countUsers()) === 0) return c.json({ status: 'needs-setup' })
    return c.json({ status: 'signed-out' })
  }
  return c.json({ status: 'signed-in', user: toPublicUser(user) })
})

app.post('/setup', async c => {
  if ((await countUsers()) > 0) {
    return c.json({ error: 'setup_already_complete' }, 410)
  }
  const limit = rateLimit(`setup:${clientIp(c)}`)
  if (!limit.ok) {
    c.header('Retry-After', String(limit.retryAfterSec))
    return c.json({ error: 'rate_limited', retryAfterSec: limit.retryAfterSec }, 429)
  }
  const parsed = await parseBody(c, setupSchema)
  if (!parsed.ok) return parsed.response

  // Re-check atomically (race against another concurrent setup request).
  if ((await countUsers()) > 0) {
    return c.json({ error: 'setup_already_complete' }, 410)
  }

  const user = await createUser(parsed.data)
  await saveAppSession(c, { userId: user.id })
  return c.json({ status: 'signed-in', user: toPublicUser(user) })
})

app.post('/login', async c => {
  const limit = rateLimit(`login:${clientIp(c)}`)
  if (!limit.ok) {
    c.header('Retry-After', String(limit.retryAfterSec))
    return c.json({ error: 'rate_limited', retryAfterSec: limit.retryAfterSec }, 429)
  }
  const parsed = await parseBody(c, loginSchema)
  if (!parsed.ok) return parsed.response
  const user = await verifyUserPassword(parsed.data.email, parsed.data.password)
  if (!user) return c.json({ error: 'invalid_credentials' }, 401)
  await saveAppSession(c, { userId: user.id })
  return c.json({ status: 'signed-in', user: toPublicUser(user) })
})

app.post('/logout', c => {
  destroyAppSession(c)
  return c.body(null, 204)
})

export default app
```

- [ ] **Step 4: Run tests to verify pass**

Run: `bun run test server/routes/auth.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/routes/auth.ts server/routes/auth.test.ts
git commit -m "feat(auth): local email/password routes + /api/auth/me state machine"
```

---

## Task 8: Bootstrap from `ADMIN_EMAIL` + `ADMIN_PASSWORD` env vars (TDD)

**Files:**
- Create: `server/lib/bootstrap.ts`
- Create: `server/lib/bootstrap.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/lib/bootstrap.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `bun run test server/lib/bootstrap.test.ts`
Expected: FAIL with "Cannot find module './bootstrap'".

- [ ] **Step 3: Implement `bootstrap.ts`**

Create `server/lib/bootstrap.ts`:

```ts
import { countUsers, createUser, findUserByEmail } from './users.ts'

const MIN_PASSWORD_LEN = 12

export async function maybeBootstrapAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  const displayNameEnv = process.env.ADMIN_DISPLAY_NAME?.trim()

  if (!email && !password) return

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set together (or both left unset).',
    )
  }

  if (password.length < MIN_PASSWORD_LEN) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LEN} characters.`)
  }

  if ((await countUsers()) > 0) return

  // Defense in depth: if the email is already taken (e.g. someone is racing the
  // bootstrap), skip rather than error so server start is idempotent.
  if (await findUserByEmail(email)) return

  const displayName = displayNameEnv && displayNameEnv.length > 0 ? displayNameEnv : email.split('@')[0]
  await createUser({ email, password, displayName })
  console.log(`[bootstrap] Created admin user ${email} from ADMIN_EMAIL/ADMIN_PASSWORD env vars.`)
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `bun run test server/lib/bootstrap.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/lib/bootstrap.ts server/lib/bootstrap.test.ts
git commit -m "feat(auth): headless ADMIN_EMAIL/ADMIN_PASSWORD bootstrap"
```

---

## Task 9: Wire bootstrap into server entry; drop legacy AUTH_MODE log

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Update `server/index.ts`**

Replace the section from `await getAdapter()` through the `console.log` lines (`server/index.ts:48-52`) with:

```ts
await getAdapter()
await (await import('./lib/bootstrap.ts')).maybeBootstrapAdmin()

console.log(`Listening on http://localhost:${port}`)
console.log(`  DATABASE_URL=${process.env.DATABASE_URL ?? 'file:./data/app.db'}`)
```

(The AUTH_MODE log line is gone; we add the bootstrap call after migrations have run.)

- [ ] **Step 2: Smoke-start the server**

Run: `SESSION_SECRET=$(openssl rand -base64 48) DATABASE_URL=file:./data/dev-bootstrap-test.db ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=correct-horse-1234 timeout 5 bun run start; rm -f ./data/dev-bootstrap-test.db`

Expected: server starts, logs `[bootstrap] Created admin user admin@example.com ...`, then `Listening on http://localhost:3000`. The `timeout 5` kills it after 5s with exit code 124; that's fine.

- [ ] **Step 3: Commit**

```bash
git add server/index.ts
git commit -m "feat(server): call maybeBootstrapAdmin on boot"
```

---

## Task 10: Delete legacy backend files + clean up `handlers.test.ts`

**Files:**
- Delete: `server/lib/oauthGoogle.ts`
- Delete: `server/lib/allowlist.ts`
- Modify: `server/routes/handlers.test.ts`

- [ ] **Step 1: Delete the OAuth + allowlist modules**

```bash
rm server/lib/oauthGoogle.ts server/lib/allowlist.ts
```

- [ ] **Step 2: Rewrite the auth-shim section of `handlers.test.ts`**

Modify `server/routes/handlers.test.ts`:

1. Replace the imports at the top with:
   ```ts
   import { beforeEach, describe, expect, it, vi } from 'vitest'
   import { Hono } from 'hono'
   import { memoryAdapter } from '../lib/testHelpers'
   import { _resetRateLimitForTests } from '../lib/rateLimit'
   import { MAX_PENDING_BATCH } from '../lib/validation'
   import type { DataAdapter, StoredLocalUser } from '@/storage/adapter'
   ```

2. Replace the module state and mocks (the `let adapter:` line through the second `vi.mock` block) with:
   ```ts
   let adapter: DataAdapter
   let sessionUser: StoredLocalUser | null = null

   vi.mock('../lib/db.ts', () => ({
     getAdapter: async () => adapter,
   }))

   vi.mock('../lib/session.ts', () => ({
     getAppSession: async () => (sessionUser ? { userId: sessionUser.id } : {}),
     saveAppSession: async () => {},
     destroyAppSession: () => {},
   }))

   vi.mock('../lib/users.ts', () => ({
     countUsers: async () => (sessionUser ? 1 : 0),
     findUserById: async (id: string) => (sessionUser && sessionUser.id === id ? sessionUser : null),
     findUserByEmail: async () => null,
     createUser: async () => sessionUser!,
     verifyUserPassword: async () => null,
   }))
   ```

3. Replace the entire `describe('auth shim', () => { ... })` block (lines 63–134 in the original) with:
   ```ts
   describe('auth shim', () => {
     it('returns 401 when no session is set', async () => {
       const r = await buildApp().request('/api/applications')
       expect(r.status).toBe(401)
       expect(await r.json()).toEqual({ error: 'unauthenticated' })
     })

     it('returns 401 when session points to a missing user', async () => {
       sessionUser = null
       const r = await buildApp().request('/api/applications')
       expect(r.status).toBe(401)
     })

     it('serves a request when a session user is present', async () => {
       sessionUser = {
         id: 'u-1',
         email: 'a@b.com',
         passwordHash: 'scrypt$x$y$z$AA==$BB==',
         displayName: 'A',
         role: 'admin',
         createdAt: 0,
       }
       const r = await buildApp().request('/api/applications')
       expect(r.status).toBe(200)
     })
   })
   ```

4. In `beforeEach`, delete the env-cleanup lines (`delete process.env.AUTH_MODE`, etc.) — those env vars are gone:
   ```ts
   beforeEach(() => {
     adapter = memoryAdapter()
     sessionUser = null
     _resetRateLimitForTests()
   })
   ```

5. Update the existing test "creates with server-stamped addedBy/addedByName" (around line 147). It currently expects `body.addedBy === 'local'`. After the refactor, `addedBy` comes from `auth.user.id`. With the new mock above, the signed-in test user has `id: 'u-1'`. Set `sessionUser` at the start of the body of any test that requires authentication:

   For the `POST /api/applications` tests, the `PATCH` tests, the `DELETE` test, and all the pending tests — add this line at the top of each `it` body that needs an authenticated request:
   ```ts
   sessionUser = { id: 'u-1', email: 'a@b.com', passwordHash: 'x', displayName: 'A', role: 'admin', createdAt: 0 }
   ```

   Then update the assertions that check `addedBy === 'local'` and `addedByName === 'Local User'` to expect `'u-1'` and `'A'` respectively. Similarly the existing tests that hard-code `addedBy: 'local'` when seeding rows via `adapter.createApplication` should use whatever value is convenient (the values are not asserted further).

- [ ] **Step 3: Run tests**

Run: `bun run test server/routes/handlers.test.ts`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/routes/handlers.test.ts server/lib/
git commit -m "refactor(auth): delete OAuth + allowlist modules; update handler tests"
```

---

## Task 11: Drop `listAllowedEmails` from the SQLite adapter test (if present)

**Files:**
- Modify (maybe): `src/storage/sqlite/adapter.test.ts`

- [ ] **Step 1: Search for stale allowlist references**

Run: `grep -n "allowlist\|listAllowedEmails" src/storage/sqlite/adapter.test.ts`

If matches exist, delete those test cases. The schema and adapter no longer expose those.

- [ ] **Step 2: Run the storage adapter tests**

Run: `bun run test src/storage/sqlite/adapter.test.ts`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/storage/sqlite/adapter.test.ts
git commit -m "test: drop allowlist references from sqlite adapter test"
```

(If nothing changed, skip the commit.)

---

## Task 12: Extract `SettingsForm` so Setup step 2 can reuse it

**Files:**
- Create: `src/components/SettingsForm.tsx`
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Move `SettingsForm` and the `Field` helper out**

Create `src/components/SettingsForm.tsx` with the contents of the existing `SettingsForm` component plus the `Field` helper from `src/pages/Settings.tsx:17-25`. Make `SettingsForm` and `Field` named exports:

```tsx
import { useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import type { AiProviderId } from '@/types'
import type { AiSettingsPatch, AiSettingsView } from '@/lib/aiSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {hint ? <p className="text-xs text-[var(--color-muted-foreground)]">{hint}</p> : null}
    </div>
  )
}

export function SettingsForm({
  data,
  save,
  test,
}: {
  data: AiSettingsView
  save: (patch: AiSettingsPatch) => Promise<boolean>
  test: (patch: AiSettingsPatch) => Promise<boolean>
}) {
  // ... full body identical to the existing SettingsForm in src/pages/Settings.tsx
}
```

(Copy the existing function body verbatim — see `src/pages/Settings.tsx:27-180`.)

- [ ] **Step 2: Update `Settings.tsx` to import from the new location**

In `src/pages/Settings.tsx`, delete the `Field` helper (lines 17–25) and the `SettingsForm` component (lines 27–180). Add at the top:

```ts
import { SettingsForm } from '@/components/SettingsForm'
```

The default-exported `Settings` function stays exactly the same.

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: builds without errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsForm.tsx src/pages/Settings.tsx
git commit -m "refactor: extract SettingsForm to a shared component"
```

---

## Task 13: New `useAuth` hook with three-state machine

**Files:**
- Modify: `src/hooks/useAuth.ts`
- Delete: `src/auth/` (entire directory)
- Modify: `src/storage/rest/client.ts` (if it imports anything from `src/auth/`)

- [ ] **Step 1: Replace `useAuth.ts`**

Replace the body of `src/hooks/useAuth.ts`:

```ts
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
    void refresh()
  }, [refresh])

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
```

- [ ] **Step 2: Delete the old `src/auth/` directory**

```bash
rm -rf src/auth
```

- [ ] **Step 3: Fix any imports that referenced `@/auth/...`**

Run: `grep -rn "@/auth/" src/`

For each match, replace `import type { StoredUser } from '@/auth/adapter'` with `import type { AuthUser } from '@/hooks/useAuth'` and update the type name from `StoredUser` to `AuthUser` in that file. The `uid` field on `StoredUser` becomes `id` on `AuthUser`. Update any `user.uid` usages to `user.id`.

Likely hit files: `src/App.tsx`, `src/components/Nav.tsx`, `src/components/AuthGate.tsx` (we'll rewrite those next).

- [ ] **Step 4: Run typecheck**

Run: `bun run lint`
Expected: errors only inside `AuthGate.tsx`, `App.tsx`, and `Nav.tsx` (those reference old types and old auth shape — fixed in Tasks 14–17).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAuth.ts src/
git commit -m "feat(auth): useAuth hook with needs-setup/signed-out/signed-in states"
```

---

## Task 14: Login page

**Files:**
- Create: `src/pages/Login.tsx`

- [ ] **Step 1: Create the page**

Create `src/pages/Login.tsx`:

```tsx
import { useState } from 'react'
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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        headers: { 'content-type': 'application/json' },
      })
      onSignedIn()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('Invalid email or password.')
      } else if (e instanceof ApiError && e.status === 429) {
        setError('Too many attempts. Try again in a minute.')
      } else {
        setError(e instanceof Error ? e.message : String(e))
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
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: builds without errors (Login is not wired into the app yet, but it should at least typecheck).

- [ ] **Step 3: Commit**

```bash
git add src/pages/Login.tsx
git commit -m "feat(ui): Login page"
```

---

## Task 15: Setup page (two-step wizard)

**Files:**
- Create: `src/pages/Setup.tsx`

- [ ] **Step 1: Create the page**

Create `src/pages/Setup.tsx`:

```tsx
import { useState } from 'react'
import { Loader2, Sparkles, UserPlus } from 'lucide-react'
import { apiFetch, ApiError } from '@/storage/rest/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SettingsForm } from '@/components/SettingsForm'
import { useAiSettings } from '@/hooks/useAiSettings'

type Step = 'account' | 'ai'

export function Setup({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>('account')
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-4">
        <Steps current={step} />
        {step === 'account' ? (
          <AccountStep onDone={() => setStep('ai')} />
        ) : (
          <AiStep onDone={onComplete} />
        )}
      </div>
    </div>
  )
}

function Steps({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-[var(--color-muted-foreground)]">
      <span className={current === 'account' ? 'font-medium text-[var(--color-foreground)]' : ''}>
        1. Account
      </span>
      <span>›</span>
      <span className={current === 'ai' ? 'font-medium text-[var(--color-foreground)]' : ''}>
        2. AI provider (optional)
      </span>
    </div>
  )
}

function AccountStep({ onDone }: { onDone: () => void }) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validate(): string | null {
    if (!displayName.trim()) return 'Display name is required.'
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Enter a valid email.'
    if (password.length < 12) return 'Password must be at least 12 characters.'
    if (password !== confirm) return 'Passwords do not match.'
    return null
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const msg = validate()
    if (msg) {
      setError(msg)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiFetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim(), email: email.trim(), password }),
      })
      onDone()
    } catch (e) {
      if (e instanceof ApiError && e.status === 410) {
        setError('Setup is already complete on this server. Reload to sign in.')
      } else {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="mx-auto mb-2 inline-flex size-10 items-center justify-center rounded-full bg-[var(--color-accent)]">
          <UserPlus className="size-5" />
        </div>
        <CardTitle className="text-center">Welcome to Jobvault</CardTitle>
        <p className="text-center text-sm text-[var(--color-muted-foreground)]">
          Create your account to get started. You'll be the only user on this instance.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <Input
            placeholder="Display name"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            autoComplete="name"
            required
            disabled={busy}
          />
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
            disabled={busy}
          />
          <Input
            type="password"
            placeholder="Password (min 12 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={12}
            disabled={busy}
          />
          <Input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            disabled={busy}
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Create account
          </Button>
          {error ? (
            <p className="text-center text-sm text-[var(--color-destructive)]">{error}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}

function AiStep({ onDone }: { onDone: () => void }) {
  const { data, loading, error, save, test } = useAiSettings()
  return (
    <Card>
      <CardHeader>
        <div className="mx-auto mb-2 inline-flex size-10 items-center justify-center rounded-full bg-[var(--color-accent)]">
          <Sparkles className="size-5" />
        </div>
        <CardTitle className="text-center">Set up an AI provider</CardTitle>
        <p className="text-center text-sm text-[var(--color-muted-foreground)]">
          Optional — used to auto-extract company, role, and salary from job-posting URLs.
          You can set this up later in Settings.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">Loading…</p>
        ) : error || !data ? (
          <p className="text-sm text-[var(--color-destructive)]">
            Failed to load settings: {error ?? 'unknown error'}
          </p>
        ) : (
          <SettingsForm key={`${data.source}:${data.effective.provider}`} data={data} save={save} test={test} />
        )}
        <Button variant="outline" className="w-full" onClick={onDone}>
          {data?.ready ? 'Continue' : 'Skip — I\'ll set this up later'}
        </Button>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: builds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Setup.tsx
git commit -m "feat(ui): two-step Setup wizard (account + AI provider)"
```

---

## Task 16: Rewrite `AuthGate` to render Setup / Login / app

**Files:**
- Modify: `src/components/AuthGate.tsx`

- [ ] **Step 1: Replace `AuthGate.tsx`**

Replace the body of `src/components/AuthGate.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Login } from '@/pages/Login'
import { Setup } from '@/pages/Setup'
import type { AuthState } from '@/hooks/useAuth'

export function AuthGate({ auth, children }: { auth: AuthState; children: ReactNode }) {
  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-[var(--color-muted-foreground)]">
        Loading…
      </div>
    )
  }

  if (auth.status === 'needs-setup') {
    return <Setup onComplete={auth.refresh} />
  }

  if (auth.status === 'signed-out') {
    return <Login onSignedIn={auth.refresh} />
  }

  return <>{children}</>
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: builds.

- [ ] **Step 3: Commit**

```bash
git add src/components/AuthGate.tsx
git commit -m "feat(ui): AuthGate routes between Setup, Login, and app"
```

---

## Task 17: Update `App.tsx` and `Nav.tsx` for the new auth shape

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Nav.tsx`

- [ ] **Step 1: Update `App.tsx`**

Modify `src/App.tsx`:

1. Replace `import type { StoredUser } from '@/auth/adapter'` with:
   ```ts
   import type { AuthUser } from '@/hooks/useAuth'
   ```

2. In the `AppShell` props type, change `user: StoredUser` to `user: AuthUser`.

3. Update the bottom of the file (the default `App` export) — replace lines 100-117 with:
   ```tsx
   export default function App() {
     const auth = useAuth()
     const [dark, toggleDark] = useDarkMode()
     return (
       <>
         <Toaster theme={dark ? 'dark' : 'light'} richColors position="bottom-right" />
         <AuthGate auth={auth}>
           {auth.user ? (
             <AppShell
               user={auth.user}
               onSignOut={auth.signOut}
               dark={dark}
               onToggleDark={toggleDark}
             />
           ) : null}
         </AuthGate>
       </>
     )
   }
   ```

   (Body is almost identical; just no longer references the old `StoredUser`.)

- [ ] **Step 2: Update `Nav.tsx`**

In `src/components/Nav.tsx`:

1. Replace `import type { StoredUser } from '@/auth/adapter'` with:
   ```ts
   import type { AuthUser } from '@/hooks/useAuth'
   ```

2. In the `Nav` props type, change `user: StoredUser | null` to `user: AuthUser | null`.

3. Anywhere the component renders `user.email` for display, keep it — the field still exists. If it renders `user.uid` anywhere, change to `user.id`.

- [ ] **Step 3: Run lint + build**

Run: `bun run lint && bun run build`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/Nav.tsx
git commit -m "refactor(ui): switch App + Nav to new AuthUser type"
```

---

## Task 18: End-to-end manual smoke test

**Files:** none

- [ ] **Step 1: Wipe local dev DB and start the server**

```bash
rm -f data/app.db
SESSION_SECRET=$(openssl rand -base64 48) bun run dev
```

(Run in one terminal. Vite serves the UI on :5173; the API on :3000.)

- [ ] **Step 2: First-run setup**

Open `http://localhost:5173`. Expected: redirected to the Setup page (step 1).

Fill in display name, email, and a 12+ character password. Submit. Expected: transitions to step 2 (AI provider).

Click "Skip — I'll set this up later." Expected: lands in the Dashboard, with your display name shown in Nav.

- [ ] **Step 3: Sign out + sign in**

Click "Sign out" in Nav. Expected: Login page appears.

Sign in with the same credentials. Expected: back in Dashboard.

Try wrong password. Expected: "Invalid email or password."

- [ ] **Step 4: Setup is locked**

Open a fresh incognito window to `http://localhost:5173/api/auth/setup` (or POST to it via curl):

```bash
curl -s -X POST http://localhost:3000/api/auth/setup \
  -H 'content-type: application/json' \
  -d '{"displayName":"X","email":"x@y.com","password":"correct-horse-1234"}'
```

Expected: `{"error":"setup_already_complete"}` with status 410.

- [ ] **Step 5: Bootstrap path**

Stop the server. Wipe the DB and try the env-var path:

```bash
rm -f data/app.db
SESSION_SECRET=$(openssl rand -base64 48) \
  ADMIN_EMAIL=admin@example.com \
  ADMIN_PASSWORD=correct-horse-battery-staple \
  bun run start
```

Expected: server logs `[bootstrap] Created admin user admin@example.com ...`. Open `http://localhost:3000` and confirm `/api/auth/me` returns `signed-out` (not `needs-setup`). Sign in with those credentials.

- [ ] **Step 6: Clean up**

```bash
rm -f data/app.db
```

(No commit — this is a manual verification step.)

---

## Task 19: Docs + env + Docker

**Files:**
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rewrite `.env.example`**

Replace the body of `.env.example`:

```bash
# ─── Storage ───────────────────────────────────────────────────────────────
# Self-host default: a local SQLite file. `file:` prefix is optional.
DATABASE_URL=file:./data/app.db

# ─── Sessions ──────────────────────────────────────────────────────────────
# 32+ chars. Generate with: `openssl rand -base64 48`.
# Used to seal session cookies. REQUIRED — the server refuses to start without it.
SESSION_SECRET=

# ─── First-run admin (optional, for headless/Docker deploys) ───────────────
# If both are set and the database has no users, the server creates this
# admin at startup. After that, the in-app setup form is no longer needed.
# Leave both unset for the interactive setup flow.
# ADMIN_EMAIL=
# ADMIN_PASSWORD=                   # min 12 characters
# ADMIN_DISPLAY_NAME=               # defaults to email's local part

# ─── AI extraction (optional) ──────────────────────────────────────────────
# /api/extract pulls company / role / salary / etc. from a job-posting URL.
# Env wins over the in-app Settings page; leave everything below unset to
# configure it from the UI. See docs/AI_PROVIDERS.md.
#
# AI_PROVIDER: openai | anthropic | google | minimax | openrouter | openai-compatible
# AI_PROVIDER=openai
# AI_MODEL=                 # blank = provider default (e.g. gpt-4o-mini)
# AI_BASE_URL=              # required only for openai-compatible (Ollama/LM Studio/vLLM)
#
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
# GOOGLE_GENERATIVE_AI_API_KEY=
# OPENROUTER_API_KEY=
# AI_API_KEY=               # openai-compatible (often unused for local models)
#
# Back-compat: setting just MINIMAX_API_KEY (no AI_PROVIDER) still works.
# MINIMAX_API_KEY=

# ─── Server ────────────────────────────────────────────────────────────────
PORT=3000
# NODE_ENV=production
# DEBUG_EXTRACT=true        # verbose /api/extract logs
```

- [ ] **Step 2: Rewrite the auth block of `docker-compose.yml`**

In `docker-compose.yml`, replace the entire `# ── Auth ──` block (the `AUTH_MODE` through `PUBLIC_BASE_URL` lines) with:

```yaml
      # ── Session + first-run admin ─────────────────────────────────────
      # Required. Generate with: `openssl rand -base64 48`
      SESSION_SECRET: ${SESSION_SECRET:-}
      # Optional headless bootstrap. If both set and DB is empty,
      # creates this admin on first start. Otherwise, complete setup in the UI.
      ADMIN_EMAIL: ${ADMIN_EMAIL:-}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-}
      ADMIN_DISPLAY_NAME: ${ADMIN_DISPLAY_NAME:-}
```

- [ ] **Step 3: Update `README.md`**

In `README.md`, find the auth/Google OAuth section. Replace it with:

```markdown
## First run

1. Start the app:

   ```bash
   docker compose up -d
   # or, without Docker:
   bun install && SESSION_SECRET=$(openssl rand -base64 48) bun run start
   ```

2. Open `http://localhost:3000`. You'll see a one-time setup form — pick a
   display name, email, and a password (12+ characters). That account
   becomes the admin.

3. Optionally configure an AI provider in step 2 of the setup, or skip and
   set it up later under **Settings**.

### Headless / declarative bootstrap

If you'd rather not visit a browser to set up, pass both env vars at
first start and the admin will be created automatically:

```bash
docker run \
  -p 3000:3000 \
  -v ./data:/app/data \
  -e SESSION_SECRET=$(openssl rand -base64 48) \
  -e ADMIN_EMAIL=you@example.com \
  -e ADMIN_PASSWORD='a-long-passphrase-or-random-string' \
  ghcr.io/mclovin0213/jobvault:latest
```

These env vars are only read when the database is empty — they don't
override an existing user, and they're safe to leave in your compose file
after setup.

### Lost the admin password?

There's no email-based reset (Jobvault is self-hosted and doesn't ship an
SMTP integration). Recover by clearing the users table and re-running setup:

```bash
docker compose exec app sqlite3 /app/data/app.db 'DELETE FROM users;'
docker compose restart app
```

Your applications and pending URLs are untouched.
```

If the README has a `## Auth` or `### OAuth` section elsewhere, delete it.

- [ ] **Step 4: Update `CLAUDE.md`**

In `CLAUDE.md`, find the `### Auth (\`server/lib/\`)` section and replace it with:

```markdown
### Auth (`server/lib/`)

Local email/password auth backed by SQLite. `requireUser(c)` reads the
sealed session cookie, looks up the user id, and returns the row or 401.
There is no OAuth, no allowlist, no `AUTH_MODE` env var.

The first user is created via `POST /api/auth/setup`, which is gated on
`countUsers() === 0` and returns 410 once any user exists. For Docker/CI,
`ADMIN_EMAIL` + `ADMIN_PASSWORD` env vars seed the admin at startup when
the DB is empty (`server/lib/bootstrap.ts`).

Passwords are hashed with `node:crypto` scrypt (`server/lib/password.ts`).
Sessions remain iron-session sealed cookies (`server/lib/session.ts`);
payload is just `{ userId }`.

`GET /api/auth/me` returns one of `{ status: 'needs-setup' }`,
`{ status: 'signed-out' }`, `{ status: 'signed-in', user }`. The SPA's
`useAuth` hook branches off that.
```

If `CLAUDE.md` still references the allowlist policy elsewhere ("env wins / DB fallback" for allowlist), delete that reference — only AI config retains that pattern now.

- [ ] **Step 5: Run the full verification suite**

Run: `bun run lint && bun run test && bun run build`
Expected: all three pass.

- [ ] **Step 6: Commit**

```bash
git add .env.example docker-compose.yml README.md CLAUDE.md
git commit -m "docs: update README, env, compose, and CLAUDE.md for local auth"
```

---

## Final verification

- [ ] **Run the full suite once more from a clean tree:**

```bash
bun run lint && bun run test && bun run build
```

Expected: all pass.

- [ ] **Confirm no stale references remain:**

```bash
grep -rn "AUTH_MODE\|ALLOW_NO_AUTH\|ALLOWLIST\|listAllowedEmails\|StoredUser\|oauthGoogle\|@/auth/" \
  --include='*.ts' --include='*.tsx' --include='*.md' .
```

Expected: only matches inside `docs/superpowers/` (the spec + this plan, which document the change) and possibly a CHANGELOG. Code matches should be zero.

- [ ] **Manual smoke test one more time** (Task 18 sequence, condensed): wipe DB, start server, complete setup, sign out, sign back in. Wipe DB, set env vars, start server, confirm bootstrap log line, sign in.
