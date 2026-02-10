import { useState, useEffect, useCallback } from 'react'
import {
  Layers, RefreshCw, Table, Users, Puzzle, Wrench, Activity,
  XCircle, StopCircle, Shield, ShieldCheck, ShieldAlert, Check,
} from 'lucide-react'
import { useConnectionStore } from '@/store/connectionStore'
import { postgresqlService } from '@/services/postgresql.service'
import { useToast } from '@/components/common/Toast'
import { cn } from '@/utils/cn'
import { PgTableInspectorTab } from '../components/PgTableInspectorTab'
import { PgMaintenanceTab } from '../components/PgMaintenanceTab'

type Tab = 'inspector' | 'queries' | 'roles' | 'extensions' | 'maintenance'

interface TabProps { connectionId: string; database?: string; toast: any }

export const PgToolsPage = () => {
  const { activeConnectionId, getActiveConnection, selectedDatabase } = useConnectionStore()
  const activeConnection = getActiveConnection()
  const dbType = activeConnection?.type
  const tt = useToast()
  const [tab, setTab] = useState<Tab>('inspector')

  if (!activeConnectionId || dbType !== 'postgresql') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Connect to a PostgreSQL server to use PG Tools</p>
        </div>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'inspector', label: 'Table Inspector', icon: Table },
    { id: 'queries', label: 'Active Queries', icon: Activity },
    { id: 'roles', label: 'Roles & Users', icon: Users },
    { id: 'extensions', label: 'Extensions', icon: Puzzle },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  ]

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-1 border-b border-border/50">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              tab === t.id
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {tab === 'inspector' && <PgTableInspectorTab connectionId={activeConnectionId} database={selectedDatabase || ''} toast={tt} />}
        {tab === 'queries' && <ActiveQueriesTab connectionId={activeConnectionId} toast={tt} />}
        {tab === 'roles' && <RolesTab connectionId={activeConnectionId} toast={tt} />}
        {tab === 'extensions' && <ExtensionsTab connectionId={activeConnectionId} toast={tt} />}
        {tab === 'maintenance' && <PgMaintenanceTab connectionId={activeConnectionId} database={selectedDatabase || ''} toast={tt} />}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB 2: Active Queries
   ═══════════════════════════════════════════════════════════ */
