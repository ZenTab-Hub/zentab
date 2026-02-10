import { useState, useEffect, useCallback } from 'react'
import {
  Layers, RefreshCw, Table, Users, Puzzle, Wrench, Activity,
  XCircle, StopCircle, ChevronDown, ChevronRight, HardDrive,
  Shield, ShieldCheck, ShieldAlert, Check,
} from 'lucide-react'
import { useConnectionStore } from '@/store/connectionStore'
import { postgresqlService } from '@/services/postgresql.service'
import { useToast } from '@/components/common/Toast'
import { cn } from '@/utils/cn'

type Tab = 'inspector' | 'queries' | 'roles' | 'extensions' | 'maintenance'

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
        {tab === 'inspector' && <TableInspectorTab connectionId={activeConnectionId} database={selectedDatabase || ''} toast={tt} />}
        {tab === 'queries' && <ActiveQueriesTab connectionId={activeConnectionId} toast={tt} />}
        {tab === 'roles' && <RolesTab connectionId={activeConnectionId} toast={tt} />}
        {tab === 'extensions' && <ExtensionsTab connectionId={activeConnectionId} toast={tt} />}
        {tab === 'maintenance' && <MaintenanceTab connectionId={activeConnectionId} database={selectedDatabase || ''} toast={tt} />}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB 1: Table Inspector
   ═══════════════════════════════════════════════════════════ */
interface TabProps { connectionId: string; database?: string; toast: any }

