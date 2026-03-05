/** Escape HTML entities to prevent XSS */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Strip non-alphanumeric chars from attribute values */
export function escapeAttr(str: string): string {
  return str.replace(/[^a-zA-Z0-9-_]/g, '')
}

/** Strip any HTML tags that aren't in the safe allowlist */
export function sanitizeHtml(html: string): string {
  const allowedTags = /^<\/?(pre|code|strong|em|h[2-4]|li|br)\b[^>]*>$/i
  return html.replace(/<\/?[a-z][^>]*>/gi, (tag) =>
    allowedTags.test(tag) ? tag : escapeHtml(tag))
}

/** Convert simple Markdown to sanitized HTML */
export function renderMarkdown(text: string): string {
  return sanitizeHtml(text
    // Code blocks with language
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, lang, code) =>
      `<pre class="ai-code-block"><code class="language-${escapeAttr(lang || '')}">${escapeHtml(code.trim())}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, (_m, code) => `<code class="ai-inline-code">${escapeHtml(code)}</code>`)
    // Bold
    .replace(/\*\*(.+?)\*\*/g, (_m, t) => `<strong>${escapeHtml(t)}</strong>`)
    // Italic
    .replace(/\*(.+?)\*/g, (_m, t) => `<em>${escapeHtml(t)}</em>`)
    // Headers
    .replace(/^### (.+)$/gm, (_m, t) => `<h4 class="text-xs font-semibold mt-2 mb-1">${escapeHtml(t)}</h4>`)
    .replace(/^## (.+)$/gm, (_m, t) => `<h3 class="text-sm font-semibold mt-3 mb-1">${escapeHtml(t)}</h3>`)
    .replace(/^# (.+)$/gm, (_m, t) => `<h2 class="text-sm font-bold mt-3 mb-1">${escapeHtml(t)}</h2>`)
    // Lists
    .replace(/^- (.+)$/gm, (_m, t) => `<li class="ml-3">${escapeHtml(t)}</li>`)
    .replace(/^\d+\. (.+)$/gm, (_m, t) => `<li class="ml-3">${escapeHtml(t)}</li>`)
    // Line breaks
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>'))
}
