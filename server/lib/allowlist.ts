import { getAdapter } from './db.ts'

function envList(): string[] | null {
  const raw = process.env.ALLOWLIST
  if (raw === undefined) return null
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}

export async function isAllowed(email: string): Promise<boolean> {
  const target = email.trim().toLowerCase()
  if (!target) return false
  const env = envList()
  if (env !== null) {
    return env.length === 0 || env.includes(target)
  }
  const adapter = await getAdapter()
  const list = (await adapter.listAllowedEmails()).map(e => e.toLowerCase())
  return list.length === 0 || list.includes(target)
}
