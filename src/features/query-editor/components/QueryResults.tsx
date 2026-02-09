import { useState } from 'react'
import { Table, FileJson, Copy, Download } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { formatJSON } from '@/utils/formatters'

interface QueryResultsProps {
  results: any[]
  executionTime?: number
  error?: string
}

type ViewMode = 'table' | 'json'

export const QueryResults = ({ results, executionTime, error }: QueryResultsProps) => {
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
    alert('Copied to clipboard!')
  }

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query-results-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
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
    return (
      <div className="rounded-lg border bg-muted/50 p-8 text-center">
        <p className="text-muted-foreground">No results to display</p>
      </div>
    )
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
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={downloadJSON}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {viewMode === 'table' ? (
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
      ) : (
        <div className="rounded-lg border bg-muted/50 p-4 overflow-auto max-h-[500px]">
          <pre className="text-sm">{formatJSON(results)}</pre>
        </div>
      )}
    </div>
  )
}

