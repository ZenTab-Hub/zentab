import { useState, useEffect, useMemo } from 'react'
import { Radio, RefreshCw, Send, Copy, FileJson, Table, ChevronDown, ChevronRight, Search, X, Info, Server } from 'lucide-react'
import { Input } from '@/components/common/Input'
import { useConnectionStore } from '@/store/connectionStore'
import { databaseService } from '@/services/database.service'
import { useToast } from '@/components/common/Toast'
import { Skeleton } from '@/components/common/Skeleton'

export const KafkaMessageViewer = () => {
  const { activeConnectionId, selectedDatabase, selectedCollection } = useConnectionStore()
  const tt = useToast()
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [limit, setLimit] = useState(50)
  const [fromBeginning, setFromBeginning] = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  // Produce message state
  const [showProduce, setShowProduce] = useState(false)
  const [produceKey, setProduceKey] = useState('')
  const [produceValue, setProduceValue] = useState('')
  const [producing, setProducing] = useState(false)
  // Filter state
  const [filterKey, setFilterKey] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  // Partition details state
  const [showPartitions, setShowPartitions] = useState(false)
  const [partitionDetails, setPartitionDetails] = useState<any>(null)
  const [partitionLoading, setPartitionLoading] = useState(false)

  useEffect(() => {
    if (activeConnectionId && selectedCollection) {
      consumeMessages()
    } else {
      setMessages([])
    }
  }, [activeConnectionId, selectedCollection])

  const consumeMessages = async () => {
    if (!activeConnectionId || !selectedCollection) return
    try {
      setLoading(true)
      const result = await databaseService.kafkaConsumeMessages(activeConnectionId, selectedCollection, limit, fromBeginning)
      if (result.success) {
        setMessages(result.documents || [])
      }
    } catch (error: any) {
      console.error('Failed to consume messages:', error)
      tt.error('Failed to consume: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleProduce = async () => {
    if (!activeConnectionId || !selectedCollection) return
    if (!produceValue.trim()) { tt.warning('Message value is required'); return }
    try {
      setProducing(true)
      const messages = [{ key: produceKey || undefined, value: produceValue }]
      const result = await databaseService.kafkaProduceMessage(activeConnectionId, selectedCollection, messages as any)
      if (result.success) {
        tt.success('Message sent!')
        setProduceKey('')
        setProduceValue('')
        setShowProduce(false)
        await consumeMessages()
      }
    } catch (error: any) {
      tt.error('Produce failed: ' + error.message)
    } finally {
      setProducing(false)
    }
  }

  const toggleRow = (key: string) => {
    const next = new Set(expandedRows)
    next.has(key) ? next.delete(key) : next.add(key)
    setExpandedRows(next)
  }

  const copyMessages = () => {
    navigator.clipboard.writeText(JSON.stringify(messages, null, 2))
  }

  const formatTimestamp = (ts: string) => {
    if (!ts) return '—'
    try { return new Date(Number(ts)).toLocaleString() } catch { return ts }
  }

  const tryParseJSON = (str: string | null) => {
    if (!str) return str
    try { return JSON.stringify(JSON.parse(str), null, 2) } catch { return str }
  }

  // Filtered messages
  const filteredMessages = useMemo(() => {
    if (!filterKey && !filterValue) return messages
    return messages.filter((msg) => {
      const keyMatch = !filterKey || (msg.key || '').toLowerCase().includes(filterKey.toLowerCase())
      const valMatch = !filterValue || (msg.value || '').toLowerCase().includes(filterValue.toLowerCase())
      return keyMatch && valMatch
    })
  }, [messages, filterKey, filterValue])

  // Fetch partition details
  const fetchPartitionDetails = async () => {
    if (!activeConnectionId || !selectedCollection) return
    try {
      setPartitionLoading(true)
      const result = await databaseService.getCollectionStats(activeConnectionId, selectedCollection, 'kafka')
      if (result.success) {
        // Merge metadata.partitions with offsets
        const meta = result.metadata || {}
        const offsets = result.offsets || []
        const offsetMap = new Map(offsets.map((o: any) => [o.partition, o]))
        const partitions = (meta.partitions || []).map((p: any) => {
          const oData = offsetMap.get(p.partitionId) as Record<string, any> | undefined
          return { ...p, ...(oData || {}) }
        })
        setPartitionDetails({ partitions, name: meta.name })
      }
    } catch (err: any) {
      tt.error('Failed to load partition details: ' + err.message)
    } finally {
      setPartitionLoading(false)
    }
  }

  // Empty state
  if (!selectedCollection) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Radio className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Select a topic from the sidebar to view messages</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Message Viewer</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Topic: <span className="font-mono">{selectedCollection}</span>
          </p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setShowProduce(!showProduce)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors">
            <Send className="h-3.5 w-3.5" />
            Produce
          </button>
          <button onClick={copyMessages} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors">
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
          <button onClick={consumeMessages} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Consume
          </button>
        </div>
      </div>

      {/* Produce Panel */}
      {showProduce && (
        <div className="rounded-md border bg-card p-3 space-y-2">
          <span className="text-[11px] font-semibold">Produce Message</span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">Key (optional)</label>
              <Input value={produceKey} onChange={(e) => setProduceKey(e.target.value)} placeholder="Message key" className="text-[11px] h-7 font-mono" />
            </div>
            <div className="flex items-end gap-1.5">
              <button onClick={handleProduce} disabled={producing} className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                {producing ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">Value</label>
            <textarea value={produceValue} onChange={(e) => setProduceValue(e.target.value)} placeholder='{"event": "test"}' className="w-full h-20 p-2 text-[11px] font-mono rounded-md border bg-background resize-y focus:outline-none focus:ring-1 focus:ring-primary" spellCheck={false} />
          </div>
        </div>
      )}

      {/* Consume Controls */}
      <div className="flex gap-1.5 items-center">
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-muted-foreground">Limit:</label>
          <Input type="number" value={String(limit)} onChange={(e) => setLimit(Number(e.target.value) || 50)} className="w-20 text-[11px] h-7" />
        </div>
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={fromBeginning} onChange={(e) => setFromBeginning(e.target.checked)} className="rounded border-border" />
          From beginning
        </label>
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground">
          {filterKey || filterValue ? `${filteredMessages.length} / ` : ''}{messages.length} messages
        </span>
        <span className="text-muted-foreground/30">|</span>
        <button onClick={() => setShowFilter(!showFilter)} className={`p-1.5 rounded transition-colors ${showFilter ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}`} title="Filter Messages">
          <Search className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => { setShowPartitions(!showPartitions); if (!showPartitions && !partitionDetails) fetchPartitionDetails() }} className={`p-1.5 rounded transition-colors ${showPartitions ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}`} title="Partition Details">
          <Info className="h-3.5 w-3.5" />
        </button>
        <span className="text-muted-foreground/30">|</span>
        <button onClick={() => setViewMode('table')} className={`p-1.5 rounded transition-colors ${viewMode === 'table' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}`} title="Table View">
          <Table className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setViewMode('json')} className={`p-1.5 rounded transition-colors ${viewMode === 'json' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}`} title="JSON View">
          <FileJson className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Filter Panel */}
      {showFilter && (
        <div className="flex gap-2 items-center rounded-md border bg-card/50 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input value={filterKey} onChange={(e) => setFilterKey(e.target.value)} placeholder="Filter by key..." className="text-[11px] h-7 flex-1" />
          <Input value={filterValue} onChange={(e) => setFilterValue(e.target.value)} placeholder="Filter by value..." className="text-[11px] h-7 flex-1" />
          {(filterKey || filterValue) && (
            <button onClick={() => { setFilterKey(''); setFilterValue('') }} className="p-1 rounded hover:bg-accent text-muted-foreground" title="Clear filters">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Partition Details Panel */}
      {showPartitions && (
        <div className="rounded-md border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold flex items-center gap-1.5"><Server className="h-3.5 w-3.5 text-amber-400" /> Partition Details</span>
            <button onClick={fetchPartitionDetails} disabled={partitionLoading} className="text-[10px] text-muted-foreground hover:text-primary">
              <RefreshCw className={`h-3 w-3 ${partitionLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {partitionLoading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-3 w-full" />)}
            </div>
          ) : partitionDetails?.partitions ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase">Partition</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase">Leader</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase">Replicas</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase">ISR</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase">Offset (High)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {partitionDetails.partitions.map((p: any) => (
                    <tr key={p.partitionId} className="hover:bg-muted/30">
                      <td className="px-2 py-1.5 font-mono text-amber-400">{p.partitionId}</td>
                      <td className="px-2 py-1.5 font-mono">{p.leader}</td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{(p.replicas || []).join(', ')}</td>
                      <td className="px-2 py-1.5 font-mono text-green-400">{(p.isr || []).join(', ')}</td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{p.high ?? p.offset ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">No partition data available</p>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto rounded-md border bg-card">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-muted-foreground">Consuming messages...</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Radio className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{messages.length === 0 ? 'No messages in this topic' : 'No messages match the filter'}</p>
              {messages.length === 0 && <p className="text-[10px] text-muted-foreground mt-1">Click "Consume" to fetch messages or "Produce" to send one</p>}
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
                  const isExpanded = expandedRows.has(rowKey)
                  return (
                    <>
                      <tr key={rowKey} className="hover:bg-muted/30 text-[11px]">
                        <td className="px-2 py-1.5">
                          <button onClick={() => toggleRow(rowKey)} className="text-muted-foreground hover:text-primary">
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </button>
                        </td>
                        <td className="px-2 py-1.5 font-mono text-amber-400">{msg.partition}</td>
                        <td className="px-2 py-1.5 font-mono text-muted-foreground">{msg.offset}</td>
                        <td className="px-2 py-1.5 font-mono truncate max-w-[200px]" title={msg.key || ''}>{msg.key || <span className="text-muted-foreground/50">null</span>}</td>
                        <td className="px-2 py-1.5 font-mono truncate max-w-[400px]" title={msg.value || ''}>{msg.value || <span className="text-muted-foreground/50">null</span>}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{formatTimestamp(msg.timestamp)}</td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${rowKey}-exp`}>
                          <td colSpan={6} className="px-4 py-2 bg-muted/20">
                            <div className="space-y-1">
                              <div className="text-[10px] text-muted-foreground">Partition: {msg.partition} | Offset: {msg.offset} | Timestamp: {formatTimestamp(msg.timestamp)}</div>
                              {msg.key && <div><span className="text-[10px] text-muted-foreground">Key:</span><pre className="text-[11px] font-mono mt-0.5">{msg.key}</pre></div>}
                              <div><span className="text-[10px] text-muted-foreground">Value:</span><pre className="text-[11px] font-mono mt-0.5 whitespace-pre-wrap break-all">{tryParseJSON(msg.value)}</pre></div>
                              {msg.headers && Object.keys(msg.headers).length > 0 && (
                                <div><span className="text-[10px] text-muted-foreground">Headers:</span><pre className="text-[11px] font-mono mt-0.5">{JSON.stringify(msg.headers, null, 2)}</pre></div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
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

