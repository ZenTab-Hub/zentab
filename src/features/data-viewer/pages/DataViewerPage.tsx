import { useState, useEffect } from 'react'
import { RefreshCw, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Table, FileJson, GitBranch, Sparkles, Download, X, FileSpreadsheet } from 'lucide-react'
import { Input } from '@/components/common/Input'
import { DocumentTable } from '../components/DocumentTable'
import { RedisKeyViewer } from '../components/RedisKeyViewer'
import { KafkaMessageViewer } from '../components/KafkaMessageViewer'
import { JSONTreeView } from '@/components/common/JSONTreeView'
import { useConnectionStore } from '@/store/connectionStore'
import { useAISettingsStore } from '@/store/aiSettingsStore'
import { databaseService } from '@/services/database.service'
import { aiService } from '@/services/ai.service'
import { useToast } from '@/components/common/Toast'

type ViewMode = 'table' | 'json' | 'tree'

export const DataViewerPage = () => {
  const { activeConnectionId, selectedDatabase, selectedCollection, getActiveConnection } = useConnectionStore()
  const { models, selectedModelId, selectModel } = useAISettingsStore()
  const tt = useToast()
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editDoc, setEditDoc] = useState<{ mode: 'edit' | 'insert'; doc: any } | null>(null)
  const [filter, setFilter] = useState('{}')
  const [page, setPage] = useState(0)
  const [limit, setLimit] = useState(50)
  const [sort, setSort] = useState<any>({})
  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<1 | -1>(1)
  const [totalCount, setTotalCount] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [goToPage, setGoToPage] = useState('')

  const activeConnection = getActiveConnection()
  const dbType = activeConnection?.type || 'mongodb'
  const isRedis = dbType === 'redis'
  const isKafka = dbType === 'kafka'

  useEffect(() => {
    if (activeConnectionId && selectedDatabase && selectedCollection && !isRedis && !isKafka) {
      loadDocuments()
    }
  }, [activeConnectionId, selectedDatabase, selectedCollection, page, isRedis, isKafka])

  // Custom UI for Redis
  if (isRedis) {
    return <RedisKeyViewer />
  }

  // Custom UI for Kafka
  if (isKafka) {
    return <KafkaMessageViewer />
  }

  const loadDocuments = async (customFilter?: string, customOptions?: { limit?: number; sort?: any }) => {
    if (!activeConnectionId || !selectedDatabase || !selectedCollection) {
      console.log('Missing required fields:', { activeConnectionId, selectedDatabase, selectedCollection })
      return
    }

    try {
      setLoading(true)
      let filterObj = {}
      try {
        // Use custom filter if provided, otherwise use state filter
        const filterToUse = customFilter !== undefined ? customFilter : filter
        filterObj = JSON.parse(filterToUse)
      } catch (e) {
        console.error('Invalid filter JSON')
      }

      // Use custom options if provided
      const queryLimit = customOptions?.limit !== undefined ? customOptions.limit : limit
      const querySort = customOptions?.sort !== undefined ? customOptions.sort : sort
      const querySkip = (customOptions as any)?.skip !== undefined ? (customOptions as any).skip : (page * queryLimit)

      console.log('Loading documents:', {
        activeConnectionId,
        selectedDatabase,
        selectedCollection,
        filterObj,
        limit: queryLimit,
        sort: querySort,
        skip: querySkip
      })

      const result = await databaseService.executeQuery(
        activeConnectionId,
        selectedDatabase,
        selectedCollection,
        filterObj,
        {
          skip: querySkip,
          limit: queryLimit,
          sort: querySort
        }
      )

      console.log('Documents result:', result)

      if (result.success) {
        setDocuments(result.documents || [])
        setTotalCount(result.totalCount || 0)
      } else {
        tt.error('Failed to load documents: ' + result.error)
      }
    } catch (error) {
      console.error('Load documents error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (doc: any) => {
    // Create a clean copy for editing (convert Buffer _id to string for display)
    const docForEdit = { ...doc }
    if (docForEdit._id && typeof docForEdit._id === 'object' && docForEdit._id.buffer) {
      const bufferArray = Object.values(docForEdit._id.buffer) as number[]
      docForEdit._id = bufferArray.map(b => b.toString(16).padStart(2, '0')).join('')
    }
    setEditDoc({ mode: 'edit', doc: docForEdit })
  }

  const handleUpdate = async (oldDoc: any, newDoc: any) => {
    if (!activeConnectionId || !selectedDatabase || !selectedCollection) return

    try {
      console.log('Updating document:', { oldDoc, newDoc })

      const result = await databaseService.updateDocument(
        activeConnectionId,
        selectedDatabase,
        selectedCollection,
        { _id: oldDoc._id },
        newDoc
      )

      console.log('Update result:', result)

      if (result.success) {
        tt.success('Document updated!')
        loadDocuments()
      } else {
        tt.error('Update failed: ' + result.error)
      }
    } catch (error) {
      console.error('Update error:', error)
      tt.error('Update error: ' + error)
    }
  }

  const handleDelete = (doc: any) => {
    tt.confirm('Are you sure you want to delete this document?', async () => {
      if (!activeConnectionId || !selectedDatabase || !selectedCollection) return
      try {
        const result = await databaseService.deleteDocument(activeConnectionId, selectedDatabase, selectedCollection, { _id: doc._id })
        if (result.success) { tt.success('Document deleted!'); loadDocuments() }
        else { tt.error('Delete failed: ' + result.error) }
      } catch (error: any) { tt.error('Delete error: ' + error.message) }
    })
  }

  const handleInsert = () => {
    setEditDoc({ mode: 'insert', doc: {} })
  }

  const handleAiQuery = async () => {
    if (!naturalLanguageQuery.trim()) {
      tt.warning('Please enter a query')
      return
    }

    const selectedModel = models.find((m) => m.id === selectedModelId)
    if (!selectedModel) {
      tt.warning('Please select an AI model in settings (click the Settings icon in header)')
      return
    }

    setAiLoading(true)
    try {
      // Get sample document for context
      let sampleDoc = documents.length > 0 ? documents[0] : undefined

      // If no documents loaded yet, fetch one sample document
      if (!sampleDoc) {
        const sampleResult = await databaseService.executeQuery(
          activeConnectionId,
          selectedDatabase,
          selectedCollection,
          {},
          { limit: 1 }
        )
        if (sampleResult.success && sampleResult.documents && sampleResult.documents.length > 0) {
          sampleDoc = sampleResult.documents[0]
        }
      }

      // Extract all unique field names from all documents for better context
      const allFields = new Set<string>()
      documents.forEach((doc) => {
        Object.keys(doc).forEach((key) => allFields.add(key))
      })
      if (sampleDoc) {
        Object.keys(sampleDoc).forEach((key) => allFields.add(key))
      }

      const result = await aiService.convertNaturalLanguageToQuery(
        {
          query: naturalLanguageQuery,
          collectionSchema: sampleDoc,
          availableFields: Array.from(allFields),
        },
        selectedModel
      )

      if (result.success && result.mongoQuery) {
        // Debug: Log AI response
        console.log('AI Response:', {
          mongoQuery: result.mongoQuery,
          options: result.options,
          explanation: result.explanation
        })

        // Set the filter and apply
        const queryString = JSON.stringify(result.mongoQuery)
        setFilter(queryString)
        setPage(0)

        // Update limit and sort if provided by AI
        if (result.options?.limit) {
          console.log('Setting limit to:', result.options.limit)
          setLimit(result.options.limit)
        }
        if (result.options?.sort) {
          console.log('Setting sort to:', result.options.sort)
          setSort(result.options.sort)
        }

        // Show explanation
        if (result.explanation) {
          console.log('AI Query:', result.explanation)
        }

        // Auto-apply the query immediately with the new filter and options
        console.log('Loading documents with options:', result.options)
        await loadDocuments(queryString, result.options)
      } else {
        tt.error('AI Query Error: ' + (result.error || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('AI query error:', error)
      tt.error('Error: ' + error.message)
    } finally {
      setAiLoading(false)
    }
  }

  const insertDocument = async (doc: any) => {
    if (!activeConnectionId || !selectedDatabase || !selectedCollection) return

    try {
      const result = await databaseService.insertDocument(
        activeConnectionId,
        selectedDatabase,
        selectedCollection,
        doc
      )

      if (result.success) {
        tt.success('Document inserted!')
        loadDocuments()
      } else {
        tt.error('Insert failed: ' + result.error)
      }
    } catch (error) {
      console.error('Insert error:', error)
    }
  }

  if (!activeConnectionId || !selectedDatabase || !selectedCollection) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold">Data Viewer</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Browse and edit records</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Table className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              Select a database and table/collection from the sidebar
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Data Viewer</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedDatabase} › {selectedCollection}
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleInsert}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Insert
          </button>
          <button
            onClick={async () => {
              if (!documents.length) { tt.warning('No data to export'); return }
              const content = JSON.stringify(documents, null, 2)
              const res = await window.electronAPI.dialog.showSaveDialog({
                defaultPath: `${selectedCollection}.json`,
                filters: [{ name: 'JSON', extensions: ['json'] }],
              })
              if (!res.canceled && res.filePath) {
                await window.electronAPI.fs.writeFile(res.filePath, content)
                tt.success(`Exported ${documents.length} documents`)
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors"
            title="Export as JSON"
          >
            <Download className="h-3.5 w-3.5" />
            JSON
          </button>
          <button
            onClick={async () => {
              if (!documents.length) { tt.warning('No data to export'); return }
              const keys = [...new Set(documents.flatMap(d => Object.keys(d)))]
              const esc = (v: any) => { const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s }
              const csv = [keys.join(','), ...documents.map(row => keys.map(k => esc(row[k])).join(','))].join('\n')
              const res = await window.electronAPI.dialog.showSaveDialog({
                defaultPath: `${selectedCollection}.csv`,
                filters: [{ name: 'CSV', extensions: ['csv'] }],
              })
              if (!res.canceled && res.filePath) {
                await window.electronAPI.fs.writeFile(res.filePath, csv)
                tt.success(`Exported ${documents.length} documents`)
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors"
            title="Export as CSV"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            onClick={() => loadDocuments()}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* AI Natural Language Query */}
      <div className="rounded-md border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
            <span className="text-[11px] font-semibold">AI Query Assistant</span>
          </div>
          {models.length > 0 && (
            <select
              value={selectedModelId || ''}
              onChange={(e) => selectModel(e.target.value)}
              className="px-2 py-1 rounded border bg-background text-[11px]"
            >
              <option value="">Select Model</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-1.5">
          <Input
            placeholder='Ask in natural language: "find users with age > 25"'
            value={naturalLanguageQuery}
            onChange={(e) => setNaturalLanguageQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !aiLoading) {
                handleAiQuery()
              }
            }}
            className="flex-1 text-[11px] h-7"
          />
          <button
            onClick={handleAiQuery}
            disabled={aiLoading || !selectedModelId}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {aiLoading ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {aiLoading ? 'Processing...' : 'Ask AI'}
          </button>
        </div>
        {models.length === 0 && (
          <p className="text-[10px] text-muted-foreground">
            💡 Add AI models in Settings (DeepSeek, OpenAI, Gemini, or Custom)
          </p>
        )}
      </div>

      {/* Filter & View Controls */}
      <div className="flex gap-1.5 items-center">
        <Input
          placeholder='Filter (JSON): {"name": "John"}'
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 text-[11px] h-7"
        />
        <button
          onClick={() => { setPage(0); loadDocuments(); }}
          className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Apply
        </button>
        <span className="text-muted-foreground/30">|</span>
        <button onClick={() => setViewMode('table')} className={`p-1.5 rounded transition-colors ${viewMode === 'table' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}`} title="Table View">
          <Table className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setViewMode('json')} className={`p-1.5 rounded transition-colors ${viewMode === 'json' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}`} title="JSON View">
          <FileJson className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setViewMode('tree')} className={`p-1.5 rounded transition-colors ${viewMode === 'tree' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}`} title="Tree View">
          <GitBranch className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {totalCount > 0 ? `${page * limit + 1}–${Math.min((page + 1) * limit, totalCount)} of ${totalCount}` : 'No records'}
          </span>
          <span className="text-muted-foreground/30">|</span>
          <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(0); setTimeout(() => loadDocuments(), 0) }}
            className="px-1.5 py-0.5 text-[10px] rounded border bg-background">
            {[25, 50, 100, 250, 500].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(0)} disabled={page === 0 || loading} className="p-1 rounded text-muted-foreground hover:bg-accent transition-colors disabled:opacity-30">
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0 || loading} className="p-1 rounded text-muted-foreground hover:bg-accent transition-colors disabled:opacity-30">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <input value={goToPage} onChange={e => setGoToPage(e.target.value)} placeholder={`${page + 1}`}
            onKeyDown={e => { if (e.key === 'Enter') { const p = parseInt(goToPage); if (p >= 1 && p <= Math.ceil(totalCount / limit)) { setPage(p - 1); setGoToPage('') } } }}
            className="w-10 px-1 py-0.5 text-[10px] text-center rounded border bg-background"
          />
          <span className="text-[10px] text-muted-foreground">/ {Math.max(1, Math.ceil(totalCount / limit))}</span>
          <button onClick={() => setPage(page + 1)} disabled={(page + 1) * limit >= totalCount || loading} className="p-1 rounded text-muted-foreground hover:bg-accent transition-colors disabled:opacity-30">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setPage(Math.max(0, Math.ceil(totalCount / limit) - 1))} disabled={(page + 1) * limit >= totalCount || loading} className="p-1 rounded text-muted-foreground hover:bg-accent transition-colors disabled:opacity-30">
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto rounded-md border bg-card">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        ) : viewMode === 'table' ? (
          <DocumentTable documents={documents} onEdit={handleEdit} onDelete={handleDelete}
            sortField={sortField} sortDirection={sortDirection}
            onSort={(field, dir) => { setSortField(field); setSortDirection(dir); setSort({ [field]: dir }); setPage(0); setTimeout(() => loadDocuments(undefined, { sort: { [field]: dir } }), 0) }}
          />
        ) : viewMode === 'tree' ? (
          <div className="p-3">
            <JSONTreeView data={documents} />
          </div>
        ) : (
          <pre className="overflow-auto p-3 text-[11px]">
            {JSON.stringify(documents, null, 2)}
          </pre>
        )}
      </div>

      {/* Document Editor Modal */}
      {editDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={() => setEditDoc(null)} onKeyDown={(e) => { if (e.key === 'Escape') setEditDoc(null) }}>
          <div className="bg-[#1e1e2e] border border-[#333] rounded-lg w-[700px] max-h-[80vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
              <h3 className="text-sm font-semibold text-[#e0e0e0]">{editDoc.mode === 'edit' ? 'Edit Document' : 'Insert Document'}</h3>
              <button onClick={() => setEditDoc(null)} className="text-[#888] hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <textarea
                className="w-full h-[400px] bg-[#0d1117] border border-[#333] rounded-md p-3 text-xs font-mono text-[#e0e0e0] resize-none focus:outline-none focus:border-blue-500"
                defaultValue={JSON.stringify(editDoc.doc, null, 2)}
                id="doc-editor-textarea"
              />
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#333]">
              <button onClick={() => setEditDoc(null)} className="px-3 py-1.5 text-xs rounded-md border border-[#444] text-[#aaa] hover:bg-[#333]">Cancel</button>
              <button
                onClick={() => {
                  const el = document.getElementById('doc-editor-textarea') as HTMLTextAreaElement
                  if (!el) return
                  try {
                    const parsed = JSON.parse(el.value)
                    if (editDoc.mode === 'edit') {
                      // Find original doc to get _id for update
                      const origDoc = documents.find(d => {
                        const editId = editDoc.doc._id
                        const dId = d._id
                        if (typeof editId === 'string' && typeof dId === 'object' && dId.buffer) {
                          const bufArr = Object.values(dId.buffer) as number[]
                          return bufArr.map(b => b.toString(16).padStart(2, '0')).join('') === editId
                        }
                        return JSON.stringify(dId) === JSON.stringify(editId)
                      })
                      if (origDoc) handleUpdate(origDoc, parsed)
                    } else {
                      insertDocument(parsed)
                    }
                    setEditDoc(null)
                  } catch (e) {
                    tt.error('Invalid JSON')
                  }
                }}
                className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                {editDoc.mode === 'edit' ? 'Update' : 'Insert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

