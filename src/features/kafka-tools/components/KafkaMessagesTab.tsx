import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Radio, RefreshCw, ChevronDown, ChevronRight, X, Send, Copy, FileJson,
  Table, Search, MessageSquare,
} from 'lucide-react'
import { databaseService } from '@/services/database.service'

export const KafkaMessagesTab = ({ connectionId, tt, initialTopic }: { connectionId: string; tt: any; initialTopic?: string }) => {
  const [topics, setTopics] = useState<string[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic || '')
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [limit, setLimit] = useState(50)
  const [fromBeginning, setFromBeginning] = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  // Produce
  const [showProduce, setShowProduce] = useState(false)
  const [produceKey, setProduceKey] = useState('')
  const [produceValue, setProduceValue] = useState('')
  const [produceHeaders, setProduceHeaders] = useState('')
  const [producing, setProducing] = useState(false)
  // Filter
  const [filterKey, setFilterKey] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [showFilter, setShowFilter] = useState(false)

  const loadTopics = useCallback(async () => {
    try {
      const result = await databaseService.listDatabases(connectionId, 'kafka')
      if (result.success) {
        const list = (result.databases || []).map((t: any) => typeof t === 'string' ? t : t.name).sort()
        setTopics(list)
        if (list.length > 0 && !selectedTopic) {
          setSelectedTopic(initialTopic && list.includes(initialTopic) ? initialTopic : list[0])
        }
      }
    } catch (err: any) { tt.error(err.message) }
  }, [connectionId])

  useEffect(() => { loadTopics() }, [loadTopics])

  const consumeMessages = useCallback(async () => {
    if (!selectedTopic) return
    setLoading(true)
    try {
      const result = await databaseService.kafkaConsumeMessages(connectionId, selectedTopic, limit, fromBeginning)
      if (result.success) setMessages(result.documents || [])
    } catch (err: any) { tt.error('Failed to consume: ' + err.message) }
    finally { setLoading(false) }
  }, [connectionId, selectedTopic, limit, fromBeginning])

  useEffect(() => { if (selectedTopic) consumeMessages() }, [selectedTopic])

  const handleProduce = async () => {
    if (!selectedTopic) { tt.warning('Select a topic first'); return }
    if (!produceValue.trim()) { tt.warning('Message value is required'); return }
    setProducing(true)
    try {
      let headers: Record<string, string> | undefined
      if (produceHeaders.trim()) {
        try { headers = JSON.parse(produceHeaders) } catch { tt.warning('Headers must be valid JSON'); setProducing(false); return }
      }
      const msgs = [{ key: produceKey || undefined, value: produceValue, headers }]
      await databaseService.kafkaProduceMessage(connectionId, selectedTopic, msgs)
      tt.success('Message produced')
      setProduceKey(''); setProduceValue(''); setProduceHeaders('')
      consumeMessages()
    } catch (err: any) { tt.error(err.message) }
    finally { setProducing(false) }
  }

  const filteredMessages = useMemo(() => {
    if (!filterKey && !filterValue) return messages
    return messages.filter((msg) => {
      const keyMatch = !filterKey || (msg.key || '').toLowerCase().includes(filterKey.toLowerCase())
      const valMatch = !filterValue || (msg.value || '').toLowerCase().includes(filterValue.toLowerCase())
      return keyMatch && valMatch
    })
  }, [messages, filterKey, filterValue])

  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const copyMessages = () => {
    navigator.clipboard.writeText(JSON.stringify(filteredMessages, null, 2))
    tt.success('Copied to clipboard')
  }

  const formatTs = (ts: string) => {
    if (!ts) return '—'
    try { return new Date(Number(ts)).toLocaleString() } catch { return ts }
  }

  const tryParseJSON = (val: string) => {
    try { return JSON.stringify(JSON.parse(val), null, 2) } catch { return val }
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Messages</h3>
        <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)}
          className="px-2 py-1.5 text-[11px] rounded-md border bg-background font-mono min-w-[200px]">
          <option value="">— Select Topic —</option>
          {topics.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={() => setShowProduce(!showProduce)} className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border transition-colors ${showProduce ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
          <Send className="h-3.5 w-3.5" /> Produce
        </button>
        <button onClick={copyMessages} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent">
          <Copy className="h-3.5 w-3.5" /> Copy
        </button>
        <button onClick={consumeMessages} disabled={loading || !selectedTopic} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Consume
        </button>
      </div>

      {/* Produce Panel */}
      {showProduce && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <span className="text-[11px] font-semibold">Produce Message to <span className="font-mono text-primary">{selectedTopic || '...'}</span></span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">Key (optional)</label>
              <input value={produceKey} onChange={e => setProduceKey(e.target.value)} placeholder="message-key"
                className="w-full px-2 py-1.5 text-[11px] font-mono rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">Headers (optional JSON)</label>
              <input value={produceHeaders} onChange={e => setProduceHeaders(e.target.value)} placeholder='{"key": "value"}'
                className="w-full px-2 py-1.5 text-[11px] font-mono rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">Value</label>
            <textarea value={produceValue} onChange={e => setProduceValue(e.target.value)} placeholder='{"event": "user_signup", "userId": 123}'
              className="w-full h-20 p-2 text-[11px] font-mono rounded border bg-background resize-y focus:outline-none focus:ring-1 focus:ring-primary" spellCheck={false} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleProduce} disabled={producing || !selectedTopic} className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {producing ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      )}

      {/* Consume Controls */}
      <div className="flex gap-2 items-center">
        <label className="text-[10px] text-muted-foreground">Limit:</label>
        <input type="number" value={limit} onChange={e => setLimit(Number(e.target.value) || 50)}
          className="w-20 px-2 py-1 text-[11px] rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={fromBeginning} onChange={e => setFromBeginning(e.target.checked)} className="rounded border-border" />
          From beginning
        </label>
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground">
          {filterKey || filterValue ? `${filteredMessages.length} / ` : ''}{messages.length} messages
        </span>
        <button onClick={() => setShowFilter(!showFilter)} className={`p-1.5 rounded transition-colors ${showFilter ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}`} title="Filter">
          <Search className="h-3.5 w-3.5" />
        </button>
        <span className="text-muted-foreground/30">|</span>
        <button onClick={() => setViewMode('table')} className={`p-1.5 rounded transition-colors ${viewMode === 'table' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}`} title="Table View">
          <Table className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setViewMode('json')} className={`p-1.5 rounded transition-colors ${viewMode === 'json' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}`} title="JSON View">
          <FileJson className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Filter */}
      {showFilter && (
        <div className="flex gap-2 items-center rounded-md border bg-card/50 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input value={filterKey} onChange={e => setFilterKey(e.target.value)} placeholder="Filter by key..."
            className="flex-1 px-2 py-1 text-[11px] rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
          <input value={filterValue} onChange={e => setFilterValue(e.target.value)} placeholder="Filter by value..."
            className="flex-1 px-2 py-1 text-[11px] rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
          {(filterKey || filterValue) && (
            <button onClick={() => { setFilterKey(''); setFilterValue('') }} className="p-1 rounded hover:bg-accent text-muted-foreground" title="Clear">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Messages Content */}
      <div className="flex-1 overflow-auto rounded-md border bg-card">
        {!selectedTopic ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Radio className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Select a topic to view messages</p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-muted-foreground">Consuming messages...</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{messages.length === 0 ? 'No messages in this topic' : 'No messages match the filter'}</p>
              {messages.length === 0 && <p className="text-[10px] text-muted-foreground mt-1">Click "Consume" to fetch or "Produce" to send</p>}
            </div>
          </div>
        ) : viewMode === 'json' ? (
          <pre className="overflow-auto p-3 text-[11px] font-mono">{JSON.stringify(filteredMessages, null, 2)}</pre>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase w-8"></th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase w-12">Part</th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase w-16">Offset</th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase w-32">Key</th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">Value</th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase w-40">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredMessages.map((msg, i) => {
                  const rowKey = `${msg.partition}-${msg.offset}`
                  const isExp = expandedRows.has(rowKey)
                  return (
                    <tr key={rowKey} className={`hover:bg-muted/30 text-[11px] ${isExp ? 'bg-muted/10' : ''}`}>
                      <td className="px-2 py-1.5">
                        <button onClick={() => toggleRow(rowKey)} className="text-muted-foreground hover:text-primary">
                          {isExp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </button>
                      </td>
                      <td className="px-2 py-1.5 font-mono text-amber-400">{msg.partition}</td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{msg.offset}</td>
                      <td className="px-2 py-1.5 font-mono truncate max-w-[200px]" title={msg.key || ''}>{msg.key || <span className="text-muted-foreground/50">null</span>}</td>
                      <td className="px-2 py-1.5 font-mono truncate max-w-[400px]" title={msg.value || ''}>
                        {isExp ? (
                          <pre className="whitespace-pre-wrap break-all text-[11px]">{tryParseJSON(msg.value)}</pre>
                        ) : (
                          msg.value || <span className="text-muted-foreground/50">null</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{formatTs(msg.timestamp)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

