export function parseUrlsFromPaste(text: string): { valid: string[]; invalid: string[] } {
  const lines = text
    .split(/\r?\n|,|\s{2,}/)
    .map(s => s.trim())
    .filter(Boolean)
  const valid: string[] = []
  const invalid: string[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    const candidate = /^https?:\/\//i.test(line) ? line : `https://${line}`
    try {
      const u = new URL(candidate)
      if (!u.hostname.includes('.')) throw new Error('no tld')
      const normalized = u.toString()
      if (seen.has(normalized)) continue
      seen.add(normalized)
      valid.push(normalized)
    } catch {
      invalid.push(line)
    }
  }
  return { valid, invalid }
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
