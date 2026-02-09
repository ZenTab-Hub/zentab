import { useState, useEffect, useRef, useCallback } from 'react'
import { Activity, RefreshCw, Wifi, WifiOff, HardDrive, Cpu, Database, ArrowUpDown, Clock, Server, Gauge } from 'lucide-react'
import { useConnectionStore } from '@/store/connectionStore'
import { databaseService } from '@/services/database.service'
import { DatabaseIcon } from '@/components/common/DatabaseIcon'

const INTERVALS = [
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: '60s', value: 60000 },
  { label: 'Off', value: 0 },
]

const StatCard = ({ icon: Icon, label, value, sub, color = 'text-blue-400' }: { icon: any; label: string; value: string | number; sub?: string; color?: string }) => (
  <div className="rounded-lg border bg-card p-3 flex flex-col gap-1">
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider">
      <Icon className={`h-3.5 w-3.5 ${color}`} />
      {label}
    </div>
    <div className="text-lg font-bold">{value}</div>
    {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
  </div>
)

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

const formatUptime = (seconds: number) => {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${seconds % 60}s`
}

const formatNumber = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)

export const MonitoringPage = () => {
  const { activeConnectionId, getActiveConnection } = useConnectionStore()
  const activeConnection = getActiveConnection()
  const dbType = activeConnection?.type || 'mongodb'

  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [interval, setInterval_] = useState(10000)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isSupported = dbType === 'mongodb' || dbType === 'postgresql'

  const fetchStats = useCallback(async () => {
    if (!activeConnectionId || !isSupported) return
    setLoading(true)
    try {
      const result = await databaseService.getServerStats(activeConnectionId, dbType)
      if (result.success) {
        setStats(result.stats)
        setError(null)
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
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <WifiOff className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Connect to a database to view server monitoring</p>
        </div>
      </div>
    )
  }

  if (!isSupported) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Server monitoring is not available for {dbType}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Supported: MongoDB, PostgreSQL</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card/50">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-green-400" />
          <h2 className="text-sm font-semibold">Server Monitoring</h2>
          <DatabaseIcon type={dbType} className="h-3.5 w-3.5" />
          <span className="text-[10px] text-muted-foreground">{activeConnection?.name}</span>
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && <span className="text-[10px] text-muted-foreground">Last: {lastRefresh.toLocaleTimeString()}</span>}
          <div className="flex items-center gap-0.5 border rounded-md overflow-hidden">
            {INTERVALS.map(i => (
              <button key={i.value} onClick={() => setInterval_(i.value)}
                className={`px-2 py-1 text-[10px] font-medium transition-colors ${interval === i.value ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
                {i.label}
              </button>
            ))}
          </div>
          <button onClick={fetchStats} disabled={loading} className="p-1.5 rounded-md border hover:bg-accent disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {error && <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs">{error}</div>}
        {stats && dbType === 'mongodb' && <MongoStats stats={stats} />}
        {stats && dbType === 'postgresql' && <PgStats stats={stats} />}
        {!stats && !error && <div className="text-center text-sm text-muted-foreground py-10">Loading server stats...</div>}
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
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Server Info</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatCard icon={Server} label="Host" value={stats.host || 'N/A'} color="text-blue-400" />
          <StatCard icon={Database} label="Version" value={stats.version || 'N/A'} color="text-purple-400" />
          <StatCard icon={Clock} label="Uptime" value={formatUptime(stats.uptime || 0)} color="text-green-400" />
          <StatCard icon={HardDrive} label="Storage Engine" value={stats.storageEngine || 'N/A'} color="text-orange-400" />
        </div>
      </div>

      {/* Connections */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Connections</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatCard icon={Wifi} label="Current" value={formatNumber(conn.current || 0)} sub={`of ${formatNumber(conn.available || 0)} available`} color="text-green-400" />
          <StatCard icon={Wifi} label="Total Created" value={formatNumber(conn.totalCreated || 0)} color="text-blue-400" />
          <StatCard icon={Gauge} label="Active" value={formatNumber(conn.active || 0)} color="text-yellow-400" />
          <StatCard icon={Gauge} label="Available" value={formatNumber(conn.available || 0)} color="text-cyan-400" />
        </div>
      </div>

      {/* Operations */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Operations (Total)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
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
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Memory</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatCard icon={Cpu} label="Resident" value={`${mem.resident || 0} MB`} color="text-orange-400" />
          <StatCard icon={Cpu} label="Virtual" value={`${mem.virtual || 0} MB`} color="text-purple-400" />
          <StatCard icon={Cpu} label="Mapped" value={`${mem.mapped || 0} MB`} color="text-blue-400" />
        </div>
      </div>

      {/* Network */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Network</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <StatCard icon={ArrowUpDown} label="Bytes In" value={formatBytes(net.bytesIn || 0)} color="text-green-400" />
          <StatCard icon={ArrowUpDown} label="Bytes Out" value={formatBytes(net.bytesOut || 0)} color="text-blue-400" />
          <StatCard icon={ArrowUpDown} label="Requests" value={formatNumber(net.numRequests || 0)} color="text-yellow-400" />
        </div>
      </div>

      {/* Replication */}
      {stats.repl && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Replication</h3>
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
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Server Info</h3>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[11px] text-muted-foreground break-all">{stats.version || 'N/A'}</p>
        </div>
      </div>

      {/* Database Size & Connections */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatCard icon={HardDrive} label="Database Size" value={formatBytes(stats.database_size || 0)} color="text-orange-400" />
          <StatCard icon={Wifi} label="Total Connections" value={stats.total_connections || 0} color="text-green-400" />
          <StatCard icon={Gauge} label="Cache Hit Ratio" value={`${hitRatio}%`} sub={`${formatNumber(blocks.hit)} hits / ${formatNumber(blocks.read)} reads`} color="text-cyan-400" />
        </div>
      </div>

      {/* Connections by State */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Connections by State</h3>
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
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Transactions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <StatCard icon={ArrowUpDown} label="Committed" value={formatNumber(txn.committed || 0)} color="text-green-400" />
          <StatCard icon={ArrowUpDown} label="Rolled Back" value={formatNumber(txn.rolledBack || 0)} color="text-red-400" />
        </div>
      </div>

      {/* Tuple Operations */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tuple Operations (Total)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
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
