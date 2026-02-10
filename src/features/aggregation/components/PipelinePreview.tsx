import { useState } from 'react'
import { Table, FileJson, RefreshCw } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { formatJSON } from '@/utils/formatters'
import { TableSkeleton } from '@/components/common/Skeleton'
import { EmptyState } from '@/components/common/EmptyState'

interface PipelinePreviewProps {
  results: any[]
  loading: boolean
  error?: string
  onRefresh: () => void
}

type ViewMode = 'table' | 'json'

export const PipelinePreview = ({
  results,
  loading,
  error,
  onRefresh,
}: PipelinePreviewProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  if (error) {
    return (
      <div className="rounded-lg border border-red-500 bg-red-50 dark:bg-red-950 p-4">
        <h3 className="font-semibold text-red-700 dark:text-red-300 mb-2">Error</h3>
        <pre className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">{error}</pre>
      </div>
    )
  }

  if (loading) {
    return <TableSkeleton rows={6} columns={4} />
  }

  if (!results || results.length === 0) {
    return (
      <EmptyState
        icon={Table}
        title="No results"
        description='Click "Run Pipeline" to see results'
        compact
      />
    )
  }

  const allKeys = Array.from(
    new Set(results.flatMap((doc) => Object.keys(doc)))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {results.length} document{results.length !== 1 ? 's' : ''}
        </span>
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
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="rounded-lg border overflow-auto max-h-[400px]">
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
        <div className="rounded-lg border bg-muted/50 p-4 overflow-auto max-h-[400px]">
          <pre className="text-sm">{formatJSON(results)}</pre>
        </div>
      )}
    </div>
  )
}

