import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateText } from 'ai'
import { minimax } from 'vercel-minimax-ai-provider'

const MAX_HTML_BYTES = 1_000_000
const FETCH_TIMEOUT_MS = 12_000
const MAX_TEXT_CHARS = 15_000

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/123.0 Safari/537.36'

type ExtractedFields = {
  company: string
  role: string
  salary: string
  location: string
  workArrangement: 'remote' | 'hybrid' | 'onsite' | ''
  source: string
}

const EMPTY: ExtractedFields = {
  company: '',
  role: '',
  salary: '',
  location: '',
  workArrangement: '',
  source: '',
}

function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, m => {
      const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(m)
      const ogs = Array.from(m.matchAll(/<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']+)["']/gi))
        .filter(([, k]) => /og:|twitter:|description/i.test(k))
        .map(([, k, v]) => `${k}: ${v}`)
        .join('\n')
      const ld = Array.from(m.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi))
        .map(([, body]) => body)
        .join('\n')
      return ['TITLE:', titleMatch?.[1] ?? '', ogs, 'JSONLD:', ld].join('\n')
    })
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchPage(url: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!res.ok) return { ok: false, error: `fetch_${res.status}` }
    const buf = await res.arrayBuffer()
    if (buf.byteLength === 0) return { ok: false, error: 'empty_response' }
    const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf
    const html = new TextDecoder('utf-8', { fatal: false }).decode(slice)
    const text = htmlToText(html).slice(0, MAX_TEXT_CHARS)
    if (text.length < 80) return { ok: false, error: 'page_blocked_or_empty' }
    return { ok: true, text }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'fetch_failed' }
  } finally {
    clearTimeout(timer)
  }
}

const SYSTEM_PROMPT =
  'You extract structured fields from a job-posting web page. ' +
  'You MUST respond with ONLY a raw JSON object — no markdown, no code fences, no commentary, nothing else. ' +
  'The JSON must have exactly these string keys: company, role, salary, location, workArrangement, source. ' +
  'Rules: ' +
  '- workArrangement MUST be one of: "remote", "hybrid", "onsite", or "" (empty if unclear). ' +
  '- source is the platform/board (e.g. "LinkedIn", "Greenhouse", "Lever", "company site", "Indeed"). Infer from URL/branding. ' +
  '- salary: keep original currency/range as written; "" if not stated. ' +
  '- Use "" (empty string) for any unknown field. Do NOT guess. ' +
  'Example output: {"company":"Acme Corp","role":"Software Engineer","salary":"$120k-$150k","location":"New York, NY","workArrangement":"hybrid","source":"Greenhouse"}'

async function callMinimax(url: string, text: string): Promise<{ ok: true; extracted: ExtractedFields } | { ok: false; error: string }> {
  if (!process.env.MINIMAX_API_KEY) return { ok: false, error: 'missing_MINIMAX_API_KEY' }
  const modelId = process.env.MINIMAX_MODEL || 'MiniMax-M2.5'

  let result: Awaited<ReturnType<typeof generateText>>
  try {
    result = await generateText({
      model: minimax(modelId),
      system: SYSTEM_PROMPT,
      prompt: `URL: ${url}\n\nPAGE CONTENT:\n${text}\n\nReturn the JSON object now.`,
      temperature: 0.1,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'llm_call_failed'
    return { ok: false, error: `llm_error: ${msg.slice(0, 300)}` }
  }

  const answer = result.text.trim()
  console.log('[extract] LLM text:', answer)
  if (result.reasoning) console.log('[extract] LLM reasoning length:', result.reasoning.length)

  let parsed: Partial<ExtractedFields>
  try {
    // Some models still wrap in fences even when asked not to — strip them.
    const stripped = answer
      .replace(/```(?:json)?\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()
    const jsonMatch = stripped.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('no JSON object found')
    parsed = JSON.parse(jsonMatch[0])
  } catch (e) {
    console.error('[extract] parse failed. text was:', answer, 'error:', e)
    return { ok: false, error: `llm_unparseable_json: ${answer.slice(0, 300)}` }
  }

  const wa = (parsed.workArrangement ?? '').toString().toLowerCase()
  const validWa: ExtractedFields['workArrangement'] =
    wa === 'remote' || wa === 'hybrid' || wa === 'onsite' ? wa : ''

  return {
    ok: true,
    extracted: {
      ...EMPTY,
      company: String(parsed.company ?? '').trim(),
      role: String(parsed.role ?? '').trim(),
      salary: String(parsed.salary ?? '').trim(),
      location: String(parsed.location ?? '').trim(),
      workArrangement: validWa,
      source: String(parsed.source ?? '').trim(),
    },
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }
  const url = (req.body as { url?: unknown })?.url
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: 'invalid_url' })
    return
  }

  console.log('[extract] fetching:', url)
  const page = await fetchPage(url)
  if (!page.ok) {
    console.error('[extract] fetch failed:', page.error)
    res.status(200).json({ error: page.error })
    return
  }
  console.log('[extract] page text length:', page.text.length)

  const llm = await callMinimax(url, page.text)
  if (!llm.ok) {
    console.error('[extract] LLM failed:', llm.error)
    res.status(200).json({ error: llm.error })
    return
  }

  res.status(200).json({ extracted: llm.extracted })
}
