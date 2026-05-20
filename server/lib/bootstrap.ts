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

  if (await findUserByEmail(email)) return

  const displayName =
    displayNameEnv && displayNameEnv.length > 0 ? displayNameEnv : email.split('@')[0]
  await createUser({ email, password, displayName })
  console.log(
    `[bootstrap] Created admin user ${email} from ADMIN_EMAIL/ADMIN_PASSWORD env vars.`,
  )
}
