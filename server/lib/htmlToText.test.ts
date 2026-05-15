import { describe, expect, it } from 'vitest'
import { htmlToText } from './htmlToText'

describe('htmlToText', () => {
  it('extracts the title', () => {
    const html = '<html><head><title>Engineer at Acme</title></head><body>Body</body></html>'
    expect(htmlToText(html)).toContain('TITLE:')
    expect(htmlToText(html)).toContain('Engineer at Acme')
  })

  it('preserves JSON-LD content even though scripts are stripped from the body', () => {
    const ld = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: 'Senior Engineer',
      hiringOrganization: { name: 'Acme Corp' },
    })
    const html = `<html><head><title>x</title><script type="application/ld+json">${ld}</script></head><body>x</body></html>`
    const out = htmlToText(html)
    expect(out).toContain('JSONLD:')
    expect(out).toContain('JobPosting')
    expect(out).toContain('Senior Engineer')
    expect(out).toContain('Acme Corp')
  })

  it('keeps og: and twitter: meta tags', () => {
    const html = `
      <html><head>
        <title>x</title>
        <meta property="og:title" content="Awesome Job" />
        <meta name="twitter:description" content="Build cool things" />
        <meta name="description" content="Plain description" />
        <meta name="keywords" content="ignored" />
      </head><body>body</body></html>`
    const out = htmlToText(html)
    expect(out).toContain('og:title: Awesome Job')
    expect(out).toContain('twitter:description: Build cool things')
    expect(out).toContain('description: Plain description')
    expect(out).not.toContain('ignored')
  })

  it('strips body scripts from the output', () => {
    const html =
      '<html><head><title>x</title></head><body><script>alert("hi")</script>visible text</body></html>'
    const out = htmlToText(html)
    expect(out).not.toContain('alert')
    expect(out).toContain('visible text')
  })

  it('decodes basic html entities', () => {
    const html = '<html><body>R&amp;D &nbsp; &quot;cool&quot;</body></html>'
    expect(htmlToText(html)).toContain('R&D "cool"')
  })

  it('truncates very long output', () => {
    const huge = 'x'.repeat(20_000)
    const html = `<html><body>${huge}</body></html>`
    expect(htmlToText(html).length).toBeLessThanOrEqual(15_000)
  })
})
