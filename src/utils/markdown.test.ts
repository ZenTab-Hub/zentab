import { describe, it, expect } from 'vitest'
import { escapeHtml, renderMarkdown } from './markdown'

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    )
  })

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('')
  })
})

describe('renderMarkdown', () => {
  it('renders bold text', () => {
    const result = renderMarkdown('**hello**')
    expect(result).toContain('<strong>')
    expect(result).toContain('hello')
  })

  it('renders italic text', () => {
    const result = renderMarkdown('*hello*')
    expect(result).toContain('<em>')
  })

  it('renders inline code', () => {
    const result = renderMarkdown('use `npm install`')
    expect(result).toContain('<code')
    expect(result).toContain('npm install')
  })

  it('renders code blocks', () => {
    const result = renderMarkdown('```js\nconsole.log("hi")\n```')
    expect(result).toContain('<pre')
    expect(result).toContain('<code')
    expect(result).toContain('console.log')
  })

  it('renders headers', () => {
    expect(renderMarkdown('# Title')).toContain('<h2')
    expect(renderMarkdown('## Subtitle')).toContain('<h3')
    expect(renderMarkdown('### Section')).toContain('<h4')
  })

  it('renders list items', () => {
    const result = renderMarkdown('- item one\n- item two')
    expect(result).toContain('<li')
    expect(result).toContain('item one')
  })

  it('converts line breaks', () => {
    const result = renderMarkdown('line1\n\nline2')
    expect(result).toContain('<br')
  })

  // XSS prevention tests
  it('strips dangerous HTML tags via DOMPurify', () => {
    const result = renderMarkdown('<script>alert("xss")</script>')
    expect(result).not.toContain('<script')
  })

  it('strips img onerror payloads', () => {
    const result = renderMarkdown('<img src=x onerror=alert(1)>')
    expect(result).not.toContain('onerror')
    expect(result).not.toContain('<img')
  })

  it('strips iframe tags', () => {
    const result = renderMarkdown('<iframe src="evil.com"></iframe>')
    expect(result).not.toContain('<iframe')
  })

  it('strips event handler attributes', () => {
    const result = renderMarkdown('<div onmouseover="alert(1)">hover me</div>')
    expect(result).not.toContain('onmouseover')
  })

  it('escapes HTML in code blocks to prevent injection', () => {
    const result = renderMarkdown('```\n<script>alert("xss")</script>\n```')
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;script&gt;')
  })

  it('escapes HTML in bold/italic text', () => {
    const result = renderMarkdown('**<img src=x onerror=alert(1)>**')
    // Content is HTML-escaped inside <strong>, so it renders as text not executable HTML
    expect(result).toContain('&lt;img')
    expect(result).not.toContain('<img ')
  })
})
