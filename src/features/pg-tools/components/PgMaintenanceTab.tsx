import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, HardDrive, Activity } from 'lucide-react'
import { postgresqlService } from '@/services/postgresql.service'
import { cn } from '@/utils/cn'
import type { PgTabProps } from './PgTableInspectorTab'

export const PgMaintenanceTab = ({ connectionId, database, toast }: PgTabProps) => {
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
        load()
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

