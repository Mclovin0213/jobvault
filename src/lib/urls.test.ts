import { describe, expect, it } from 'vitest'
import { hostnameOf, parseUrlsFromPaste } from './urls'

describe('parseUrlsFromPaste', () => {
  it('parses newline-separated urls', () => {
    const out = parseUrlsFromPaste('https://example.com/a\nhttps://example.com/b')
    expect(out.valid).toEqual(['https://example.com/a', 'https://example.com/b'])
    expect(out.invalid).toEqual([])
  })

  it('parses comma-separated urls', () => {
    const out = parseUrlsFromPaste('https://a.com,https://b.com')
    expect(out.valid).toHaveLength(2)
  })

  it('adds https:// prefix when missing', () => {
    const out = parseUrlsFromPaste('example.com/job')
    expect(out.valid).toEqual(['https://example.com/job'])
  })

  it('rejects strings without a TLD', () => {
    const out = parseUrlsFromPaste('localhost\nnotaurl')
    expect(out.valid).toEqual([])
    expect(out.invalid).toEqual(['localhost', 'notaurl'])
  })

  it('deduplicates after normalization', () => {
    const out = parseUrlsFromPaste('https://example.com/a\nhttps://example.com/a')
    expect(out.valid).toEqual(['https://example.com/a'])
  })

  it('trims whitespace', () => {
    const out = parseUrlsFromPaste('   https://example.com   ')
    expect(out.valid).toEqual(['https://example.com/'])
  })
})

describe('hostnameOf', () => {
  it('strips www.', () => {
    expect(hostnameOf('https://www.example.com/job')).toBe('example.com')
  })
  it('returns hostname for valid url', () => {
    expect(hostnameOf('https://jobs.lever.co/x')).toBe('jobs.lever.co')
  })
  it('returns input on parse failure', () => {
    expect(hostnameOf('not a url')).toBe('not a url')
  })
})
