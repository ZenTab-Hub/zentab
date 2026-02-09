import { useState } from 'react'
import { Edit, Trash2, Copy, ChevronDown, ChevronRight, ArrowUp, ArrowDown, ChevronsUpDown, Search } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { formatJSON } from '@/utils/formatters'
import { useToast } from '@/components/common/Toast'

interface DocumentTableProps {
  documents: any[]
  onEdit: (document: any) => void
  onDelete: (document: any) => void
  onSort?: (field: string, direction: 1 | -1) => void
  sortField?: string
  sortDirection?: 1 | -1
}

export const DocumentTable = ({ documents, onEdit, onDelete, onSort, sortField, sortDirection }: DocumentTableProps) => {
  const tt = useToast()
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [filteringColumn, setFilteringColumn] = useState<string | null>(null)

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">No documents found</p>
      </div>
    )
  }

  const allKeys = Array.from(new Set(documents.flatMap((doc) => Object.keys(doc))))

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') {
      if (value.$oid) return value.$oid
      if (value.buffer && typeof value.buffer === 'object') {
        const bufferArray = Object.values(value.buffer) as number[]
        return bufferArray.map(b => b.toString(16).padStart(2, '0')).join('')
      }
      if (value instanceof Date) return value.toISOString()
      if (Array.isArray(value)) return `[${value.length} items]`
      const str = JSON.stringify(value)
      return str.length > 50 ? str.slice(0, 47) + '...' : str
    }
    return String(value)
  }

  const getRowKey = (doc: any, index: number): string => {
    if (doc._id) {
      if (typeof doc._id === 'object' && doc._id.$oid) return doc._id.$oid
      if (typeof doc._id === 'object' && doc._id.buffer) {
        const bufferArray = Object.values(doc._id.buffer) as number[]
        return bufferArray.map(b => b.toString(16).padStart(2, '0')).join('')
      }
      return String(doc._id)
    }
    return `row-${index}`
  }

  // Filter documents by column filters (client-side)
  const hasFilters = Object.values(columnFilters).some(v => v.trim())
  const filteredDocs = hasFilters ? documents.filter(doc =>
    Object.entries(columnFilters).every(([key, filterVal]) => {
      if (!filterVal.trim()) return true
      return formatValue(doc[key]).toLowerCase().includes(filterVal.toLowerCase())
    })
  ) : documents

  const toggleRow = (key: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(key)) newExpanded.delete(key)
    else newExpanded.add(key)
    setExpandedRows(newExpanded)
  }

  const handleSort = (key: string) => {
    if (!onSort) return
    if (sortField === key) {
      onSort(key, sortDirection === 1 ? -1 : 1)
    } else {
      onSort(key, 1)
    }
  }

  const copyToClipboard = (doc: any) => {
    navigator.clipboard.writeText(formatJSON(doc))
    tt.success('Copied to clipboard!')
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-8" />
              {allKeys.map((key) => (
                <th key={key} className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleSort(key)} className="flex items-center gap-0.5 hover:text-foreground transition-colors cursor-pointer select-none">
                      <span>{key}</span>
                      {sortField === key ? (
                        sortDirection === 1 ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </button>
                    <button onClick={() => setFilteringColumn(filteringColumn === key ? null : key)} className={`p-0.5 rounded hover:bg-accent ${columnFilters[key] ? 'text-primary' : 'opacity-30 hover:opacity-70'}`}>
                      <Search className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  {filteringColumn === key && (
                    <input
                      autoFocus
                      placeholder={`Filter ${key}...`}
                      value={columnFilters[key] || ''}
                      onChange={e => setColumnFilters(prev => ({ ...prev, [key]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Escape') setFilteringColumn(null) }}
                      className="mt-1 w-full px-1.5 py-0.5 text-[10px] bg-background border rounded outline-none focus:border-primary"
                    />
                  )}
                </th>
              ))}
              <th className="px-2 py-2 text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-24 sticky right-0 z-10 bg-muted/50 shadow-[-2px_0_4px_rgba(0,0,0,0.08)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredDocs.map((doc, index) => {
              const rowKey = getRowKey(doc, index)
              const isExpanded = expandedRows.has(rowKey)
              return (
                <tr key={rowKey} className={`group/row hover:bg-muted/30 ${isExpanded ? 'bg-muted/10' : ''}`}>
                  <td className="px-2 py-1.5">
                    <button onClick={() => toggleRow(rowKey)} className="text-muted-foreground hover:text-primary">
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                  {allKeys.map((key) => (
                    <td key={key} className="px-2 py-1.5 text-[11px] font-mono max-w-[200px] truncate" title={formatValue(doc[key])}>
                      {formatValue(doc[key])}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right sticky right-0 z-10 bg-card shadow-[-2px_0_4px_rgba(0,0,0,0.08)] group-hover/row:bg-muted/30">
                    <div className="flex gap-0.5 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(doc)} className="h-6 w-6"><Copy className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => onEdit(doc)} className="h-6 w-6"><Edit className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(doc)} className="h-6 w-6"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {/* Expanded row details rendered separately */}
            {filteredDocs.map((doc, index) => {
              const rowKey = getRowKey(doc, index)
              if (!expandedRows.has(rowKey)) return null
              return (
                <tr key={`${rowKey}-expanded`}>
                  <td colSpan={allKeys.length + 2} className="px-4 py-2 bg-muted/20">
                    <pre className="overflow-x-auto text-[10px]">{formatJSON(doc)}</pre>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {hasFilters && (
        <div className="px-3 py-1.5 border-t bg-muted/30 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Showing {filteredDocs.length} of {documents.length} (filtered)</span>
          <button onClick={() => { setColumnFilters({}); setFilteringColumn(null) }} className="text-[10px] text-primary hover:underline">Clear filters</button>
        </div>
      )}
    </div>
  )
}

