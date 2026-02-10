import { useState, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Table, FileJson, Copy, Download, FileSpreadsheet, BarChart3 } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { formatJSON } from '@/utils/formatters'
import { useToast } from '@/components/common/Toast'
import { ChartView } from '@/components/charts/ChartView'
import { NoResults } from '@/components/common/EmptyState'

const ROW_HEIGHT = 36
const VIRTUALIZATION_THRESHOLD = 100

interface QueryResultsProps {
  results: any[]
  executionTime?: number
  error?: string
}

type ViewMode = 'table' | 'json' | 'chart'

export const QueryResults = ({ results, executionTime, error }: QueryResultsProps) => {
  const tt = useToast()
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedRows(newExpanded)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(results, null, 2))
    tt.success('Copied to clipboard!')
  }

  const downloadJSON = async () => {
    const content = JSON.stringify(results, null, 2)
    const res = await window.electronAPI.dialog.showSaveDialog({
      defaultPath: `query-results-${Date.now()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!res.canceled && res.filePath) {
      await window.electronAPI.fs.writeFile(res.filePath, content)
      tt.success('Exported as JSON')
    }
  }

  const downloadCSV = async () => {
    const keys = [...new Set(results.flatMap(d => Object.keys(d)))]
    const esc = (v: any) => { const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s }
    const csv = [keys.join(','), ...results.map(row => keys.map(k => esc(row[k])).join(','))].join('\n')
    const res = await window.electronAPI.dialog.showSaveDialog({
      defaultPath: `query-results-${Date.now()}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    })
    if (!res.canceled && res.filePath) {
      await window.electronAPI.fs.writeFile(res.filePath, csv)
      tt.success('Exported as CSV')
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500 bg-red-50 dark:bg-red-950 p-4">
        <h3 className="font-semibold text-red-700 dark:text-red-300 mb-2">Error</h3>
        <pre className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">{error}</pre>
      </div>
    )
  }

  if (!results || results.length === 0) {
    return <NoResults />
  }

  // Get all unique keys from results
  const allKeys = Array.from(
    new Set(results.flatMap((doc) => Object.keys(doc)))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {results.length} document{results.length !== 1 ? 's' : ''}
          </span>
          {executionTime !== undefined && (
            <span className="text-sm text-muted-foreground">
              Execution time: {executionTime}ms
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            <Table className="mr-2 h-4 w-4" />
            Table
          </Button>
          <Button
            variant={viewMode === 'json' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('json')}
          >
            <FileJson className="mr-2 h-4 w-4" />
            JSON
          </Button>
          <Button
            variant={viewMode === 'chart' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('chart')}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Chart
          </Button>
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={downloadJSON}>
            <Download className="mr-2 h-4 w-4" />
            JSON
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCSV}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {viewMode === 'chart' ? (
        <div className="rounded-lg border overflow-hidden" style={{ height: 350 }}>
          <ChartView data={results} />
        </div>
      ) : viewMode === 'table' ? (
        results.length > VIRTUALIZATION_THRESHOLD ? (
          <VirtualizedResultsTable results={results} allKeys={allKeys} />
        ) : (
          <div className="rounded-lg border overflow-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  {allKeys.map((key) => (
                    <th key={key} className="px-4 py-2 text-left font-medium">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((doc, index) => (
                  <tr key={index} className="border-t hover:bg-muted/50">
                    {allKeys.map((key) => (
                      <td key={key} className="px-4 py-2">
                        {typeof doc[key] === 'object' && doc[key] !== null ? (
                          <pre className="text-xs">{JSON.stringify(doc[key], null, 2)}</pre>
                        ) : (
                          String(doc[key] ?? '')
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="rounded-lg border bg-muted/50 p-4 overflow-auto max-h-[500px]">
          <pre className="text-sm">{formatJSON(results)}</pre>
        </div>
      )}
    </div>
  )
}

// Virtualized table for large result sets
function VirtualizedResultsTable({ results, allKeys }: { results: any[]; allKeys: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: useCallback(() => ROW_HEIGHT, []),
    overscan: 20,
  })

  return (
    <div className="rounded-lg border overflow-hidden">
      <div ref={scrollRef} className="overflow-auto max-h-[500px]">
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0 z-10">
            <tr>
              {allKeys.map((key) => (
                <th key={key} className="px-4 py-2 text-left font-medium">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={allKeys.length} style={{ padding: 0, height: rowVirtualizer.getTotalSize() }} className="relative">
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const doc = results[virtualRow.index]
                  return (
                    <div
                      key={virtualRow.index}
                      className="absolute left-0 w-full border-t hover:bg-muted/50"
                      style={{ top: virtualRow.start, height: virtualRow.size }}
                    >
                      <table className="w-full text-sm" style={{ tableLayout: 'auto' }}>
                        <tbody>
                          <tr>
                            {allKeys.map((key) => (
                              <td key={key} className="px-4 py-2">
                                {typeof doc[key] === 'object' && doc[key] !== null ? (
                                  <pre className="text-xs">{JSON.stringify(doc[key], null, 2)}</pre>
                                ) : (
                                  String(doc[key] ?? '')
                                )}
                              </td>
                            ))}
                          </tr>
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
    </div>
  )
}

