import { useState, useEffect, useCallback, useRef } from 'react'
import { Terminal, Users, Trash2, Clock, RefreshCw, Layers, Radio, Send, X } from 'lucide-react'
import { useConnectionStore } from '@/store/connectionStore'
import { databaseService } from '@/services/database.service'
import { useToast } from '@/components/common/Toast'

type Tab = 'slowlog' | 'clients' | 'bulk' | 'pubsub'

export const RedisToolsPage = () => {
  const { activeConnectionId, getActiveConnection, selectedDatabase } = useConnectionStore()
  const activeConnection = getActiveConnection()
  const dbType = activeConnection?.type
  const tt = useToast()
  const [tab, setTab] = useState<Tab>('slowlog')

  if (!activeConnectionId || dbType !== 'redis') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Connect to a Redis server to use Redis Tools</p>
        </div>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'slowlog', label: 'Slow Log', icon: Clock },
    { id: 'clients', label: 'Client List', icon: Users },
    { id: 'bulk', label: 'Bulk Operations', icon: Trash2 },
    { id: 'pubsub', label: 'Pub/Sub', icon: Radio },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-card/50">
        <Terminal className="h-4 w-4 text-red-400" />
        <h2 className="text-sm font-semibold mr-4">Redis Tools</h2>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${tab === t.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {tab === 'slowlog' && <SlowLogTab connectionId={activeConnectionId} tt={tt} />}
        {tab === 'clients' && <ClientListTab connectionId={activeConnectionId} tt={tt} />}
        {tab === 'bulk' && <BulkOpsTab connectionId={activeConnectionId} database={selectedDatabase || 'db0'} tt={tt} />}
        {tab === 'pubsub' && <PubSubTab connectionId={activeConnectionId} tt={tt} />}
      </div>
    </div>
  )
}