const TableInspectorTab = ({ connectionId, database, toast }: TabProps) => {
  const [tables, setTables] = useState<any[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [schema, setSchema] = useState<any[]>([])
  const [details, setDetails] = useState<any>(null)
  const [indexes, setIndexes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['columns', 'constraints', 'indexes']))

  useEffect(() => { loadTables() }, [connectionId])

  const loadTables = async () => {
    try {
      const res = await postgresqlService.listTables(connectionId, database || '')
      if (res.success) setTables(res.collections || [])
    } catch { /* ignore */ }
  }

  const selectTable = async (name: string) => {
    setSelectedTable(name)
    setLoading(true)
    try {
      const [schemaRes, detailsRes, indexRes] = await Promise.all([
        postgresqlService.getTableSchema(connectionId, database || '', name),
        postgresqlService.getTableDetails(connectionId, database || '', name),
        postgresqlService.listIndexes(connectionId, database || '', name),
      ])
      if (schemaRes.success) setSchema(schemaRes.columns || [])
      if (detailsRes.success) setDetails(detailsRes)
      if (indexRes.success) setIndexes(indexRes.indexes || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally { setLoading(false) }
  }

  const toggleSection = (s: string) => {
    const next = new Set(expandedSections)
    next.has(s) ? next.delete(s) : next.add(s)
    setExpandedSections(next)
  }

  const constraintTypeLabel: Record<string, string> = { p: 'PRIMARY KEY', u: 'UNIQUE', c: 'CHECK', f: 'FOREIGN KEY', x: 'EXCLUSION' }

  return (
    <div className="flex gap-4 h-full">
      {/* Table list */}
      <div className="w-56 shrink-0 border rounded-lg bg-card overflow-auto">
        <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
          <span className="text-xs font-semibold">Tables</span>
          <button onClick={loadTables} className="p-1 rounded hover:bg-accent"><RefreshCw className="h-3 w-3" /></button>
        </div>
        <div className="p-1">
          {tables.map((t) => (
            <button key={t.name} onClick={() => selectTable(t.name)}
              className={cn('w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors',
                selectedTable === t.name ? 'bg-primary/15 text-primary' : 'hover:bg-accent text-foreground')}>
              <Table className="h-3 w-3 shrink-0 text-blue-400/70" />
              <span className="truncate">{t.name}</span>
            </button>
          ))}
          {tables.length === 0 && <p className="text-xs text-muted-foreground p-2">No tables found</p>}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 min-w-0 space-y-3 overflow-auto">
        {!selectedTable && <p className="text-sm text-muted-foreground">Select a table to inspect</p>}
        {loading && <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>}
        {selectedTable && !loading && (
          <>
            {/* Size info */}
            {details?.size && (
              <div className="flex gap-4 text-xs">
                <span className="text-muted-foreground">Total: <span className="text-foreground font-medium">{details.size.total_size}</span></span>
                <span className="text-muted-foreground">Data: <span className="text-foreground font-medium">{details.size.table_size}</span></span>
                <span className="text-muted-foreground">Indexes: <span className="text-foreground font-medium">{details.size.indexes_size}</span></span>
              </div>
            )}

            {/* Columns */}
            <CollapsibleSection title={`Columns (${schema.length})`} id="columns" expanded={expandedSections} toggle={toggleSection}>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left py-1.5 px-2 font-medium">Name</th>
                  <th className="text-left py-1.5 px-2 font-medium">Type</th>
                  <th className="text-left py-1.5 px-2 font-medium">Nullable</th>
                  <th className="text-left py-1.5 px-2 font-medium">Default</th>
                </tr></thead>
                <tbody>
                  {schema.map((col: any) => (
                    <tr key={col.column_name} className="border-b border-border/30 hover:bg-accent/50">
                      <td className="py-1.5 px-2 font-mono">{col.column_name}</td>
                      <td className="py-1.5 px-2 text-blue-400">{col.data_type}{col.character_maximum_length ? `(${col.character_maximum_length})` : ''}</td>
                      <td className="py-1.5 px-2">{col.is_nullable === 'YES' ? <span className="text-yellow-400">YES</span> : <span className="text-emerald-400">NO</span>}</td>
                      <td className="py-1.5 px-2 text-muted-foreground font-mono truncate max-w-[200px]">{col.column_default || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CollapsibleSection>

            {/* Constraints */}
            <CollapsibleSection title={`Constraints (${details?.constraints?.length || 0})`} id="constraints" expanded={expandedSections} toggle={toggleSection}>
              {details?.constraints?.length > 0 ? (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left py-1.5 px-2 font-medium">Name</th>
                    <th className="text-left py-1.5 px-2 font-medium">Type</th>
                    <th className="text-left py-1.5 px-2 font-medium">Definition</th>
                  </tr></thead>
                  <tbody>
                    {details.constraints.map((c: any) => (
                      <tr key={c.name} className="border-b border-border/30 hover:bg-accent/50">
                        <td className="py-1.5 px-2 font-mono">{c.name}</td>
                        <td className="py-1.5 px-2"><span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">{constraintTypeLabel[c.type] || c.type}</span></td>
                        <td className="py-1.5 px-2 font-mono text-muted-foreground truncate max-w-[400px]">{c.definition}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-xs text-muted-foreground p-2">No constraints</p>}
            </CollapsibleSection>

            {/* Foreign Keys */}
            {details?.foreignKeys?.length > 0 && (
              <CollapsibleSection title={`Foreign Keys (${details.foreignKeys.length})`} id="fk" expanded={expandedSections} toggle={toggleSection}>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left py-1.5 px-2 font-medium">Column</th>
                    <th className="text-left py-1.5 px-2 font-medium">→ Table.Column</th>
                    <th className="text-left py-1.5 px-2 font-medium">On Update</th>
                    <th className="text-left py-1.5 px-2 font-medium">On Delete</th>
                  </tr></thead>
                  <tbody>
                    {details.foreignKeys.map((fk: any, i: number) => (
                      <tr key={i} className="border-b border-border/30 hover:bg-accent/50">
                        <td className="py-1.5 px-2 font-mono">{fk.column_name}</td>
                        <td className="py-1.5 px-2 font-mono text-blue-400">{fk.foreign_table}.{fk.foreign_column}</td>
                        <td className="py-1.5 px-2">{fk.update_rule}</td>
                        <td className="py-1.5 px-2">{fk.delete_rule}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CollapsibleSection>
            )}

            {/* Indexes */}
            <CollapsibleSection title={`Indexes (${indexes.length})`} id="indexes" expanded={expandedSections} toggle={toggleSection}>
              {indexes.length > 0 ? (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left py-1.5 px-2 font-medium">Name</th>
                    <th className="text-left py-1.5 px-2 font-medium">Size</th>
                    <th className="text-left py-1.5 px-2 font-medium">Definition</th>
                  </tr></thead>
                  <tbody>
                    {indexes.map((idx: any) => (
                      <tr key={idx.name} className="border-b border-border/30 hover:bg-accent/50">
                        <td className="py-1.5 px-2 font-mono">{idx.name}</td>
                        <td className="py-1.5 px-2">{idx.size || '—'}</td>
                        <td className="py-1.5 px-2 font-mono text-muted-foreground truncate max-w-[500px]">{idx.definition}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-xs text-muted-foreground p-2">No indexes</p>}
            </CollapsibleSection>

            {/* Triggers */}
            {details?.triggers?.length > 0 && (
              <CollapsibleSection title={`Triggers (${details.triggers.length})`} id="triggers" expanded={expandedSections} toggle={toggleSection}>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left py-1.5 px-2 font-medium">Name</th>
                    <th className="text-left py-1.5 px-2 font-medium">Event</th>
                    <th className="text-left py-1.5 px-2 font-medium">Timing</th>
                    <th className="text-left py-1.5 px-2 font-medium">Action</th>
                  </tr></thead>
                  <tbody>
                    {details.triggers.map((tr: any, i: number) => (
                      <tr key={i} className="border-b border-border/30 hover:bg-accent/50">
                        <td className="py-1.5 px-2 font-mono">{tr.trigger_name}</td>
                        <td className="py-1.5 px-2">{tr.event_manipulation}</td>
                        <td className="py-1.5 px-2">{tr.action_timing}</td>
                        <td className="py-1.5 px-2 font-mono text-muted-foreground truncate max-w-[300px]">{tr.action_statement}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CollapsibleSection>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ── Collapsible Section helper ──────────────────────── */
const CollapsibleSection = ({ title, id, expanded, toggle, children }: {
  title: string; id: string; expanded: Set<string>; toggle: (s: string) => void; children: React.ReactNode
}) => (
  <div className="border rounded-lg bg-card overflow-hidden">
    <button onClick={() => toggle(id)} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-accent/50 transition-colors">
      {expanded.has(id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      {title}
    </button>
    {expanded.has(id) && <div className="border-t border-border/50">{children}</div>}
  </div>
)

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

/* ═══════════════════════════════════════════════════════════
   TAB 5: Maintenance
   ═══════════════════════════════════════════════════════════ */
const MaintenanceTab = ({ connectionId, database, toast }: TabProps) => {
  const [tables, setTables] = useState<any[]>([])
  const [tableSizes, setTableSizes] = useState<any[]>([])
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [running, setRunning] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tablesRes, sizesRes] = await Promise.all([
        postgresqlService.listTables(connectionId, database || ''),
        postgresqlService.getTableSizes(connectionId),
      ])
      if (tablesRes.success) {
        const list = tablesRes.collections || []
        setTables(list)
        if (list.length > 0 && !selectedTable) setSelectedTable(list[0].name)
      }
      if (sizesRes.success) setTableSizes(sizesRes.tables || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [connectionId, database, selectedTable])

  useEffect(() => { load() }, [load])

  const runAction = async (action: string, label: string) => {
    if (!selectedTable) return
    setRunning(action)
    try {
      const res = await postgresqlService.runMaintenance(connectionId, database || '', selectedTable, action)
      if (res.success) {
        toast.success(`${label} completed on "${selectedTable}"`)
        load() // refresh sizes
      } else {
        toast.error(res.error || `${label} failed`)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally { setRunning(null) }
  }

  const actions = [
    { id: 'vacuum', label: 'VACUUM', desc: 'Reclaim storage from dead tuples', icon: HardDrive },
    { id: 'analyze', label: 'ANALYZE', desc: 'Update table statistics for query planner', icon: Activity },
    { id: 'vacuum_analyze', label: 'VACUUM ANALYZE', desc: 'Reclaim storage + update statistics', icon: HardDrive },
    { id: 'reindex', label: 'REINDEX', desc: 'Rebuild all indexes on the table', icon: RefreshCw },
  ]

  return (
    <div className="space-y-4">
      {/* Table selector + actions */}
      <div className="flex items-center gap-3">
        <select
          value={selectedTable}
          onChange={(e) => setSelectedTable(e.target.value)}
          className="px-3 py-1.5 rounded-md text-xs bg-accent border border-border/50 min-w-[200px]"
        >
          {tables.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-accent hover:bg-accent/80 transition-colors">
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 max-w-2xl">
        {actions.map((a) => (
          <button
            key={a.id}
            onClick={() => runAction(a.id, a.label)}
            disabled={!selectedTable || running !== null}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left',
              running === a.id && 'opacity-70 animate-pulse'
            )}
          >
            <a.icon className="h-5 w-5 text-primary shrink-0" />
            <div>
              <div className="text-xs font-semibold">{a.label}</div>
              <div className="text-[10px] text-muted-foreground">{a.desc}</div>
            </div>
            {running === a.id && <RefreshCw className="h-3 w-3 animate-spin ml-auto text-primary" />}
          </button>
        ))}
      </div>

      {/* Table sizes */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5" /> Table Sizes
        </h3>
        <div className="border rounded-lg bg-card overflow-auto max-h-[calc(100vh-380px)]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card z-10"><tr className="border-b border-border/50 text-muted-foreground">
              <th className="text-left py-2 px-2 font-medium">Table</th>
              <th className="text-left py-2 px-2 font-medium">Total Size</th>
              <th className="text-left py-2 px-2 font-medium">Data Size</th>
              <th className="text-left py-2 px-2 font-medium">Indexes Size</th>
            </tr></thead>
            <tbody>
              {tableSizes.map((t) => (
                <tr key={t.tablename} className={cn('border-b border-border/30 hover:bg-accent/50', selectedTable === t.tablename && 'bg-primary/5')}>
                  <td className="py-1.5 px-2 font-mono">{t.tablename}</td>
                  <td className="py-1.5 px-2 font-medium">{t.total_size}</td>
                  <td className="py-1.5 px-2 text-muted-foreground">{t.table_size}</td>
                  <td className="py-1.5 px-2 text-muted-foreground">{t.indexes_size}</td>
                </tr>
              ))}
              {tableSizes.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No tables found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}