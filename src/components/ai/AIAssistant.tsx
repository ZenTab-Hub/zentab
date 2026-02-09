import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { Bot, X, Send, Trash2, Sparkles, Copy, Check } from 'lucide-react'
import { useConnectionStore } from '@/store/connectionStore'
import { useAISettingsStore } from '@/store/aiSettingsStore'
import { aiService, type ChatMessage } from '@/services/ai.service'

interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const SYSTEM_PROMPT = `You are Zentab Assistant — an expert database assistant embedded in a database GUI tool called Zentab.
You help users with:
1. Writing and optimizing database queries (MongoDB, PostgreSQL, SQL)
2. Explaining database concepts, indexing strategies, schema design
3. Debugging query errors and performance issues
4. Writing documentation based on database schemas
5. Data modeling advice and best practices
6. Converting queries between different database dialects

Rules:
- Be concise but thorough. Use code blocks with language tags for queries.
- When writing queries, always specify the dialect (MongoDB shell, PostgreSQL SQL, etc.)
- If the user provides context about their current database/collection, use it.
- Format responses in Markdown for readability.
- If you don't know something, say so honestly.`

function buildContextPrompt(dbType?: string, database?: string, collection?: string): string {
  const parts: string[] = []
  if (dbType) parts.push(`Database type: ${dbType}`)
  if (database) parts.push(`Current database: ${database}`)
  if (collection) parts.push(`Current table/collection: ${collection}`)
  if (parts.length === 0) return ''
  return `\n\nUser's current context:\n${parts.join('\n')}`
}

/* ─── Simple Markdown renderer ─── */
const renderMarkdown = (text: string): string => {
  return text
    // Code blocks with language
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, lang, code) =>
      `<pre class="ai-code-block"><code class="language-${lang || ''}">${escapeHtml(code.trim())}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<h4 class="text-xs font-semibold mt-2 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-sm font-semibold mt-2 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-sm font-bold mt-2 mb-1">$1</h2>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="ml-3">• $1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-3">$1</li>')
    // Line breaks (double newline = paragraph)
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/* ─── Copy button for code blocks ─── */
const CopyButton = memo(({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className="ai-copy-btn" title="Copy">
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  )
})
CopyButton.displayName = 'CopyButton'

/* ─── Message bubble ─── */
const MessageBubble = memo(({ msg }: { msg: UIMessage }) => {
  const isUser = msg.role === 'user'
  const html = isUser ? escapeHtml(msg.content).replace(/\n/g, '<br/>') : renderMarkdown(msg.content)

  // Extract code blocks for copy buttons
  const codeBlocks: string[] = []
  if (!isUser) {
    const regex = /```(?:\w+)?\n([\s\S]*?)```/g
    let match
    while ((match = regex.exec(msg.content)) !== null) {
      codeBlocks.push(match[1].trim())
    }
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={isUser ? 'ai-msg-user' : 'ai-msg-assistant'}>
        {!isUser && (
          <div className="flex items-center gap-1 mb-1">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-medium text-primary">AI</span>
          </div>
        )}
        <div
          className="text-[12px] leading-relaxed ai-msg-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {codeBlocks.length > 0 && (
          <div className="flex gap-1 mt-1">
            {codeBlocks.map((code, i) => (
              <CopyButton key={i} text={code} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
MessageBubble.displayName = 'MessageBubble'

/* ─── Main AIAssistant component ─── */
export const AIAssistant = () => {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { activeConnectionId, selectedDatabase, selectedCollection, getActiveConnection } = useConnectionStore()
  const activeConnection = getActiveConnection()
  const getSelectedModel = useAISettingsStore((s) => s.getSelectedModel)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingId])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const model = getSelectedModel()
    if (!model) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: '⚠️ No AI model configured. Please go to **Settings → AI Models** to add one.',
        timestamp: Date.now(),
      }])
      return
    }
    const userMsg: UIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Build conversation for API
    const contextSuffix = buildContextPrompt(
      activeConnection?.type,
      selectedDatabase || undefined,
      selectedCollection || undefined
    )
    const systemContent = SYSTEM_PROMPT + contextSuffix

    const apiMessages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: text },
    ]

    const assistantId = (Date.now() + 1).toString()
    setStreamingId(assistantId)
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() }])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const fullText = await aiService.chatStream(
        apiMessages,
        model,
        (chunk) => {
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m)
          )
        },
        controller.signal
      )

      // For Gemini (non-streaming), set the full text at once
      if (fullText && messages.find(m => m.id === assistantId)?.content === '') {
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m)
        )
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m => m.id === assistantId
            ? { ...m, content: `❌ Error: ${err.message}` }
            : m
          )
        )
      }
    } finally {
      setLoading(false)
      setStreamingId(null)
      abortRef.current = null
    }
  }, [input, loading, getSelectedModel, activeConnection, selectedDatabase, selectedCollection, messages])

  const handleClear = () => {
    if (loading && abortRef.current) abortRef.current.abort()
    setMessages([])
    setLoading(false)
    setStreamingId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="ai-fab"
          title="AI Assistant"
        >
          <Bot className="h-5 w-5" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="ai-panel">
          {/* Header */}
          <div className="ai-panel-header">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold">AI Assistant</span>
              {activeConnection && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {activeConnection.type?.toUpperCase() || 'DB'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleClear} className="ai-header-btn" title="Clear chat">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setOpen(false)} className="ai-header-btn" title="Close">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="ai-messages">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <Sparkles className="h-8 w-8 text-primary/30 mb-3" />
                <p className="text-xs font-medium text-muted-foreground mb-1">How can I help?</p>
                <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                  Ask me about queries, schema design,<br/>
                  optimization, or database concepts.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
                  {[
                    'Write a query to find...',
                    'Explain indexing strategies',
                    'Help me design a schema',
                    'Optimize this query',
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => { setInput(suggestion); inputRef.current?.focus() }}
                      className="text-[10px] px-2 py-1 rounded-full border border-border/50 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {loading && streamingId && messages.find(m => m.id === streamingId)?.content === '' && (
              <div className="flex justify-start mb-2">
                <div className="ai-msg-assistant">
                  <div className="flex items-center gap-2">
                    <div className="ai-typing-dot" />
                    <div className="ai-typing-dot" style={{ animationDelay: '0.2s' }} />
                    <div className="ai-typing-dot" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="ai-input-area">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about databases, queries..."
              className="ai-input"
              rows={1}
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="ai-send-btn"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