/* ── Slow Log Tab ── */
const SlowLogTab = ({ connectionId, tt }: { connectionId: string; tt: any }) => {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await databaseService.redisGetSlowLog(connectionId, 100)
      if (r.success) setEntries(r.entries || [])
      else tt.error(r.error)
    } catch (e: any) { tt.error(e.message) }
    finally { setLoading(false) }
  }, [connectionId])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Slow Log ({entries.length} entries)</h3>
        <button onClick={load} disabled={loading} className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border hover:bg-accent disabled:opacity-50">
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">No slow log entries found</p>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-[11px]">
            <thead><tr className="border-b bg-muted/30">
              <th className="text-left px-3 py-1.5 font-medium w-16">ID</th>
              <th className="text-left px-3 py-1.5 font-medium w-40">Time</th>
              <th className="text-right px-3 py-1.5 font-medium w-24">Duration</th>
              <th className="text-left px-3 py-1.5 font-medium">Command</th>
              <th className="text-left px-3 py-1.5 font-medium w-32">Client</th>
            </tr></thead>
            <tbody>
              {entries.map((e: any) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-1.5 text-muted-foreground">{e.id}</td>
                  <td className="px-3 py-1.5">{new Date(e.timestamp * 1000).toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    <span className={e.duration > 10000 ? 'text-red-400' : e.duration > 1000 ? 'text-yellow-400' : 'text-green-400'}>
                      {e.duration >= 1000 ? `${(e.duration / 1000).toFixed(1)}ms` : `${e.duration}µs`}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 font-mono truncate max-w-[400px]">{e.command}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{e.clientAddr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Client List Tab ── */
const ClientListTab = ({ connectionId, tt }: { connectionId: string; tt: any }) => {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await databaseService.redisGetClients(connectionId)
      if (r.success) setClients(r.clients || [])
      else tt.error(r.error)
    } catch (e: any) { tt.error(e.message) }
    finally { setLoading(false) }
  }, [connectionId])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Connected Clients ({clients.length})</h3>
        <button onClick={load} disabled={loading} className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border hover:bg-accent disabled:opacity-50">
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      {clients.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">No clients connected</p>
      ) : (
        <div className="rounded-lg border bg-card overflow-auto">
          <table className="w-full text-[11px]">
            <thead><tr className="border-b bg-muted/30">
              <th className="text-left px-3 py-1.5 font-medium">ID</th>
              <th className="text-left px-3 py-1.5 font-medium">Address</th>
              <th className="text-left px-3 py-1.5 font-medium">Name</th>
              <th className="text-left px-3 py-1.5 font-medium">DB</th>
              <th className="text-right px-3 py-1.5 font-medium">Age (s)</th>
              <th className="text-right px-3 py-1.5 font-medium">Idle (s)</th>
              <th className="text-left px-3 py-1.5 font-medium">Flags</th>
              <th className="text-left px-3 py-1.5 font-medium">Cmd</th>
            </tr></thead>
            <tbody>
              {clients.map((c: any, i: number) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-1.5 font-mono">{c.id || '-'}</td>
                  <td className="px-3 py-1.5 font-mono">{c.addr || '-'}</td>
                  <td className="px-3 py-1.5">{c.name || '-'}</td>
                  <td className="px-3 py-1.5">{c.db || '0'}</td>
                  <td className="px-3 py-1.5 text-right">{c.age || '-'}</td>
                  <td className="px-3 py-1.5 text-right">{c.idle || '-'}</td>
                  <td className="px-3 py-1.5 font-mono">{c.flags || '-'}</td>
                  <td className="px-3 py-1.5 font-mono">{c.cmd || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Bulk Operations Tab ── */
const BulkOpsTab = ({ connectionId, database, tt }: { connectionId: string; database: string; tt: any }) => {
  const [pattern, setPattern] = useState('*')
  const [ttlValue, setTtlValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleBulkDelete = () => {
    if (!pattern || pattern === '*') {
      tt.confirm('⚠️ This will delete ALL keys matching "*" in the selected database. Are you sure?', async () => {
        await doBulkDelete()
      })
    } else {
      tt.confirm(`Delete all keys matching "${pattern}"?`, async () => {
        await doBulkDelete()
      })
    }
  }

  const doBulkDelete = async () => {
    setLoading(true)
    try {
      const r = await databaseService.redisBulkDelete(connectionId, database, pattern)
      if (r.success) {
        setResult(`✅ Deleted ${r.deleted} keys matching "${pattern}"`)
        tt.success(`Deleted ${r.deleted} keys`)
      } else {
        tt.error(r.error)
      }
    } catch (e: any) { tt.error(e.message) }
    finally { setLoading(false) }
  }

  const handleBulkTTL = async () => {
    const ttl = parseInt(ttlValue)
    if (isNaN(ttl)) { tt.error('Invalid TTL value'); return }
    setLoading(true)
    try {
      const r = await databaseService.redisBulkTTL(connectionId, database, pattern, ttl)
      if (r.success) {
        setResult(`✅ Updated TTL on ${r.updated} keys matching "${pattern}" to ${ttl > 0 ? ttl + 's' : 'persistent'}`)
        tt.success(`Updated TTL on ${r.updated} keys`)
      } else {
        tt.error(r.error)
      }
    } catch (e: any) { tt.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4 max-w-lg">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bulk Operations — {database}</h3>

      <div className="space-y-2">
        <label className="text-[11px] font-medium">Key Pattern</label>
        <input
          value={pattern} onChange={e => setPattern(e.target.value)}
          className="w-full px-3 py-2 text-[12px] font-mono rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="user:*"
        />
        <p className="text-[10px] text-muted-foreground">Use * for wildcard. Examples: user:*, session:*, cache:prefix:*</p>
      </div>

      <div className="flex gap-2">
        <button onClick={handleBulkDelete} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
          <Trash2 className="h-3.5 w-3.5" /> Delete by Pattern
        </button>
      </div>

      <div className="border-t pt-4 space-y-2">
        <label className="text-[11px] font-medium">Bulk Set TTL</label>
        <div className="flex gap-2">
          <input
            value={ttlValue} onChange={e => setTtlValue(e.target.value)}
            className="w-32 px-3 py-2 text-[12px] font-mono rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="3600" type="number"
          />
          <button onClick={handleBulkTTL} disabled={loading || !ttlValue}
            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors disabled:opacity-50">
            <Clock className="h-3.5 w-3.5" /> Set TTL (seconds)
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">Set 0 to remove TTL (make persistent)</p>
      </div>

      {result && (
        <div className="p-3 rounded-lg border bg-card text-[11px] font-mono">{result}</div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin" /> Processing...
        </div>
      )}
    </div>
  )
}


/* ── Pub/Sub Tab ── */
interface PubSubMessage {
  channel: string
  message: string
  timestamp: number
}

const PubSubTab = ({ connectionId, tt }: { connectionId: string; tt: any }) => {
  const [subscribeInput, setSubscribeInput] = useState('')
  const [subscribedChannels, setSubscribedChannels] = useState<string[]>([])
  const [messages, setMessages] = useState<PubSubMessage[]>([])
  const [publishChannel, setPublishChannel] = useState('')
  const [publishMessage, setPublishMessage] = useState('')
  const [serverChannels, setServerChannels] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Listen for incoming pub/sub messages
  useEffect(() => {
    const unsubscribe = databaseService.onRedisPubSubMessage((data) => {
      if (data.connectionId === connectionId) {
        setMessages(prev => [...prev, { channel: data.channel, message: data.message, timestamp: data.timestamp }])
      }
    })
    return () => { unsubscribe() }
  }, [connectionId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cleanup on unmount
  useEffect(() => {
    return () => { databaseService.redisUnsubscribeAll(connectionId) }
  }, [connectionId])

  const loadServerChannels = async () => {
    try {
      const r = await databaseService.redisGetPubSubChannels(connectionId)
      if (r.success) {
        setServerChannels(r.channels || [])
        setSubscribedChannels(r.subscribedChannels || [])
      }
    } catch {}
  }

  useEffect(() => { loadServerChannels() }, [connectionId])

  const handleSubscribe = async () => {
    if (!subscribeInput.trim()) return
    const channels = subscribeInput.split(',').map(c => c.trim()).filter(Boolean)
    try {
      const r = await databaseService.redisSubscribe(connectionId, channels)
      if (r.success) {
        setSubscribedChannels(r.channels || [])
        setSubscribeInput('')
        tt.success(`Subscribed to: ${channels.join(', ')}`)
        loadServerChannels()
      } else { tt.error(r.error) }
    } catch (e: any) { tt.error(e.message) }
  }

  const handleUnsubscribe = async (channel: string) => {
    try {
      const r = await databaseService.redisUnsubscribe(connectionId, [channel])
      if (r.success) {
        setSubscribedChannels(r.channels || [])
        tt.success(`Unsubscribed from: ${channel}`)
        loadServerChannels()
      } else { tt.error(r.error) }
    } catch (e: any) { tt.error(e.message) }
  }

  const handlePublish = async () => {
    if (!publishChannel.trim() || !publishMessage.trim()) return
    try {
      const r = await databaseService.redisPublish(connectionId, publishChannel, publishMessage)
      if (r.success) {
        tt.success(`Published to ${publishChannel} (${r.receivers} receivers)`)
        setPublishMessage('')
      } else { tt.error(r.error) }
    } catch (e: any) { tt.error(e.message) }
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Subscribe Section */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subscribe to Channels</h3>
        <div className="flex gap-2">
          <input value={subscribeInput} onChange={e => setSubscribeInput(e.target.value)}
            placeholder="channel1, channel2, ..."
            className="flex-1 px-3 py-2 text-[12px] font-mono rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            onKeyDown={e => { if (e.key === 'Enter') handleSubscribe() }}
          />
          <button onClick={handleSubscribe} disabled={!subscribeInput.trim()}
            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            <Radio className="h-3.5 w-3.5" /> Subscribe
          </button>
          <button onClick={loadServerChannels}
            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Subscribed Channels */}
        {subscribedChannels.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground">Subscribed:</span>
            {subscribedChannels.map(ch => (
              <span key={ch} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-[10px] font-mono">
                {ch}
                <button onClick={() => handleUnsubscribe(ch)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Server active channels */}
        {serverChannels.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground">Active on server:</span>
            {serverChannels.map(ch => (
              <span key={ch} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">{ch}</span>
            ))}
          </div>
        )}
      </div>

      {/* Publish Section */}
      <div className="space-y-2 border-t pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Publish Message</h3>
        <div className="flex gap-2">
          <input value={publishChannel} onChange={e => setPublishChannel(e.target.value)} placeholder="Channel"
            className="w-48 px-3 py-2 text-[12px] font-mono rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
          <input value={publishMessage} onChange={e => setPublishMessage(e.target.value)} placeholder="Message..."
            className="flex-1 px-3 py-2 text-[12px] font-mono rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            onKeyDown={e => { if (e.key === 'Enter') handlePublish() }}
          />
          <button onClick={handlePublish} disabled={!publishChannel.trim() || !publishMessage.trim()}
            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            <Send className="h-3.5 w-3.5" /> Publish
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 border-t pt-3 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Messages ({messages.length})</h3>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Clear</button>
          )}
        </div>
        <div className="flex-1 overflow-auto rounded-lg border bg-card">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full py-12">
              <div className="text-center">
                <Radio className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-[11px] text-muted-foreground">Subscribe to channels to see messages here</p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {messages.map((m, i) => (
                <div key={`${m.timestamp}-${i}`} className="px-3 py-2 hover:bg-muted/20 text-[11px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-mono text-[10px]">{m.channel}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(m.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <pre className="font-mono whitespace-pre-wrap break-all text-foreground">{m.message}</pre>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
