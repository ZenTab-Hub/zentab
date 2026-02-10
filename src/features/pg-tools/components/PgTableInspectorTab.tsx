import { useState, useEffect } from 'react'
import { RefreshCw, Table, ChevronDown, ChevronRight } from 'lucide-react'
import { postgresqlService } from '@/services/postgresql.service'
import { cn } from '@/utils/cn'
import { TableSkeleton } from '@/components/common/Skeleton'
import { NoTables } from '@/components/common/EmptyState'

export interface PgTabProps { connectionId: string; database?: string; toast: any }

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

export const PgTableInspectorTab = ({ connectionId, database, toast }: PgTabProps) => {
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
          {tables.length === 0 && <NoTables />}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 min-w-0 space-y-3 overflow-auto">
        {!selectedTable && <p className="text-sm text-muted-foreground">Select a table to inspect</p>}
        {loading && <TableSkeleton rows={6} columns={4} />}
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

