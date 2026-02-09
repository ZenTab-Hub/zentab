import { useState, useEffect } from 'react'
import { Clock, Trash2, Copy } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { storageService } from '@/services/storage.service'
import { formatDistanceToNow } from 'date-fns'

interface QueryHistoryItem {
  id: string
  query: string
  database?: string
  collection?: string
  executedAt: string
  executionTime?: number
  resultCount?: number
}

interface QueryHistoryProps {
  onSelectQuery: (query: string) => void
}

export const QueryHistory = ({ onSelectQuery }: QueryHistoryProps) => {
  const [history, setHistory] = useState<QueryHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      setLoading(true)
      const items = await storageService.getQueryHistory(50)
      setHistory(items)
    } catch (error) {
      console.error('Failed to load query history:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this query from history?')) {
      try {
        await storageService.deleteSavedQuery(id)
        setHistory(history.filter((item) => item.id !== id))
      } catch (error) {
        console.error('Failed to delete query:', error)
      }
    }
  }

  const handleCopy = (query: string) => {
    navigator.clipboard.writeText(query)
    alert('Query copied to clipboard!')
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading history...
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="p-8 text-center">
        <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No query history yet</p>
        <p className="text-sm text-muted-foreground mt-2">
          Your executed queries will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-[600px] overflow-auto">
      {history.map((item) => (
        <div
          key={item.id}
          className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.executedAt), { addSuffix: true })}
                </span>
                {item.database && (
                  <span className="text-xs text-muted-foreground">
                    • {item.database}
                    {item.collection && ` / ${item.collection}`}
                  </span>
                )}
              </div>
              <pre className="text-sm bg-muted/50 p-2 rounded overflow-x-auto">
                {item.query}
              </pre>
              {(item.executionTime !== undefined || item.resultCount !== undefined) && (
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  {item.executionTime !== undefined && (
                    <span>⚡ {item.executionTime}ms</span>
                  )}
                  {item.resultCount !== undefined && (
                    <span>📄 {item.resultCount} results</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectQuery(item.query)}
                title="Use this query"
              >
                Use
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(item.query)}
                title="Copy query"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(item.id)}
                title="Delete from history"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

