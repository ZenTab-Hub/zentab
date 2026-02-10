import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Radio, Users, Settings, RefreshCw, Layers, Trash2, RotateCcw,
  ChevronDown, ChevronRight, Save, X, Plus, Send, Copy, FileJson,
  Table, Search, MessageSquare,
} from 'lucide-react'
import { useConnectionStore } from '@/store/connectionStore'
import { databaseService } from '@/services/database.service'
import { useToast } from '@/components/common/Toast'

type Tab = 'topics' | 'messages' | 'consumer-groups' | 'topic-config'

export const KafkaToolsPage = () => {
  const { activeConnectionId, getActiveConnection } = useConnectionStore()
  const activeConnection = getActiveConnection()
  const dbType = activeConnection?.type
  const tt = useToast()
  const [searchParams] = useSearchParams()
  const urlTab = searchParams.get('tab')
  const urlTopic = searchParams.get('topic')

  const initialTab = (): Tab => {
    if (urlTab === 'config') return 'topic-config'
    if (urlTab === 'groups') return 'consumer-groups'
    if (urlTab === 'messages') return 'messages'
    return 'topics'
  }
  const [tab, setTab] = useState<Tab>(initialTab)

  if (!activeConnectionId || dbType !== 'kafka') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Connect to a Kafka cluster to use Kafka Tools</p>
        </div>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'topics', label: 'Topics', icon: Radio },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'consumer-groups', label: 'Consumer Groups', icon: Users },
    { id: 'topic-config', label: 'Topic Config', icon: Settings },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-card/50">
        <Radio className="h-4 w-4 text-amber-400" />
        <h2 className="text-sm font-semibold mr-4">Kafka Tools</h2>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${tab === t.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {tab === 'topics' && <TopicsTab connectionId={activeConnectionId} tt={tt} />}
        {tab === 'messages' && <MessagesTab connectionId={activeConnectionId} tt={tt} initialTopic={urlTopic || undefined} />}
        {tab === 'consumer-groups' && <ConsumerGroupsTab connectionId={activeConnectionId} tt={tt} />}
        {tab === 'topic-config' && <TopicConfigTab connectionId={activeConnectionId} tt={tt} initialTopic={urlTopic || undefined} />}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   Topics Management Tab
   ══════════════════════════════════════════════════════════════════ */
const TopicsTab = ({ connectionId, tt }: { connectionId: string; tt: any }) => {
  const [topics, setTopics] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPartitions, setNewPartitions] = useState(1)
  const [newReplication, setNewReplication] = useState(1)
  const [creating, setCreating] = useState(false)
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null)
  const [topicMeta, setTopicMeta] = useState<any>(null)
  const [metaLoading, setMetaLoading] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  const loadTopics = useCallback(async () => {
    setLoading(true)
    try {
      const result = await databaseService.listDatabases(connectionId, 'kafka')
      if (result.success) setTopics(result.databases || [])
    } catch (err: any) { tt.error(err.message) }
    finally { setLoading(false) }
  }, [connectionId])

  useEffect(() => { loadTopics() }, [loadTopics])

  const handleCreate = async () => {
    if (!newName.trim()) { tt.warning('Topic name is required'); return }
    setCreating(true)
    try {
      await databaseService.kafkaCreateTopic(connectionId, newName.trim(), newPartitions, newReplication)
      tt.success(`Topic "${newName.trim()}" created`)
      setNewName(''); setNewPartitions(1); setNewReplication(1); setShowCreate(false)
      loadTopics()
    } catch (err: any) { tt.error(err.message) }
    finally { setCreating(false) }
  }

  const handleDelete = async (topicName: string) => {
    if (!confirm(`Delete topic "${topicName}"? This cannot be undone.`)) return
    try {
      await databaseService.kafkaDeleteTopic(connectionId, topicName)
      tt.success(`Topic "${topicName}" deleted`)
      if (expandedTopic === topicName) setExpandedTopic(null)
      loadTopics()
    } catch (err: any) { tt.error(err.message) }
  }

  const toggleTopic = async (topicName: string) => {
    if (expandedTopic === topicName) { setExpandedTopic(null); return }
    setExpandedTopic(topicName)
    setMetaLoading(true)
    try {
      const result = await databaseService.getCollectionStats(connectionId, topicName, 'kafka')
      if (result.success) setTopicMeta(result)
    } catch (err: any) { tt.error(err.message) }
    finally { setMetaLoading(false) }
  }

  const filtered = useMemo(() => {
    if (!searchQ) return topics
    return topics.filter((t: any) => (t.name || t).toLowerCase().includes(searchQ.toLowerCase()))
  }, [topics, searchQ])

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Topics ({topics.length})</h3>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Filter topics..."
            className="pl-7 pr-2 py-1.5 text-[11px] rounded-md border bg-background w-48 focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent">
          <Plus className="h-3.5 w-3.5" /> Create Topic
        </button>
        <button onClick={loadTopics} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Create Topic Form */}
      {showCreate && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <span className="text-[11px] font-semibold">Create New Topic</span>
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground mb-0.5 block">Topic Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="my-topic"
                className="w-full px-2 py-1.5 text-[11px] font-mono rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">Partitions</label>
              <input type="number" min={1} value={newPartitions} onChange={e => setNewPartitions(Number(e.target.value) || 1)}
                className="w-full px-2 py-1.5 text-[11px] rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">Replication Factor</label>
              <input type="number" min={1} value={newReplication} onChange={e => setNewReplication(Number(e.target.value) || 1)}
                className="w-full px-2 py-1.5 text-[11px] rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={creating} className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent">Cancel</button>
          </div>
        </div>
      )}

      {/* Topics List */}
      {loading && topics.length === 0 && <div className="text-center py-10 text-sm text-muted-foreground">Loading topics...</div>}
      {!loading && topics.length === 0 && <div className="text-center py-10 text-sm text-muted-foreground">No topics found. Create one to get started.</div>}

      <div className="space-y-1">
        {filtered.map((t: any) => {
          const name = typeof t === 'string' ? t : t.name
          const partitions = t.partitions ?? '—'
          const isExpanded = expandedTopic === name
          return (
            <div key={name} className="rounded-lg border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/30" onClick={() => toggleTopic(name)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && toggleTopic(name)}>
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <Radio className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[12px] font-mono font-medium flex-1 truncate">{name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{partitions}p</span>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(name) }}
                  className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive" title="Delete topic">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              {/* Expanded: partition details */}
              {isExpanded && (
                <div className="border-t px-4 py-3 bg-muted/10">
                  {metaLoading ? (
                    <p className="text-[11px] text-muted-foreground">Loading partition details...</p>
                  ) : topicMeta?.metadata?.partitions ? (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Partitions ({topicMeta.metadata.partitions.length})</h4>
                      <div className="rounded border overflow-hidden">
                        <table className="w-full text-[11px]">
                          <thead><tr className="bg-muted/30 border-b">
                            <th className="text-left px-2 py-1 font-medium w-20">ID</th>
                            <th className="text-left px-2 py-1 font-medium">Leader</th>
                            <th className="text-left px-2 py-1 font-medium">Replicas</th>
                            <th className="text-left px-2 py-1 font-medium">ISR</th>
                          </tr></thead>
                          <tbody>
                            {topicMeta.metadata.partitions.map((p: any) => (
                              <tr key={p.partitionId} className="border-b last:border-0 hover:bg-muted/20">
                                <td className="px-2 py-1 font-mono text-amber-400">{p.partitionId}</td>
                                <td className="px-2 py-1 font-mono">{p.leader}</td>
                                <td className="px-2 py-1 font-mono text-muted-foreground">{(p.replicas || []).join(', ')}</td>
                                <td className="px-2 py-1 font-mono text-green-400">{(p.isr || []).join(', ')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Offsets */}
                      {topicMeta.offsets && (
                        <div>
                          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-2">Offsets</h4>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {topicMeta.offsets.map((o: any) => (
                              <div key={o.partition} className="text-[10px] px-2 py-1 rounded bg-muted font-mono">
                                P{o.partition}: <span className="text-muted-foreground">{o.low ?? '?'}</span> → <span className="text-primary">{o.high ?? o.offset ?? '?'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">No metadata available</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   Messages Tab (Producer & Consumer)
   ══════════════════════════════════════════════════════════════════ */
const MessagesTab = ({ connectionId, tt, initialTopic }: { connectionId: string; tt: any; initialTopic?: string }) => {
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

/* ── Consumer Groups Tab ── */
const ConsumerGroupsTab = ({ connectionId, tt }: { connectionId: string; tt: any }) => {
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [groupDetail, setGroupDetail] = useState<any>(null)
  const [groupOffsets, setGroupOffsets] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadGroups = useCallback(async () => {
    setLoading(true)
    try {
      const result = await databaseService.kafkaListConsumerGroups(connectionId)
      if (result.success) setGroups(result.groups || [])
    } catch (err: any) { tt.error('Failed to load groups: ' + err.message) }
    finally { setLoading(false) }
  }, [connectionId])

  useEffect(() => { loadGroups() }, [loadGroups])

  const toggleGroup = async (groupId: string) => {
    if (expandedGroup === groupId) { setExpandedGroup(null); return }
    setExpandedGroup(groupId)
    setDetailLoading(true)
    try {
      const [descResult, offsetResult] = await Promise.all([
        databaseService.kafkaDescribeConsumerGroup(connectionId, groupId),
        databaseService.kafkaGetConsumerGroupOffsets(connectionId, groupId),
      ])
      if (descResult.success) setGroupDetail(descResult.group)
      if (offsetResult.success) setGroupOffsets(offsetResult)
    } catch (err: any) { tt.error(err.message) }
    finally { setDetailLoading(false) }
  }

  const handleDelete = async (groupId: string) => {
    if (!confirm(`Delete consumer group "${groupId}"?`)) return
    try {
      await databaseService.kafkaDeleteConsumerGroup(connectionId, groupId)
      tt.success('Consumer group deleted')
      loadGroups()
      if (expandedGroup === groupId) setExpandedGroup(null)
    } catch (err: any) { tt.error(err.message) }
  }

  const handleResetOffsets = async (groupId: string, topic: string, earliest: boolean) => {
    try {
      await databaseService.kafkaResetConsumerGroupOffsets(connectionId, groupId, topic, earliest)
      tt.success(`Offsets reset to ${earliest ? 'earliest' : 'latest'} for ${topic}`)
      // Refresh offsets
      const offsetResult = await databaseService.kafkaGetConsumerGroupOffsets(connectionId, groupId)
      if (offsetResult.success) setGroupOffsets(offsetResult)
    } catch (err: any) { tt.error(err.message) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Consumer Groups ({groups.length})</h3>
        <button onClick={loadGroups} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      {/* placeholder - will be continued */}
      {groups.length === 0 && !loading && (
        <div className="text-center py-10 text-sm text-muted-foreground">No consumer groups found</div>
      )}
      {loading && groups.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground">Loading consumer groups...</div>
      )}
      <div className="space-y-1">
        {groups.map((g: any) => {
          const gid = g.groupId
          const isExpanded = expandedGroup === gid
          return (
            <div key={gid} className="rounded-lg border bg-card overflow-hidden">
              {/* Group header row */}
              <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/30" onClick={() => toggleGroup(gid)}>
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <Users className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[12px] font-mono font-medium flex-1 truncate">{gid}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{g.protocolType || 'consumer'}</span>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(gid) }}
                  className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive" title="Delete group">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              {/* Expanded detail */}
              {isExpanded && (
                <ConsumerGroupDetail
                  groupId={gid} detail={groupDetail} offsets={groupOffsets}
                  loading={detailLoading} onResetOffsets={handleResetOffsets}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Consumer Group Detail (expanded) ── */
const ConsumerGroupDetail = ({ groupId, detail, offsets, loading, onResetOffsets }: {
  groupId: string; detail: any; offsets: any; loading: boolean;
  onResetOffsets: (groupId: string, topic: string, earliest: boolean) => void
}) => {
  if (loading) return <div className="px-4 py-3 text-[11px] text-muted-foreground">Loading details...</div>
  if (!detail) return null

  const members = detail.members || []
  const offsetData = offsets?.offsets || []
  const lagInfo = offsets?.lagInfo || []

  // Calculate lag per topic-partition
  const getLag = (topic: string, partition: number, currentOffset: string) => {
    const topicLag = lagInfo.find((l: any) => l.topic === topic)
    if (!topicLag) return '—'
    const endOffset = topicLag.endOffsets?.find((o: any) => o.partition === partition)
    if (!endOffset) return '—'
    const lag = Number(endOffset.offset) - Number(currentOffset)
    return lag >= 0 ? lag.toLocaleString() : '—'
  }

  return (
    <div className="border-t px-4 py-3 space-y-3 bg-muted/10">
      {/* State */}
      <div className="flex items-center gap-3 text-[11px]">
        <span className="text-muted-foreground">State:</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${detail.state === 'Stable' ? 'bg-green-500/15 text-green-500' : detail.state === 'Empty' ? 'bg-yellow-500/15 text-yellow-500' : 'bg-muted text-muted-foreground'}`}>
          {detail.state}
        </span>
        <span className="text-muted-foreground">Protocol:</span>
        <span className="font-mono">{detail.protocol || '—'}</span>
        <span className="text-muted-foreground">Members:</span>
        <span className="font-mono">{members.length}</span>
      </div>

      {/* Members */}
      {members.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Members</h4>
          <div className="rounded border overflow-hidden">
            <table className="w-full text-[11px]">
              <thead><tr className="bg-muted/30 border-b">
                <th className="text-left px-2 py-1 font-medium">Member ID</th>
                <th className="text-left px-2 py-1 font-medium">Client ID</th>
                <th className="text-left px-2 py-1 font-medium">Host</th>
              </tr></thead>
              <tbody>
                {members.map((m: any, i: number) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-2 py-1 font-mono truncate max-w-[300px]" title={m.memberId}>{m.memberId}</td>
                    <td className="px-2 py-1 font-mono">{m.clientId}</td>
                    <td className="px-2 py-1 font-mono">{m.clientHost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Offsets */}
      {offsetData.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Topic Offsets & Lag</h4>
          {offsetData.map((topicOffset: any) => (
            <div key={topicOffset.topic} className="mb-2">
              <div className="flex items-center gap-2 mb-1">
                <Radio className="h-3 w-3 text-amber-400" />
                <span className="text-[11px] font-mono font-medium">{topicOffset.topic}</span>
                <div className="flex-1" />
                <button onClick={() => onResetOffsets(groupId, topicOffset.topic, true)}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border hover:bg-accent" title="Reset to earliest">
                  <RotateCcw className="h-2.5 w-2.5" /> Earliest
                </button>
                <button onClick={() => onResetOffsets(groupId, topicOffset.topic, false)}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border hover:bg-accent" title="Reset to latest">
                  <RotateCcw className="h-2.5 w-2.5" /> Latest
                </button>
              </div>
              <div className="rounded border overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead><tr className="bg-muted/30 border-b">
                    <th className="text-left px-2 py-1 font-medium w-20">Partition</th>
                    <th className="text-left px-2 py-1 font-medium">Offset</th>
                    <th className="text-left px-2 py-1 font-medium">Lag</th>
                    <th className="text-left px-2 py-1 font-medium">Metadata</th>
                  </tr></thead>
                  <tbody>
                    {(topicOffset.partitions || []).map((p: any) => (
                      <tr key={p.partition} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-2 py-1 font-mono text-amber-400">{p.partition}</td>
                        <td className="px-2 py-1 font-mono">{p.offset}</td>
                        <td className="px-2 py-1 font-mono">{getLag(topicOffset.topic, p.partition, p.offset)}</td>
                        <td className="px-2 py-1 font-mono text-muted-foreground truncate max-w-[200px]">{p.metadata || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Topic Config Tab ── */
const TopicConfigTab = ({ connectionId, tt, initialTopic }: { connectionId: string; tt: any; initialTopic?: string }) => {
  const [topics, setTopics] = useState<string[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic || '')
  const [configs, setConfigs] = useState<any[]>([])
  const [editedConfigs, setEditedConfigs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadTopics = useCallback(async () => {
    try {
      const result = await databaseService.listDatabases(connectionId, 'kafka')
      if (result.success) {
        const topicList = (result.databases || []).map((t: any) => typeof t === 'string' ? t : t.name).sort()
        setTopics(topicList)
        if (topicList.length > 0 && !selectedTopic) {
          setSelectedTopic(initialTopic && topicList.includes(initialTopic) ? initialTopic : topicList[0])
        }
      }
    } catch (err: any) { tt.error(err.message) }
  }, [connectionId])

  useEffect(() => { loadTopics() }, [loadTopics])

  const loadConfig = useCallback(async () => {
    if (!selectedTopic) return
    setLoading(true)
    try {
      const result = await databaseService.kafkaGetTopicConfig(connectionId, selectedTopic)
      if (result.success) {
        setConfigs(result.configs || [])
        setEditedConfigs({})
      }
    } catch (err: any) { tt.error(err.message) }
    finally { setLoading(false) }
  }, [connectionId, selectedTopic])

  useEffect(() => { loadConfig() }, [loadConfig])

  const handleEdit = (name: string, value: string) => {
    setEditedConfigs(prev => ({ ...prev, [name]: value }))
  }

  const handleCancelEdit = (name: string) => {
    setEditedConfigs(prev => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const handleSave = async () => {
    const entries = Object.entries(editedConfigs).map(([name, value]) => ({ name, value }))
    if (entries.length === 0) return
    setSaving(true)
    try {
      await databaseService.kafkaAlterTopicConfig(connectionId, selectedTopic, entries)
      tt.success(`Updated ${entries.length} config(s) for ${selectedTopic}`)
      setEditedConfigs({})
      loadConfig()
    } catch (err: any) { tt.error(err.message) }
    finally { setSaving(false) }
  }

  const hasChanges = Object.keys(editedConfigs).length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Topic Configuration</h3>
        <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)}
          className="px-2 py-1 text-[11px] rounded-md border bg-background font-mono min-w-[200px]">
          {topics.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={loadConfig} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        {hasChanges && (
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> Save {Object.keys(editedConfigs).length} change(s)
          </button>
        )}
      </div>

      {loading && configs.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground">Loading configuration...</div>
      )}

      {configs.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-[11px]">
            <thead><tr className="bg-muted/30 border-b">
              <th className="text-left px-3 py-1.5 font-medium w-[280px]">Config Key</th>
              <th className="text-left px-3 py-1.5 font-medium">Value</th>
              <th className="text-left px-3 py-1.5 font-medium w-[100px]">Source</th>
              <th className="text-center px-3 py-1.5 font-medium w-[60px]">Actions</th>
            </tr></thead>
            <tbody>
              {configs.map((c: any) => {
                const isEdited = c.configName in editedConfigs
                const isReadOnly = c.readOnly
                const displayValue = isEdited ? editedConfigs[c.configName] : (c.configValue ?? '')
                return (
                  <tr key={c.configName} className={`border-b last:border-0 hover:bg-muted/20 ${isEdited ? 'bg-amber-500/5' : ''}`}>
                    <td className="px-3 py-1.5 font-mono truncate" title={c.configName}>{c.configName}</td>
                    <td className="px-3 py-1.5">
                      {isReadOnly ? (
                        <span className="font-mono text-muted-foreground">{displayValue || '—'}</span>
                      ) : (
                        <input type="text" value={displayValue}
                          onChange={e => handleEdit(c.configName, e.target.value)}
                          className="w-full px-1.5 py-0.5 text-[11px] font-mono rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${String(c.configSource || '') === 'DYNAMIC_TOPIC_CONFIG' || c.configSource === 6 ? 'bg-blue-500/15 text-blue-500' : 'bg-muted text-muted-foreground'}`}>
                        {String(c.configSource || '').replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {isEdited && (
                        <button onClick={() => handleCancelEdit(c.configName)} className="p-0.5 rounded hover:bg-accent" title="Revert">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                      {isReadOnly && <span className="text-[9px] text-muted-foreground">read-only</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