const ActiveQueriesTab = ({ connectionId, toast }: TabProps) => {
  const [queries, setQueries] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await postgresqlService.getActiveQueries(connectionId)
      if (res.success) setQueries(res.queries || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [connectionId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!autoRefresh) return
    const iv = setInterval(load, 3000)
    return () => clearInterval(iv)
  }, [autoRefresh, load])

  const cancel = async (pid: number) => {
    const res = await postgresqlService.cancelQuery(connectionId, pid)
    if (res.success) { toast.success('Query cancelled'); load() }
    else toast.error(res.error)
  }

  const terminate = async (pid: number) => {
    const res = await postgresqlService.terminateBackend(connectionId, pid)
    if (res.success) { toast.success('Backend terminated'); load() }
    else toast.error(res.error)
  }

  const stateColor: Record<string, string> = {
    active: 'text-emerald-400', idle: 'text-muted-foreground', 'idle in transaction': 'text-yellow-400',
    'idle in transaction (aborted)': 'text-red-400', disabled: 'text-red-400',
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-accent hover:bg-accent/80 transition-colors">
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} /> Refresh
        </button>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded" />
          Auto-refresh (3s)
        </label>
        <span className="text-xs text-muted-foreground ml-auto">{queries.length} processes</span>
      </div>

      <div className="border rounded-lg bg-card overflow-auto max-h-[calc(100vh-200px)]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card z-10"><tr className="border-b border-border/50 text-muted-foreground">
            <th className="text-left py-2 px-2 font-medium">PID</th>
            <th className="text-left py-2 px-2 font-medium">User</th>
            <th className="text-left py-2 px-2 font-medium">Database</th>
            <th className="text-left py-2 px-2 font-medium">State</th>
            <th className="text-left py-2 px-2 font-medium">Duration</th>
            <th className="text-left py-2 px-2 font-medium">Query</th>
            <th className="text-left py-2 px-2 font-medium">Actions</th>
          </tr></thead>
          <tbody>
            {queries.map((q) => (
              <tr key={q.pid} className="border-b border-border/30 hover:bg-accent/50">
                <td className="py-1.5 px-2 font-mono">{q.pid}</td>
                <td className="py-1.5 px-2">{q.usename}</td>
                <td className="py-1.5 px-2">{q.datname}</td>
                <td className={cn('py-1.5 px-2 font-medium', stateColor[q.state] || '')}>{q.state || '—'}</td>
                <td className="py-1.5 px-2 font-mono">{q.duration_sec != null ? `${q.duration_sec}s` : '—'}</td>
                <td className="py-1.5 px-2 font-mono text-muted-foreground max-w-[400px] truncate" title={q.query}>{q.query || '—'}</td>
                <td className="py-1.5 px-2">
                  {q.state === 'active' && (
                    <div className="flex gap-1">
                      <button onClick={() => cancel(q.pid)} title="Cancel query" className="p-1 rounded hover:bg-yellow-500/20 text-yellow-400"><XCircle className="h-3.5 w-3.5" /></button>
                      <button onClick={() => terminate(q.pid)} title="Terminate backend" className="p-1 rounded hover:bg-red-500/20 text-red-400"><StopCircle className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {queries.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">No active queries</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════
   TAB 3: Roles & Users
   ═══════════════════════════════════════════════════════════ */
const RolesTab = ({ connectionId, toast }: TabProps) => {
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await postgresqlService.listRoles(connectionId)
      if (res.success) setRoles(res.roles || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [connectionId])

  useEffect(() => { load() }, [load])

  const BoolBadge = ({ value, label }: { value: boolean; label: string }) => (
    <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium',
      value ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground')}>
      {value ? <Check className="h-2.5 w-2.5" /> : null} {label}
    </span>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-accent hover:bg-accent/80 transition-colors">
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} /> Refresh
        </button>
        <span className="text-xs text-muted-foreground ml-auto">{roles.length} roles</span>
      </div>

      <div className="border rounded-lg bg-card overflow-auto max-h-[calc(100vh-200px)]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card z-10"><tr className="border-b border-border/50 text-muted-foreground">
            <th className="text-left py-2 px-2 font-medium">Role</th>
            <th className="text-left py-2 px-2 font-medium">Attributes</th>
            <th className="text-left py-2 px-2 font-medium">Member Of</th>
            <th className="text-left py-2 px-2 font-medium">Conn Limit</th>
          </tr></thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.rolname} className="border-b border-border/30 hover:bg-accent/50">
                <td className="py-1.5 px-2 font-mono flex items-center gap-1.5">
                  {r.rolsuper ? <ShieldAlert className="h-3 w-3 text-red-400" /> : r.rolcanlogin ? <ShieldCheck className="h-3 w-3 text-emerald-400" /> : <Shield className="h-3 w-3 text-muted-foreground" />}
                  {r.rolname}
                </td>
                <td className="py-1.5 px-2">
                  <div className="flex flex-wrap gap-1">
                    {r.rolsuper && <BoolBadge value={true} label="SUPERUSER" />}
                    {r.rolcanlogin && <BoolBadge value={true} label="LOGIN" />}
                    {r.rolcreatedb && <BoolBadge value={true} label="CREATEDB" />}
                    {r.rolcreaterole && <BoolBadge value={true} label="CREATEROLE" />}
                    {r.rolreplication && <BoolBadge value={true} label="REPLICATION" />}
                  </div>
                </td>
                <td className="py-1.5 px-2 text-muted-foreground">{r.member_of?.length > 0 ? r.member_of.join(', ') : '—'}</td>
                <td className="py-1.5 px-2">{r.rolconnlimit === -1 ? 'unlimited' : r.rolconnlimit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB 4: Extensions
   ═══════════════════════════════════════════════════════════ */
const ExtensionsTab = ({ connectionId, toast }: TabProps) => {
  const [extensions, setExtensions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await postgresqlService.listExtensions(connectionId)
      if (res.success) setExtensions(res.extensions || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [connectionId])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-accent hover:bg-accent/80 transition-colors">
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} /> Refresh
        </button>
        <span className="text-xs text-muted-foreground ml-auto">{extensions.length} extensions</span>
      </div>

      <div className="border rounded-lg bg-card overflow-auto max-h-[calc(100vh-200px)]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card z-10"><tr className="border-b border-border/50 text-muted-foreground">
            <th className="text-left py-2 px-2 font-medium">Name</th>
            <th className="text-left py-2 px-2 font-medium">Version</th>
            <th className="text-left py-2 px-2 font-medium">Schema</th>
            <th className="text-left py-2 px-2 font-medium">Description</th>
          </tr></thead>
          <tbody>
            {extensions.map((ext) => (
              <tr key={ext.name} className="border-b border-border/30 hover:bg-accent/50">
                <td className="py-1.5 px-2 font-mono flex items-center gap-1.5">
                  <Puzzle className="h-3 w-3 text-purple-400 shrink-0" />
                  {ext.name}
                </td>
                <td className="py-1.5 px-2"><span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">{ext.version}</span></td>
                <td className="py-1.5 px-2 text-muted-foreground">{ext.schema || '—'}</td>
                <td className="py-1.5 px-2 text-muted-foreground max-w-[400px] truncate">{ext.description || '—'}</td>
              </tr>
            ))}
            {extensions.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No extensions installed</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

