import { useState, useEffect, useRef, useCallback } from 'react'
import { Activity, RefreshCw, Wifi, WifiOff, HardDrive, Cpu, Database, ArrowUpDown, Clock, Server, Gauge, Radio, Users, Layers } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts'
import { useConnectionStore } from '@/store/connectionStore'
import { databaseService } from '@/services/database.service'
import { DatabaseIcon } from '@/components/common/DatabaseIcon'
import { StatsSkeleton } from '@/components/common/Skeleton'
import { formatBytes, formatCompactNumber, formatUptime } from '@/utils/formatters'

const MAX_HISTORY = 30

interface HistoryEntry {
  time: string
  [key: string]: any
}

const TREND_CONFIGS: Record<string, { key: string; label: string; color: string }[]> = {
  mongodb: [
    { key: 'connections', label: 'Connections', color: '#4ade80' },
    { key: 'queries', label: 'Queries', color: '#60a5fa' },
    { key: 'memory', label: 'Memory (MB)', color: '#fb923c' },
  ],
  postgresql: [
    { key: 'connections', label: 'Connections', color: '#4ade80' },
    { key: 'committed', label: 'Committed Txns', color: '#4ade80' },
    { key: 'hitRatio', label: 'Cache Hit Ratio %', color: '#22d3ee' },
  ],
  redis: [
    { key: 'connected', label: 'Connected Clients', color: '#4ade80' },
    { key: 'opsPerSec', label: 'Ops/sec', color: '#4ade80' },
    { key: 'memory', label: 'Memory Used', color: '#fb923c' },
  ],
}

function buildHistoryEntry(dbType: string, stats: any): HistoryEntry | null {
  const time = new Date().toLocaleTimeString()
  if (dbType === 'mongodb') {
    const conn = stats.connections || {}
    const ops = stats.opcounters || {}
    const mem = stats.mem || {}
    return { time, connections: conn.current ?? 0, queries: ops.query ?? 0, memory: mem.resident ?? 0 }
  }
  if (dbType === 'postgresql') {
    const blocks = stats.blocks || {}
    const txn = stats.transactions || {}
    const hitRatio = blocks.hit + blocks.read > 0 ? +((blocks.hit / (blocks.hit + blocks.read)) * 100).toFixed(1) : 0
    return { time, connections: stats.total_connections ?? 0, committed: txn.committed ?? 0, hitRatio }
  }
  if (dbType === 'redis') {
    const cli = stats.clients || {}
    const st = stats.stats || {}
    const mem = stats.memory || {}
    return { time, connected: cli.connected ?? 0, opsPerSec: st.instantaneousOpsPerSec ?? 0, memory: mem.usedMemory ?? 0 }
  }
  return null
}

