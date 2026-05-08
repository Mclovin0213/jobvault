const MAX_TEXT_CHARS = 15_000

export function htmlToText(html: string): string {
  const headMatch = /<head\b[^>]*>[\s\S]*?<\/head>/i.exec(html)
  let headSummary = ''
  if (headMatch) {
    const m = headMatch[0]
    const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(m)
    const ogs = Array.from(
      m.matchAll(/<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']+)["']/gi),
    )
      .filter(([, k]) => /og:|twitter:|description/i.test(k))
      .map(([, k, v]) => `${k}: ${v}`)
      .join('\n')
    const ld = Array.from(
      m.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi),
    )
      .map(([, body]) => body.trim())
      .join('\n')
    headSummary = ['TITLE:', titleMatch?.[1]?.trim() ?? '', ogs, 'JSONLD:', ld].join('\n')
  }
  const body = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return [headSummary, body].filter(Boolean).join('\n').trim().slice(0, MAX_TEXT_CHARS)
}
