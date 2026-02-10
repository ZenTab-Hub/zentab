import { useState, useEffect, useCallback } from 'react'
import {
  Radio, Users, RefreshCw, Trash2, RotateCcw,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import { databaseService } from '@/services/database.service'

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

export const KafkaConsumerGroupsTab = ({ connectionId, tt }: { connectionId: string; tt: any }) => {
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

