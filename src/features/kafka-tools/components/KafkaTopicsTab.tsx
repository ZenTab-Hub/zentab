import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Radio, RefreshCw, Trash2, ChevronDown, ChevronRight, Plus, Search,
} from 'lucide-react'
import { databaseService } from '@/services/database.service'

export const KafkaTopicsTab = ({ connectionId, tt }: { connectionId: string; tt: any }) => {
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
                <TopicPartitionDetail meta={topicMeta} loading={metaLoading} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Partition detail (expanded row) ── */
const TopicPartitionDetail = ({ meta, loading }: { meta: any; loading: boolean }) => {
  if (loading) return <div className="border-t px-4 py-3 bg-muted/10"><p className="text-[11px] text-muted-foreground">Loading partition details...</p></div>
  if (!meta?.metadata?.partitions) return <div className="border-t px-4 py-3 bg-muted/10"><p className="text-[11px] text-muted-foreground">No metadata available</p></div>

  return (
    <div className="border-t px-4 py-3 bg-muted/10 space-y-2">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Partitions ({meta.metadata.partitions.length})</h4>
      <div className="rounded border overflow-hidden">
        <table className="w-full text-[11px]">
          <thead><tr className="bg-muted/30 border-b">
            <th className="text-left px-2 py-1 font-medium w-20">ID</th>
            <th className="text-left px-2 py-1 font-medium">Leader</th>
            <th className="text-left px-2 py-1 font-medium">Replicas</th>
            <th className="text-left px-2 py-1 font-medium">ISR</th>
          </tr></thead>
          <tbody>
            {meta.metadata.partitions.map((p: any) => (
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
      {meta.offsets && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-2">Offsets</h4>
          <div className="flex flex-wrap gap-2 mt-1">
            {meta.offsets.map((o: any) => (
              <div key={o.partition} className="text-[10px] px-2 py-1 rounded bg-muted font-mono">
                P{o.partition}: <span className="text-muted-foreground">{o.low ?? '?'}</span> → <span className="text-primary">{o.high ?? o.offset ?? '?'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

