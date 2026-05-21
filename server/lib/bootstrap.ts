import { countUsers, createUser, findUserByUsername } from './users.ts'

const MIN_PASSWORD_LEN = 12
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/

export async function maybeBootstrapAdmin(): Promise<void> {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD

  if (!username && !password) return

  if (!username || !password) {
    throw new Error(
      'ADMIN_USERNAME and ADMIN_PASSWORD must be set together (or both left unset).',
    )
  }

  if (!USERNAME_RE.test(username)) {
    throw new Error(
      'ADMIN_USERNAME must be 3-32 characters: letters, numbers, and . _ - only.',
    )
  }

  if (password.length < MIN_PASSWORD_LEN) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LEN} characters.`)
  }

  if ((await countUsers()) > 0) return

  if (await findUserByUsername(username)) return

  await createUser({ username, password })
  console.log(
    `[bootstrap] Created admin user ${username} from ADMIN_USERNAME/ADMIN_PASSWORD env vars.`,
  )
}