const TrendCharts = ({ history, dbType }: { history: HistoryEntry[]; dbType: string }) => {
  const configs = TREND_CONFIGS[dbType]
  if (!configs || history.length < 2) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trends</h3>
        <div className="flex-1 h-px bg-border/30" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {configs.map(({ key, label, color }) => (
          <div key={key} className="rounded-xl border bg-card p-3.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">{label}</div>
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                  <defs>
                    <linearGradient id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{ fontSize: 10, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6 }}
                    labelStyle={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}
                  />
                  <Area type="monotone" dataKey={key} stroke={color} fill={`url(#gradient-${key})`} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const INTERVALS = [
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: '60s', value: 60000 },
  { label: 'Off', value: 0 },
]

const StatCard = ({ icon: Icon, label, value, sub, color = 'text-blue-400' }: { icon: any; label: string; value: string | number; sub?: string; color?: string }) => (
  <div className="rounded-xl border bg-card p-3.5 flex flex-col gap-1 hover:bg-accent/20 transition-colors duration-150">
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
      <div className={`p-1 rounded-md bg-muted/50`}>
        <Icon className={`h-3.5 w-3.5 ${color}`} />
      </div>
      {label}
    </div>
    <div className="text-lg font-bold tracking-tight">{value}</div>
    {sub && <div className="text-[10px] text-muted-foreground leading-relaxed">{sub}</div>}
  </div>
)

const formatNumber = formatCompactNumber

export const MonitoringPage = () => {
  const { activeConnectionId, getActiveConnection } = useConnectionStore()
  const activeConnection = getActiveConnection()
  const dbType = activeConnection?.type || 'mongodb'

  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [interval, setInterval_] = useState(10000)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isSupported = dbType === 'mongodb' || dbType === 'postgresql' || dbType === 'redis' || dbType === 'kafka'

  const fetchStats = useCallback(async () => {
    if (!activeConnectionId || !isSupported) return
    setLoading(true)
    try {
      const result = await databaseService.getServerStats(activeConnectionId, dbType)
      if (result.success) {
        setStats(result.stats)
        setError(null)
        const entry = buildHistoryEntry(dbType, result.stats)
        if (entry) {
          setHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), entry])
        }
      } else {
        setError(result.error)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }, [activeConnectionId, dbType, isSupported])

  useEffect(() => {
    setHistory([])
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (interval > 0 && activeConnectionId && isSupported) {
      timerRef.current = setInterval(fetchStats, interval)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [interval, fetchStats, activeConnectionId, isSupported])

  if (!activeConnectionId) {
    return (
      <div className="flex-1 flex items-center justify-center animate-fade-in">
        <div className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-2xl bg-muted/50 w-fit">
            <WifiOff className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Connect to a database to view server monitoring</p>
        </div>
      </div>
    )
  }

  if (!isSupported) {
    return (
      <div className="flex-1 flex items-center justify-center animate-fade-in">
        <div className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-2xl bg-muted/50 w-fit">
            <Activity className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Server monitoring is not available for {dbType}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Supported: MongoDB, PostgreSQL, Redis, Kafka</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-card/50">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-success/10">
            <Activity className="h-4 w-4 text-success" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">Server Monitoring</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <DatabaseIcon type={dbType} className="h-3 w-3" />
              <span className="text-[10px] text-muted-foreground">{activeConnection?.name}</span>
              {loading && <RefreshCw className="h-2.5 w-2.5 animate-spin text-muted-foreground" />}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && <span className="text-[10px] text-muted-foreground">Last: {lastRefresh.toLocaleTimeString()}</span>}
          <div className="flex items-center gap-0.5 border rounded-lg overflow-hidden">
            {INTERVALS.map(i => (
              <button key={i.value} onClick={() => setInterval_(i.value)}
                className={`px-2.5 py-1.5 text-[10px] font-medium transition-all duration-150 ${interval === i.value ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent'}`}>
                {i.label}
              </button>
            ))}
          </div>
          <button onClick={fetchStats} disabled={loading} className="p-1.5 rounded-lg border hover:bg-accent disabled:opacity-50 transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {error && <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs">{error}</div>}
        {stats && dbType === 'mongodb' && <MongoStats stats={stats} />}
        {stats && dbType === 'postgresql' && <PgStats stats={stats} />}
        {stats && dbType === 'redis' && <RedisStats stats={stats} />}
        {stats && dbType === 'kafka' && <KafkaStats stats={stats} />}
        {!stats && !error && <StatsSkeleton />}
        {stats && dbType !== 'kafka' && <TrendCharts history={history} dbType={dbType} />}
      </div>
    </div>
  )
}

const MongoStats = ({ stats }: { stats: any }) => {
  const conn = stats.connections || {}
  const ops = stats.opcounters || {}
  const mem = stats.mem || {}
  const net = stats.network || {}

  return (
    <div className="space-y-4">
      {/* Server Info */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Server Info</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatCard icon={Server} label="Host" value={stats.host || 'N/A'} color="text-blue-400" />
          <StatCard icon={Database} label="Version" value={stats.version || 'N/A'} color="text-purple-400" />
          <StatCard icon={Clock} label="Uptime" value={formatUptime(stats.uptime || 0)} color="text-green-400" />
          <StatCard icon={HardDrive} label="Storage Engine" value={stats.storageEngine || 'N/A'} color="text-orange-400" />
        </div>
      </div>

      {/* Connections */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Connections</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatCard icon={Wifi} label="Current" value={formatNumber(conn.current || 0)} sub={`of ${formatNumber(conn.available || 0)} available`} color="text-green-400" />
          <StatCard icon={Wifi} label="Total Created" value={formatNumber(conn.totalCreated || 0)} color="text-blue-400" />
          <StatCard icon={Gauge} label="Active" value={formatNumber(conn.active || 0)} color="text-yellow-400" />
          <StatCard icon={Gauge} label="Available" value={formatNumber(conn.available || 0)} color="text-cyan-400" />
        </div>
      </div>

      {/* Operations */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Operations (Total)</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <StatCard icon={ArrowUpDown} label="Insert" value={formatNumber(ops.insert || 0)} color="text-green-400" />
          <StatCard icon={ArrowUpDown} label="Query" value={formatNumber(ops.query || 0)} color="text-blue-400" />
          <StatCard icon={ArrowUpDown} label="Update" value={formatNumber(ops.update || 0)} color="text-yellow-400" />
          <StatCard icon={ArrowUpDown} label="Delete" value={formatNumber(ops.delete || 0)} color="text-red-400" />
          <StatCard icon={ArrowUpDown} label="GetMore" value={formatNumber(ops.getmore || 0)} color="text-purple-400" />
          <StatCard icon={ArrowUpDown} label="Command" value={formatNumber(ops.command || 0)} color="text-cyan-400" />
        </div>
      </div>

      {/* Memory */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Memory</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatCard icon={Cpu} label="Resident" value={`${mem.resident || 0} MB`} color="text-orange-400" />
          <StatCard icon={Cpu} label="Virtual" value={`${mem.virtual || 0} MB`} color="text-purple-400" />
          <StatCard icon={Cpu} label="Mapped" value={`${mem.mapped || 0} MB`} color="text-blue-400" />
        </div>
      </div>

      {/* Network */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Network</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          <StatCard icon={ArrowUpDown} label="Bytes In" value={formatBytes(net.bytesIn || 0)} color="text-green-400" />
          <StatCard icon={ArrowUpDown} label="Bytes Out" value={formatBytes(net.bytesOut || 0)} color="text-blue-400" />
          <StatCard icon={ArrowUpDown} label="Requests" value={formatNumber(net.numRequests || 0)} color="text-yellow-400" />
        </div>
      </div>

      {/* Replication */}
      {stats.repl && (
        <div>
          <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Replication</h3><div className="flex-1 h-px bg-border/30" /></div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <StatCard icon={Database} label="Replica Set" value={stats.repl.setName || 'N/A'} color="text-purple-400" />
            <StatCard icon={Server} label="Is Primary" value={stats.repl.ismaster ? 'Yes' : 'No'} color={stats.repl.ismaster ? 'text-green-400' : 'text-yellow-400'} />
          </div>
        </div>
      )}
    </div>
  )
}

const PgStats = ({ stats }: { stats: any }) => {
  const conn = stats.connections || {}
  const txn = stats.transactions || {}
  const tuples = stats.tuples || {}
  const blocks = stats.blocks || {}

  const hitRatio = blocks.hit + blocks.read > 0 ? ((blocks.hit / (blocks.hit + blocks.read)) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-4">
      {/* Server Info */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Server Info</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-1 gap-2.5">
          <StatCard icon={Server} label="Version" value={stats.version || 'N/A'} color="text-blue-400" />
        </div>
      </div>

      {/* Database Size & Connections */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Overview</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatCard icon={HardDrive} label="Database Size" value={formatBytes(stats.database_size || 0)} color="text-orange-400" />
          <StatCard icon={Wifi} label="Total Connections" value={stats.total_connections || 0} color="text-green-400" />
          <StatCard icon={Gauge} label="Cache Hit Ratio" value={`${hitRatio}%`} sub={`${formatNumber(blocks.hit)} hits / ${formatNumber(blocks.read)} reads`} color="text-cyan-400" />
        </div>
      </div>

      {/* Connections by State */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Connections by State</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(conn).map(([state, count]) => (
            <StatCard key={state} icon={Wifi} label={state === 'null' ? 'Unknown' : state}
              value={count as number}
              color={state === 'active' ? 'text-green-400' : state === 'idle' ? 'text-blue-400' : 'text-yellow-400'} />
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Transactions</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          <StatCard icon={ArrowUpDown} label="Committed" value={formatNumber(txn.committed || 0)} color="text-green-400" />
          <StatCard icon={ArrowUpDown} label="Rolled Back" value={formatNumber(txn.rolledBack || 0)} color="text-red-400" />
        </div>
      </div>

      {/* Tuple Operations */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Tuple Operations (Total)</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <StatCard icon={ArrowUpDown} label="Returned" value={formatNumber(tuples.returned || 0)} color="text-blue-400" />
          <StatCard icon={ArrowUpDown} label="Fetched" value={formatNumber(tuples.fetched || 0)} color="text-cyan-400" />
          <StatCard icon={ArrowUpDown} label="Inserted" value={formatNumber(tuples.inserted || 0)} color="text-green-400" />
          <StatCard icon={ArrowUpDown} label="Updated" value={formatNumber(tuples.updated || 0)} color="text-yellow-400" />
          <StatCard icon={ArrowUpDown} label="Deleted" value={formatNumber(tuples.deleted || 0)} color="text-red-400" />
        </div>
      </div>
    </div>
  )
}


const RedisStats = ({ stats }: { stats: any }) => {
  const srv = stats.server || {}
  const cli = stats.clients || {}
  const mem = stats.memory || {}
  const st = stats.stats || {}
  const pers = stats.persistence || {}
  const repl = stats.replication || {}
  const cpu = stats.cpu || {}
  const ks = stats.keyspace || []

  const hitRatio = st.keyspaceHits + st.keyspaceMisses > 0
    ? ((st.keyspaceHits / (st.keyspaceHits + st.keyspaceMisses)) * 100).toFixed(1)
    : '0'

  const totalKeys = ks.reduce((sum: number, db: any) => sum + db.keys, 0)

  return (
    <div className="space-y-4">
      {/* Server Info */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Server Info</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatCard icon={Server} label="Version" value={srv.version} color="text-red-400" />
          <StatCard icon={Database} label="Mode" value={srv.mode} color="text-purple-400" />
          <StatCard icon={Clock} label="Uptime" value={formatUptime(srv.uptimeInSeconds || 0)} color="text-green-400" />
          <StatCard icon={Server} label="Port" value={srv.tcpPort} color="text-blue-400" />
        </div>
      </div>

      {/* Clients */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Clients</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatCard icon={Wifi} label="Connected" value={formatNumber(cli.connected)} color="text-green-400" />
          <StatCard icon={Wifi} label="Blocked" value={formatNumber(cli.blocked)} color="text-red-400" />
          <StatCard icon={Gauge} label="Max Clients" value={formatNumber(cli.maxClients)} color="text-blue-400" />
        </div>
      </div>

      {/* Memory */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Memory</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatCard icon={Cpu} label="Used Memory" value={mem.usedHuman} sub={`Peak: ${mem.usedPeakHuman}`} color="text-orange-400" />
          <StatCard icon={Cpu} label="RSS Memory" value={mem.usedRssHuman} color="text-purple-400" />
          <StatCard icon={HardDrive} label="Max Memory" value={mem.maxMemory > 0 ? mem.maxMemoryHuman : 'Unlimited'} sub={`Policy: ${mem.maxMemoryPolicy}`} color="text-blue-400" />
          <StatCard icon={Gauge} label="Frag Ratio" value={mem.fragRatio.toFixed(2)} sub={mem.fragRatio > 1.5 ? '⚠ High fragmentation' : 'Normal'} color={mem.fragRatio > 1.5 ? 'text-yellow-400' : 'text-green-400'} />
        </div>
      </div>

      {/* Operations */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Operations</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatCard icon={Gauge} label="Ops/sec" value={formatNumber(st.instantaneousOpsPerSec)} color="text-green-400" />
          <StatCard icon={ArrowUpDown} label="Total Commands" value={formatNumber(st.totalCommandsProcessed)} color="text-blue-400" />
          <StatCard icon={ArrowUpDown} label="Total Connections" value={formatNumber(st.totalConnectionsReceived)} color="text-cyan-400" />
          <StatCard icon={Gauge} label="Hit Ratio" value={`${hitRatio}%`} sub={`${formatNumber(st.keyspaceHits)} hits / ${formatNumber(st.keyspaceMisses)} misses`} color="text-yellow-400" />
        </div>
      </div>

      {/* Network */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Network & Keys</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatCard icon={ArrowUpDown} label="Net Input" value={formatBytes(st.totalNetInputBytes)} color="text-green-400" />
          <StatCard icon={ArrowUpDown} label="Net Output" value={formatBytes(st.totalNetOutputBytes)} color="text-blue-400" />
          <StatCard icon={Database} label="Total Keys" value={formatNumber(totalKeys)} color="text-red-400" />
          <StatCard icon={Clock} label="Expired Keys" value={formatNumber(st.expiredKeys)} sub={`Evicted: ${formatNumber(st.evictedKeys)}`} color="text-orange-400" />
        </div>
      </div>

      {/* Persistence */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Persistence</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatCard icon={HardDrive} label="RDB Status" value={pers.rdbLastSaveStatus} sub={`Changes: ${formatNumber(pers.rdbChangesSinceLastSave)}`} color={pers.rdbLastSaveStatus === 'ok' ? 'text-green-400' : 'text-red-400'} />
          <StatCard icon={HardDrive} label="AOF Enabled" value={pers.aofEnabled ? 'Yes' : 'No'} sub={pers.aofEnabled ? `Rewrite: ${pers.aofLastRewriteStatus}` : ''} color={pers.aofEnabled ? 'text-green-400' : 'text-muted-foreground'} />
          <StatCard icon={Database} label="Pub/Sub" value={`${st.pubsubChannels} ch`} sub={`${st.pubsubPatterns} patterns`} color="text-purple-400" />
        </div>
      </div>

      {/* Replication */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Replication & CPU</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatCard icon={Server} label="Role" value={repl.role} color={repl.role === 'master' ? 'text-green-400' : 'text-yellow-400'} />
          <StatCard icon={Wifi} label="Connected Slaves" value={repl.connectedSlaves} color="text-blue-400" />
          <StatCard icon={Cpu} label="CPU Sys" value={`${cpu.usedCpuSys.toFixed(2)}s`} color="text-orange-400" />
          <StatCard icon={Cpu} label="CPU User" value={`${cpu.usedCpuUser.toFixed(2)}s`} color="text-purple-400" />
        </div>
      </div>

      {/* Keyspace */}
      {ks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Keyspace</h3><div className="flex-1 h-px bg-border/30" /></div>
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Database</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Keys</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Expires</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Avg TTL (ms)</th>
                </tr>
              </thead>
              <tbody>
                {ks.map((db: any) => (
                  <tr key={db.db} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-1.5 font-mono text-red-400">{db.db}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(db.keys)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(db.expires)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(db.avgTtl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}


const KafkaStats = ({ stats }: { stats: any }) => {
  const s = stats.stats || stats
  return (
    <div className="space-y-4">
      {/* Cluster Overview */}
      <div>
        <div className="flex items-center gap-2 mb-2.5"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Cluster Overview</h3><div className="flex-1 h-px bg-border/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <StatCard icon={Server} label="Brokers" value={s.brokers ?? '—'} color="text-amber-400" />
          <StatCard icon={Radio} label="Controller" value={s.controller ?? '—'} color="text-green-400" />
          <StatCard icon={Database} label="Topics" value={s.topicCount ?? '—'} color="text-blue-400" />
          <StatCard icon={Layers} label="Partitions" value={s.totalPartitions ?? '—'} color="text-purple-400" />
          <StatCard icon={Users} label="Consumer Groups" value={s.consumerGroupCount ?? '—'} color="text-cyan-400" />
          <StatCard icon={HardDrive} label="Cluster ID" value={s.clusterId ? String(s.clusterId).slice(0, 12) + '…' : '—'} sub={s.clusterId || undefined} color="text-muted-foreground" />
        </div>
      </div>
    </div>
  )
}
