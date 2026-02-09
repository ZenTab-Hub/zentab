import { useState } from 'react'
import { Play, Save, History, BookOpen, X } from 'lucide-react'
import { Input } from '@/components/common/Input'
import { MonacoQueryEditor } from '../components/MonacoQueryEditor'
import { QueryResults } from '../components/QueryResults'
import { QueryHistory } from '../components/QueryHistory'
import { useConnectionStore } from '@/store/connectionStore'
import { databaseService } from '@/services/database.service'
import { storageService } from '@/services/storage.service'

export const QueryEditorPage = () => {
  const { activeConnectionId, selectedDatabase, selectedCollection, getActiveConnection } = useConnectionStore()
  const activeConnection = getActiveConnection()
  const dbType = activeConnection?.type || 'mongodb'
  const isPostgreSQL = dbType === 'postgresql'
  const isRedis = dbType === 'redis'
  const isKafka = dbType === 'kafka'
  const [query, setQuery] = useState(() => isKafka ? '{"key": "", "value": ""}' : isRedis ? 'PING' : isPostgreSQL ? 'SELECT * FROM ' : '{}')
  const [results, setResults] = useState<any[]>([])
  const [executionTime, setExecutionTime] = useState<number>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [queryName, setQueryName] = useState('')
  const [kafkaMode, setKafkaMode] = useState<'consume' | 'produce'>('consume')

  const executeQuery = async () => {
    if (!activeConnectionId || !selectedDatabase) {
      alert('Please select a database first')
      return
    }
    if (!isRedis && !isKafka && !selectedCollection) {
      alert('Please select a collection/table first')
      return
    }

    try {
      setLoading(true)
      setError(undefined)

      const startTime = Date.now()
      let result: any

      if (isKafka) {
        const topic = selectedCollection || ''
        if (kafkaMode === 'consume') {
          // Consume messages from topic
          result = await databaseService.kafkaConsumeMessages(activeConnectionId, topic, 50, true)
        } else {
          // Produce message to topic
          try {
            const msg = JSON.parse(query)
            const messages = Array.isArray(msg) ? msg : [msg]
            result = await databaseService.kafkaProduceMessage(activeConnectionId, topic, messages)
          } catch (e) {
            throw new Error('Invalid JSON message. Use format: {"key": "...", "value": "..."}')
          }
        }
      } else if (isRedis) {
        result = await databaseService.executeQuery(activeConnectionId, selectedDatabase, selectedCollection || '', query)
      } else if (isPostgreSQL) {
        result = await databaseService.executeQuery(activeConnectionId, selectedDatabase, selectedCollection || '', query)
      } else {
        // MongoDB - parse JSON filter
        let queryInput: any
        try {
          queryInput = JSON.parse(query)
        } catch (e) {
          throw new Error('Invalid JSON query')
        }
        result = await databaseService.executeQuery(activeConnectionId, selectedDatabase, selectedCollection || '', queryInput, { limit: 100 })
      }

      const endTime = Date.now()
      const execTime = endTime - startTime

      // Format results for display
      if (isKafka) {
        if (kafkaMode === 'consume') {
          setResults(result.documents || [])
        } else {
          setResults([{ status: 'Message sent successfully', ...result }])
        }
      } else if (isRedis) {
        const redisResult = result.result !== undefined ? result.result : result.value
        setResults(Array.isArray(redisResult) ? redisResult.map((v: any, i: number) => ({ index: i, value: v })) : [{ result: redisResult }])
      } else {
        setResults(result.documents)
      }
      setExecutionTime(execTime)

      // Save to history
      await storageService.addQueryHistory({
        id: Date.now().toString(),
        query: isKafka ? `[${kafkaMode}] ${query}` : query,
        database: selectedDatabase,
        collection: selectedCollection,
        executedAt: new Date().toISOString(),
        executionTime: execTime,
        resultCount: result.documents?.length || 0,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to execute query')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleSaveQuery = async () => {
    if (!queryName.trim()) {
      alert('Please enter a query name')
      return
    }

    try {
      await storageService.saveQuery({
        id: Date.now().toString(),
        name: queryName,
        query: query as any,
        database: selectedDatabase,
        collection: selectedCollection,
        createdAt: new Date().toISOString() as any,
        updatedAt: new Date().toISOString() as any,
      } as any)
      alert('Query saved successfully!')
      setShowSaveDialog(false)
      setQueryName('')
    } catch (err) {
      alert('Failed to save query')
    }
  }

  const handleSelectFromHistory = (historyQuery: string) => {
    setQuery(historyQuery)
    setShowHistory(false)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      executeQuery()
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Query Editor</h1>
          {selectedDatabase && selectedCollection && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedDatabase} › {selectedCollection}
            </p>
          )}
        </div>
        <div className="flex gap-1.5">
          {isKafka && (
            <div className="flex items-center rounded-md border overflow-hidden">
              <button
                onClick={() => setKafkaMode('consume')}
                className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors ${kafkaMode === 'consume' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
              >
                Consume
              </button>
              <button
                onClick={() => setKafkaMode('produce')}
                className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors ${kafkaMode === 'produce' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
              >
                Produce
              </button>
            </div>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors"
          >
            <History className="h-3.5 w-3.5" />
            History
          </button>
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </button>
          <button
            onClick={executeQuery}
            disabled={loading || !activeConnectionId}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            {loading ? 'Executing...' : 'Execute (⌘+Enter)'}
          </button>
        </div>
      </div>

      {!activeConnectionId || !selectedDatabase || (!isKafka && !selectedCollection) ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              Select a database and table/collection to start querying
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 rounded-md border bg-card overflow-hidden min-h-[200px]">
            <MonacoQueryEditor
              value={query}
              onChange={setQuery}
              height="100%"
            />
          </div>

          <div className="rounded-md border bg-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold">Results</span>
              {executionTime !== undefined && (
                <span className="text-[10px] text-muted-foreground">{executionTime}ms</span>
              )}
            </div>
            <QueryResults
              results={results}
              executionTime={executionTime}
              error={error}
            />
          </div>
        </>
      )}

      {/* History Sidebar */}
      {showHistory && (
        <div className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-lg z-50 overflow-auto">
          <div className="p-3 border-b flex items-center justify-between sticky top-0 bg-background">
            <span className="text-xs font-semibold">Query History</span>
            <button
              onClick={() => setShowHistory(false)}
              className="p-1 rounded hover:bg-accent transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="p-3">
            <QueryHistory onSelectQuery={handleSelectFromHistory} />
          </div>
        </div>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-5 w-80 border shadow-lg">
            <h2 className="text-sm font-semibold mb-3">Save Query</h2>
            <Input
              placeholder="Query name"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveQuery()
                }
              }}
              className="mb-3 text-[11px] h-8"
            />
            <div className="flex gap-1.5 justify-end">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-3 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuery}
                className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

