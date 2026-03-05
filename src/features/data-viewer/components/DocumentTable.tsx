import React, { useState, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Edit, Trash2, Copy, ChevronDown, ChevronRight, ArrowUp, ArrowDown, ChevronsUpDown, Search, Clock, Hash, Type, ToggleLeft, List, Braces } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { formatJSON } from '@/utils/formatters'
import { useToast } from '@/components/common/Toast'
import { NoDocuments } from '@/components/common/EmptyState'

interface DocumentTableProps {
  documents: any[]
  onEdit: (document: any) => void
  onDelete: (document: any) => void
  onSort?: (field: string, direction: 1 | -1) => void
  sortField?: string
  sortDirection?: 1 | -1
  selectedDocs?: Set<string>
  onToggleSelect?: (rowKey: string, doc: any) => void
}

const ROW_HEIGHT = 36
const EXPANDED_ROW_HEIGHT = 280
const VIRTUALIZATION_THRESHOLD = 100

/** Try to parse a value as a date. Returns formatted string or null. */
const tryParseDate = (value: any): string | null => {
  // MongoDB $date format
  if (typeof value === 'object' && value !== null) {
    if (value.$date) {
      const d = new Date(typeof value.$date === 'string' ? value.$date : value.$date.$numberLong ? Number(value.$date.$numberLong) : value.$date)
      if (!isNaN(d.getTime())) return d.toLocaleString()
    }
    if (value instanceof Date && !isNaN(value.getTime())) return value.toLocaleString()
  }
  if (typeof value === 'string') {
    // ISO date strings
    if (/^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}/.test(value)) {
      const d = new Date(value)
      if (!isNaN(d.getTime())) return d.toLocaleString()
    }
    // Date-only strings
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(value + 'T00:00:00')
      if (!isNaN(d.getTime())) return d.toLocaleDateString()
    }
  }
  // Unix timestamps (seconds or milliseconds)
  if (typeof value === 'number' && value > 1e9 && value < 1e15) {
    const ts = value > 1e12 ? value : value * 1000
    const d = new Date(ts)
    if (!isNaN(d.getTime())) return d.toLocaleString()
  }
  return null
}

/** Color-coded value rendering for quick scanning */
const ValueCell = ({ value }: { value: any }) => {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/40 italic">null</span>
  }
  if (typeof value === 'boolean') {
    return <span className={value ? 'text-emerald-400' : 'text-orange-400'}>{String(value)}</span>
  }

  // Check date before number (epoch timestamps are numbers)
  const dateStr = tryParseDate(value)
  if (dateStr) {
    return <span className="text-amber-400" title={typeof value === 'object' ? JSON.stringify(value) : String(value)}>{dateStr}</span>
  }

  if (typeof value === 'number') {
    return <span className="text-sky-400">{value.toLocaleString()}</span>
  }
  if (typeof value === 'object') {
    if (value.$oid) return <span className="text-muted-foreground/70 font-mono text-[10px]">{value.$oid}</span>
    if (value.buffer && typeof value.buffer === 'object') {
      const bufferArray = Object.values(value.buffer) as number[]
      return <span className="text-muted-foreground/70 font-mono text-[10px]">{bufferArray.map(b => b.toString(16).padStart(2, '0')).join('')}</span>
    }
    if (Array.isArray(value)) {
      return <span className="text-violet-400">[{value.length} items]</span>
    }
    const str = JSON.stringify(value)
    return <span className="text-violet-400">{str.length > 60 ? str.slice(0, 57) + '...' : str}</span>
  }
  const str = String(value)
  return <span>{str.length > 80 ? str.slice(0, 77) + '...' : str}</span>
}

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return ''
  const dateStr = tryParseDate(value)
  if (dateStr) return dateStr
  if (typeof value === 'object') {
    if (value.$oid) return value.$oid
    if (value.buffer && typeof value.buffer === 'object') {
      const bufferArray = Object.values(value.buffer) as number[]
      return bufferArray.map(b => b.toString(16).padStart(2, '0')).join('')
    }
    if (Array.isArray(value)) return `[${value.length} items]`
    const str = JSON.stringify(value)
    return str.length > 60 ? str.slice(0, 57) + '...' : str
  }
  return String(value)
}

/** Get type icon and label for a value */
const getTypeInfo = (value: any): { icon: React.ReactNode; label: string; color: string } => {
  if (value === null || value === undefined) return { icon: null, label: 'null', color: 'text-muted-foreground/40' }
  if (typeof value === 'boolean') return { icon: <ToggleLeft className="h-3 w-3" />, label: 'boolean', color: 'text-orange-400' }
  if (tryParseDate(value)) return { icon: <Clock className="h-3 w-3" />, label: 'date', color: 'text-amber-400' }
  if (typeof value === 'number') return { icon: <Hash className="h-3 w-3" />, label: 'number', color: 'text-sky-400' }
  if (typeof value === 'string') return { icon: <Type className="h-3 w-3" />, label: 'string', color: 'text-foreground' }
  if (Array.isArray(value)) return { icon: <List className="h-3 w-3" />, label: `array[${value.length}]`, color: 'text-violet-400' }
  if (typeof value === 'object') return { icon: <Braces className="h-3 w-3" />, label: 'object', color: 'text-violet-400' }
  return { icon: null, label: typeof value, color: 'text-foreground' }
}

/** Expanded document detail view - key/value pairs with types */
const DocumentDetail = ({ doc, onCopy }: { doc: any; onCopy: (doc: any) => void }) => {
  const [showRaw, setShowRaw] = useState(false)
  const keys = Object.keys(doc)

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRaw(false)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${!showRaw ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Fields
          </button>
          <button
            onClick={() => setShowRaw(true)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${showRaw ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Raw JSON
          </button>
        </div>
        <button onClick={() => onCopy(doc)} className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
          <Copy className="h-3 w-3" /> Copy
        </button>
      </div>

      {showRaw ? (
        <pre className="overflow-auto text-[11px] leading-relaxed font-mono max-h-[220px] bg-background/50 rounded p-2 border border-border/50">
          {formatJSON(doc)}
        </pre>
      ) : (
        <div className="grid grid-cols-1 gap-px max-h-[220px] overflow-y-auto">
          {keys.map((key) => {
            const value = doc[key]
            const typeInfo = getTypeInfo(value)
            const dateStr = tryParseDate(value)
            return (
              <div key={key} className="flex items-start gap-3 py-1.5 px-2 rounded hover:bg-background/50 group/field">
                {/* Field name */}
                <div className="w-[140px] shrink-0 flex items-center gap-1.5">
                  <span className={`${typeInfo.color} shrink-0`}>{typeInfo.icon}</span>
                  <span className="text-[11px] font-semibold text-foreground/80 truncate" title={key}>{key}</span>
                  <span className="text-[9px] text-muted-foreground/50 shrink-0">{typeInfo.label}</span>
                </div>
                {/* Field value */}
                <div className="flex-1 min-w-0 text-xs font-mono break-all">
                  {value === null || value === undefined ? (
                    <span className="text-muted-foreground/40 italic">null</span>
                  ) : dateStr ? (
                    <span className="text-amber-400">{dateStr}</span>
                  ) : typeof value === 'boolean' ? (
                    <span className={value ? 'text-emerald-400' : 'text-orange-400'}>{String(value)}</span>
                  ) : typeof value === 'number' ? (
                    <span className="text-sky-400">{value.toLocaleString()}</span>
                  ) : typeof value === 'object' ? (
                    <span className="text-violet-400 text-[10px]">{JSON.stringify(value, null, 1).slice(0, 300)}</span>
                  ) : (
                    <span className="text-foreground/90">{String(value)}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export const DocumentTable = ({ documents, onEdit, onDelete, onSort, sortField, sortDirection, selectedDocs, onToggleSelect }: DocumentTableProps) => {
  const tt = useToast()
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [filteringColumn, setFilteringColumn] = useState<string | null>(null)

  if (documents.length === 0) {
    return <NoDocuments />
  }

  const allKeys = Array.from(new Set(documents.flatMap((doc) => Object.keys(doc))))

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

  const useVirtual = filteredDocs.length > VIRTUALIZATION_THRESHOLD

  const renderTableHeader = () => (
    <thead className="bg-muted/40 sticky top-0 z-20">
      <tr className="border-b border-border">
        {onToggleSelect && (
          <th className="px-3 py-2.5 text-center w-10 shrink-0">
            <span className="text-[10px] text-muted-foreground">SEL</span>
          </th>
        )}
        <th className="px-2 py-2.5 w-8 shrink-0" />
        {allKeys.map((key) => (
          <th key={key} className="px-3 py-2.5 text-left whitespace-nowrap">
            <div className="flex items-center gap-1 group/col">
              <button onClick={() => handleSort(key)}
                className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer select-none group/sort">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider group-hover/sort:text-foreground">
                  {key}
                </span>
                {sortField === key ? (
                  sortDirection === 1
                    ? <ArrowUp className="h-3 w-3 text-primary" />
                    : <ArrowDown className="h-3 w-3 text-primary" />
                ) : (
                  <ChevronsUpDown className="h-3 w-3 opacity-0 group-hover/col:opacity-40 transition-opacity" />
                )}
              </button>
              <button onClick={() => setFilteringColumn(filteringColumn === key ? null : key)}
                className={`p-0.5 rounded hover:bg-accent transition-colors ${columnFilters[key] ? 'text-primary' : 'opacity-0 group-hover/col:opacity-40 hover:!opacity-100'}`}>
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
                className="mt-1 w-full px-2 py-1 text-[11px] bg-background border rounded outline-none focus:border-primary"
              />
            )}
          </th>
        ))}
        <th className="px-3 py-2.5 text-right w-24 shrink-0 sticky right-0 z-20 bg-muted/40 backdrop-blur-sm border-l border-border/50">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Actions</span>
        </th>
      </tr>
    </thead>
  )

  const renderRow = (doc: any, index: number) => {
    const rowKey = getRowKey(doc, index)
    const isExpanded = expandedRows.has(rowKey)
    const isSelected = selectedDocs?.has(rowKey)
    const isEven = index % 2 === 0
    return (
      <React.Fragment key={rowKey}>
        <tr className={`group/row border-b border-border/50 transition-colors
          ${isSelected ? 'bg-primary/10 hover:bg-primary/15' : isEven ? 'bg-transparent hover:bg-muted/30' : 'bg-muted/10 hover:bg-muted/30'}
          ${isExpanded ? '!bg-muted/20' : ''}`}
        >
          {onToggleSelect && (
            <td className="px-3 py-2 text-center w-10">
              <input type="checkbox" checked={isSelected || false} onChange={() => onToggleSelect(rowKey, doc)}
                className="h-3.5 w-3.5 rounded border-muted-foreground accent-primary cursor-pointer" />
            </td>
          )}
          <td className="px-2 py-2 w-8">
            <button onClick={() => toggleRow(rowKey)} className="text-muted-foreground hover:text-primary transition-colors">
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </td>
          {allKeys.map((key) => (
            <td key={key} className="px-3 py-2 text-xs font-mono max-w-[280px] truncate whitespace-nowrap" title={formatValue(doc[key])}>
              <ValueCell value={doc[key]} />
            </td>
          ))}
          <td className="px-3 py-2 text-right w-24 sticky right-0 z-10 bg-inherit backdrop-blur-sm border-l border-border/50">
            <div className="flex gap-0.5 justify-end opacity-0 group-hover/row:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" onClick={() => copyToClipboard(doc)} className="h-7 w-7" title="Copy"><Copy className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" onClick={() => onEdit(doc)} className="h-7 w-7" title="Edit"><Edit className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(doc)} className="h-7 w-7 hover:text-destructive" title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </td>
        </tr>
        {isExpanded && (
          <tr key={`${rowKey}-expanded`}>
            <td colSpan={allKeys.length + (onToggleSelect ? 3 : 2)} className="px-4 py-3 bg-muted/15 border-b border-border/50">
              <DocumentDetail doc={doc} onCopy={copyToClipboard} />
            </td>
          </tr>
        )}
      </React.Fragment>
    )
  }

  if (!useVirtual) {
    return (
      <div className="overflow-hidden">
        <div className="overflow-x-auto scroll-smooth" style={{ scrollbarGutter: 'stable' }}>
          <table className="w-full table-auto">
            {renderTableHeader()}
            <tbody>
              {filteredDocs.map((doc, index) => renderRow(doc, index))}
            </tbody>
          </table>
        </div>
        {hasFilters && (
          <div className="px-3 py-2 border-t bg-muted/30 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Showing {filteredDocs.length} of {documents.length} (filtered)</span>
            <button onClick={() => { setColumnFilters({}); setFilteringColumn(null) }} className="text-[11px] text-primary hover:underline">Clear filters</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <VirtualizedTableBody
      filteredDocs={filteredDocs}
      allKeys={allKeys}
      expandedRows={expandedRows}
      selectedDocs={selectedDocs}
      onToggleSelect={onToggleSelect}
      getRowKey={getRowKey}
      toggleRow={toggleRow}
      copyToClipboard={copyToClipboard}
      onEdit={onEdit}
      onDelete={onDelete}
      sortField={sortField}
      sortDirection={sortDirection}
      filteringColumn={filteringColumn}
      setFilteringColumn={setFilteringColumn}
      columnFilters={columnFilters}
      setColumnFilters={setColumnFilters}
      hasFilters={hasFilters}
      documents={documents}
      renderTableHeader={renderTableHeader}
    />
  )
}

function VirtualizedTableBody({
  filteredDocs, allKeys, expandedRows, selectedDocs, onToggleSelect,
  getRowKey, toggleRow, copyToClipboard,
  onEdit, onDelete, sortField, sortDirection, filteringColumn,
  setFilteringColumn, columnFilters, setColumnFilters, hasFilters,
  documents, renderTableHeader,
}: any) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: filteredDocs.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: useCallback((index: number) => {
      const doc = filteredDocs[index]
      const rowKey = getRowKey(doc, index)
      return expandedRows.has(rowKey) ? ROW_HEIGHT + EXPANDED_ROW_HEIGHT : ROW_HEIGHT
    }, [filteredDocs, expandedRows, getRowKey]),
    overscan: 20,
  })

  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto overflow-y-auto scroll-smooth" ref={scrollContainerRef} style={{ maxHeight: '70vh', scrollbarGutter: 'stable' }}>
        <table className="w-full table-auto">
          {renderTableHeader()}
          <tbody>
            <tr>
              <td colSpan={allKeys.length + (onToggleSelect ? 3 : 2)} style={{ padding: 0, height: rowVirtualizer.getTotalSize() }} className="relative">
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const index = virtualRow.index
                  const doc = filteredDocs[index]
                  const rowKey = getRowKey(doc, index)
                  const isExpanded = expandedRows.has(rowKey)
                  const isSelected = selectedDocs?.has(rowKey)
                  const isEven = index % 2 === 0
                  return (
                    <div
                      key={rowKey}
                      className="absolute left-0 w-full"
                      style={{ top: virtualRow.start, height: virtualRow.size }}
                    >
                      <table className="w-full table-auto">
                        <tbody>
                          <tr className={`group/row border-b border-border/50 transition-colors
                            ${isSelected ? 'bg-primary/10 hover:bg-primary/15' : isEven ? 'bg-transparent hover:bg-muted/30' : 'bg-muted/10 hover:bg-muted/30'}
                            ${isExpanded ? '!bg-muted/20' : ''}`}
                          >
                            {onToggleSelect && (
                              <td className="px-3 py-2 text-center w-10">
                                <input type="checkbox" checked={isSelected || false} onChange={() => onToggleSelect(rowKey, doc)}
                                  className="h-3.5 w-3.5 rounded border-muted-foreground accent-primary cursor-pointer" />
                              </td>
                            )}
                            <td className="px-2 py-2 w-8">
                              <button onClick={() => toggleRow(rowKey)} className="text-muted-foreground hover:text-primary transition-colors">
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                            </td>
                            {allKeys.map((key: string) => (
                              <td key={key} className="px-3 py-2 text-xs font-mono max-w-[280px] truncate whitespace-nowrap" title={formatValue(doc[key])}>
                                <ValueCell value={doc[key]} />
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right w-24 sticky right-0 z-10 bg-inherit backdrop-blur-sm border-l border-border/50">
                              <div className="flex gap-0.5 justify-end opacity-0 group-hover/row:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(doc)} className="h-7 w-7" title="Copy"><Copy className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => onEdit(doc)} className="h-7 w-7" title="Edit"><Edit className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => onDelete(doc)} className="h-7 w-7 hover:text-destructive" title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={allKeys.length + (onToggleSelect ? 3 : 2)} className="px-4 py-3 bg-muted/15 border-b border-border/50">
                                <DocumentDetail doc={doc} onCopy={copyToClipboard} />
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {hasFilters && (
        <div className="px-3 py-2 border-t bg-muted/30 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Showing {filteredDocs.length} of {documents.length} (filtered)</span>
          <button onClick={() => { setColumnFilters({}); setFilteringColumn(null) }} className="text-[11px] text-primary hover:underline">Clear filters</button>
        </div>
      )}
    </div>
  )
}
