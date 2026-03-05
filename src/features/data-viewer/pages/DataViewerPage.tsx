import { useState, useEffect, useRef } from 'react'
import { RefreshCw, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Table, FileJson, GitBranch, Sparkles, Download, X, FileSpreadsheet, GitCompareArrows, Layers, Filter } from 'lucide-react'
import { Input } from '@/components/common/Input'
import { DocumentTable } from '../components/DocumentTable'
import { DiffViewer } from '../components/DiffViewer'
import { BatchOperations } from '../components/BatchOperations'
import { RedisKeyViewer } from '../components/RedisKeyViewer'
import { KafkaMessageViewer } from '../components/KafkaMessageViewer'
import { SQLRowEditorModal } from '../components/SQLRowEditorModal'
import { JSONTreeView } from '@/components/common/JSONTreeView'
import { TableSkeleton } from '@/components/common/Skeleton'
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
  const [editDocValue, setEditDocValue] = useState('')
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
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [selectedDocsData, setSelectedDocsData] = useState<Map<string, any>>(new Map())
  const [showDiff, setShowDiff] = useState(false)
  const [showBatch, setShowBatch] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [showFilter, setShowFilter] = useState(false)

  const activeConnection = getActiveConnection()
  const dbType = activeConnection?.type || 'mongodb'
  const isRedis = dbType === 'redis'
  const isKafka = dbType === 'kafka'
  const loadRequestRef = useRef(0)

  const totalPages = Math.max(1, Math.ceil(totalCount / limit))

  useEffect(() => {
    if (activeConnectionId && selectedDatabase && selectedCollection && !isRedis && !isKafka) {
      loadDocuments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConnectionId, selectedDatabase, selectedCollection, page, isRedis, isKafka])

  if (isRedis) return <RedisKeyViewer />
  if (isKafka) return <KafkaMessageViewer />

  const loadDocuments = async (customFilter?: string, customOptions?: { limit?: number; sort?: any }) => {
    if (!activeConnectionId || !selectedDatabase || !selectedCollection) return

    const currentRequestId = ++loadRequestRef.current

    try {
      setLoading(true)
      let filterObj = {}
      try {
        const filterToUse = customFilter !== undefined ? customFilter : filter
        filterObj = JSON.parse(filterToUse)
      } catch {
        // Invalid filter JSON, use empty filter
      }

      const queryLimit = customOptions?.limit !== undefined ? customOptions.limit : limit
      const querySort = customOptions?.sort !== undefined ? customOptions.sort : sort
      const querySkip = (customOptions as any)?.skip !== undefined ? (customOptions as any).skip : (page * queryLimit)

      const result = await databaseService.executeQuery(
        activeConnectionId,
        selectedDatabase,
        selectedCollection,
        filterObj,
        { skip: querySkip, limit: queryLimit, sort: querySort }
      )

      if (currentRequestId !== loadRequestRef.current) return

      if (result.success) {
        setDocuments(result.documents || [])
        setTotalCount(result.totalCount || 0)
      } else {
        tt.error('Failed to load documents: ' + result.error)
      }
    } catch (error: any) {
      if (currentRequestId !== loadRequestRef.current) return
      tt.error('Load documents error: ' + (error.message || 'Unknown error'))
    } finally {
      if (currentRequestId === loadRequestRef.current) {
        setLoading(false)
      }
    }
  }

  const handleToggleSelect = (rowKey: string, doc: any) => {
    setSelectedDocs(prev => {
      const next = new Set(prev)
      if (next.has(rowKey)) {
        next.delete(rowKey)
        setSelectedDocsData(prevData => { const d = new Map(prevData); d.delete(rowKey); return d })
      } else {
        if (next.size >= 2) { tt.warning('Select at most 2 documents to compare'); return prev }
        next.add(rowKey)
        setSelectedDocsData(prevData => new Map(prevData).set(rowKey, doc))
      }
      return next
    })
  }

  const handleCompare = () => {
    if (selectedDocs.size !== 2) { tt.warning('Select exactly 2 documents to compare'); return }
    setShowDiff(true)
  }

  const handleEdit = (doc: any) => {
    const docForEdit = { ...doc }
    if (docForEdit._id && typeof docForEdit._id === 'object' && docForEdit._id.buffer) {
      const bufferArray = Object.values(docForEdit._id.buffer) as number[]
      docForEdit._id = bufferArray.map(b => b.toString(16).padStart(2, '0')).join('')
    }
    setEditDoc({ mode: 'edit', doc: docForEdit })
    setEditDocValue(JSON.stringify(docForEdit, null, 2))
  }

  /** Build a filter object to identify a specific row. For MongoDB uses _id, for SQL uses primary key or all columns. */
  const buildRowFilter = (doc: any) => {
    if (dbType !== 'postgresql') {
      return { _id: doc._id }
    }
    // For PostgreSQL: use 'id' if exists, otherwise use all non-null scalar columns as filter
    if (doc.id !== undefined) return { id: doc.id }
    const filter: Record<string, any> = {}
    for (const [key, val] of Object.entries(doc)) {
      if (val !== null && val !== undefined && typeof val !== 'object') {
        filter[key] = val
      }
    }
    return filter
  }

  const handleUpdate = async (oldDoc: any, newDoc: any) => {
    if (!activeConnectionId || !selectedDatabase || !selectedCollection) return

    try {
      const filter = buildRowFilter(oldDoc)
      const result = await databaseService.updateDocument(
        activeConnectionId, selectedDatabase, selectedCollection,
        filter, newDoc
      )
      if (result.success) { tt.success('Document updated!'); loadDocuments() }
      else { tt.error('Update failed: ' + result.error) }
    } catch (error) { tt.error('Update error: ' + error) }
  }

  const handleDelete = (doc: any) => {
    tt.confirm('Are you sure you want to delete this document?', async () => {
      if (!activeConnectionId || !selectedDatabase || !selectedCollection) return
      try {
        const filter = buildRowFilter(doc)
        const result = await databaseService.deleteDocument(activeConnectionId, selectedDatabase, selectedCollection, filter)
        if (result.success) { tt.success('Document deleted!'); loadDocuments() }
        else { tt.error('Delete failed: ' + result.error) }
      } catch (error: any) { tt.error('Delete error: ' + error.message) }
    })
  }

  const handleInsert = () => {
    setEditDoc({ mode: 'insert', doc: {} })
    setEditDocValue('{\n  \n}')
  }

  const handleAiQuery = async () => {
    if (!naturalLanguageQuery.trim()) { tt.warning('Please enter a query'); return }

    const selectedModel = models.find((m) => m.id === selectedModelId)
    if (!selectedModel) { tt.warning('Please select an AI model in settings'); return }

    setAiLoading(true)
    try {
      let sampleDoc = documents.length > 0 ? documents[0] : undefined
      if (!sampleDoc) {
        const sampleResult = await databaseService.executeQuery(
          activeConnectionId!, selectedDatabase!, selectedCollection!, {}, { limit: 1 }
        )
        if (sampleResult.success && sampleResult.documents?.length > 0) {
          sampleDoc = sampleResult.documents[0]
        }
      }

      const allFields = new Set<string>()
      documents.forEach((doc) => Object.keys(doc).forEach((key) => allFields.add(key)))
      if (sampleDoc) Object.keys(sampleDoc).forEach((key) => allFields.add(key))

      const result = await aiService.convertNaturalLanguageToQuery(
        { query: naturalLanguageQuery, collectionSchema: sampleDoc, availableFields: Array.from(allFields) },
        selectedModel
      )

      if (result.success && result.mongoQuery) {
        const queryString = JSON.stringify(result.mongoQuery)
        setFilter(queryString)
        setPage(0)
        if (result.options?.limit) setLimit(result.options.limit)
        if (result.options?.sort) setSort(result.options.sort)
        await loadDocuments(queryString, result.options)
      } else {
        tt.error('AI Query Error: ' + (result.error || 'Unknown error'))
      }
    } catch (error: any) {
      tt.error('Error: ' + error.message)
    } finally {
      setAiLoading(false)
    }
  }

  const insertDocument = async (doc: any) => {
    if (!activeConnectionId || !selectedDatabase || !selectedCollection) return

    try {
      const result = await databaseService.insertDocument(activeConnectionId, selectedDatabase, selectedCollection, doc)
      if (result.success) { tt.success('Document inserted!'); loadDocuments() }
      else { tt.error('Insert failed: ' + result.error) }
    } catch (error) {
      // Insert failed silently
    }
  }

  const handleExportJSON = async () => {
    if (!documents.length && totalCount === 0) { tt.warning('No data to export'); return }
    let exportDocs = documents
    if (totalCount > documents.length) {
      const fetchAll = await new Promise<boolean>((resolve) => {
        tt.confirm(`Export all ${totalCount} documents? (Current page has ${documents.length})`, () => resolve(true), () => resolve(false))
      })
      if (fetchAll) {
        try {
          const allResult = await databaseService.executeQuery(activeConnectionId!, selectedDatabase!, selectedCollection!, JSON.parse(filter || '{}'), { limit: 50000, sort })
          if (allResult.success && allResult.documents) exportDocs = allResult.documents
        } catch { /* use current page */ }
      }
    }
    const content = JSON.stringify(exportDocs, null, 2)
    const res = await window.electronAPI.dialog.showSaveDialog({
      defaultPath: `${selectedCollection}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!res.canceled && res.filePath) {
      await window.electronAPI.fs.writeFile(res.filePath, content)
      tt.success(`Exported ${exportDocs.length} documents`)
    }
  }

  const handleExportCSV = async () => {
    if (!documents.length && totalCount === 0) { tt.warning('No data to export'); return }
    let exportDocs = documents
    if (totalCount > documents.length) {
      const fetchAll = await new Promise<boolean>((resolve) => {
        tt.confirm(`Export all ${totalCount} documents as CSV? (Current page has ${documents.length})`, () => resolve(true), () => resolve(false))
      })
      if (fetchAll) {
        try {
          const allResult = await databaseService.executeQuery(activeConnectionId!, selectedDatabase!, selectedCollection!, JSON.parse(filter || '{}'), { limit: 50000, sort })
          if (allResult.success && allResult.documents) exportDocs = allResult.documents
        } catch { /* use current page */ }
      }
    }
    const keys = [...new Set(exportDocs.flatMap(d => Object.keys(d)))]
    const esc = (v: any) => { const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s }
    const csv = [keys.join(','), ...exportDocs.map(row => keys.map(k => esc(row[k])).join(','))].join('\n')
    const res = await window.electronAPI.dialog.showSaveDialog({
      defaultPath: `${selectedCollection}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    })
    if (!res.canceled && res.filePath) {
      await window.electronAPI.fs.writeFile(res.filePath, csv)
      tt.success(`Exported ${exportDocs.length} documents`)
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
    <div className="h-full flex flex-col">
      {/* ── Toolbar: single compact row ── */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border mb-0">
        {/* Left: collection info + doc count */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Table className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold truncate">{selectedCollection}</span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {totalCount.toLocaleString()} {totalCount === 1 ? 'record' : 'records'}
          </span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          <div className="flex items-center bg-muted/50 rounded-md p-0.5 mr-1">
            <button onClick={() => setViewMode('table')} className={`p-1.5 rounded transition-colors ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Table View">
              <Table className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setViewMode('json')} className={`p-1.5 rounded transition-colors ${viewMode === 'json' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="JSON View">
              <FileJson className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setViewMode('tree')} className={`p-1.5 rounded transition-colors ${viewMode === 'tree' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Tree View">
              <GitBranch className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Compare (only when docs selected) */}
          {selectedDocs.size > 0 && (
            <>
              <button onClick={handleCompare} disabled={selectedDocs.size !== 2}
                className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
                <GitCompareArrows className="h-3.5 w-3.5" />
                Compare ({selectedDocs.size}/2)
              </button>
              <button onClick={() => { setSelectedDocs(new Set()); setSelectedDocsData(new Map()) }}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-accent transition-colors" title="Clear selection">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          <div className="w-px h-5 bg-border mx-0.5" />

          <button onClick={() => setShowFilter(!showFilter)}
            className={`p-1.5 rounded-md transition-colors ${showFilter ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`} title="Filter">
            <Filter className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setShowAI(!showAI)}
            className={`p-1.5 rounded-md transition-colors ${showAI ? 'bg-purple-500/15 text-purple-400' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`} title="AI Query">
            <Sparkles className="h-3.5 w-3.5" />
          </button>

          <div className="w-px h-5 bg-border mx-0.5" />

          <button onClick={() => setShowBatch(true)} className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Batch Operations">
            <Layers className="h-3.5 w-3.5" />
          </button>
          <button onClick={handleInsert} className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Insert Document">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button onClick={handleExportJSON} className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Export JSON">
            <Download className="h-3.5 w-3.5" />
          </button>
          <button onClick={handleExportCSV} className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Export CSV">
            <FileSpreadsheet className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => loadDocuments()} disabled={loading}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50" title="Refresh">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Collapsible Filter Bar ── */}
      {showFilter && (
        <div className="flex gap-1.5 items-center py-2 border-b border-border animate-in slide-in-from-top-1 duration-150">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            placeholder='Filter (JSON): {"name": "John", "age": {"$gt": 25}}'
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(0); loadDocuments() } }}
            className="flex-1 text-xs h-8 font-mono"
          />
          <button
            onClick={() => { setPage(0); loadDocuments() }}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            Apply
          </button>
          {filter !== '{}' && (
            <button
              onClick={() => { setFilter('{}'); setPage(0); loadDocuments('{}') }}
              className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* ── Collapsible AI Query ── */}
      {showAI && (
        <div className="py-2 border-b border-border space-y-2 animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-xs font-medium text-purple-400">AI Query</span>
            </div>
            {models.length > 0 && (
              <select
                value={selectedModelId || ''}
                onChange={(e) => selectModel(e.target.value)}
                className="px-2 py-1 rounded border bg-background text-xs"
              >
                <option value="">Select Model</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-1.5">
            <Input
              placeholder='e.g. "find users older than 25 sorted by name"'
              value={naturalLanguageQuery}
              onChange={(e) => setNaturalLanguageQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !aiLoading) handleAiQuery() }}
              className="flex-1 text-xs h-8"
            />
            <button
              onClick={handleAiQuery}
              disabled={aiLoading || !selectedModelId}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50 shrink-0"
            >
              {aiLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {aiLoading ? 'Processing...' : 'Ask AI'}
            </button>
          </div>
          {models.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              Add AI models in Settings (DeepSeek, OpenAI, Gemini, or Custom)
            </p>
          )}
        </div>
      )}

      {/* ── Data Content ── */}
      <div className="flex-1 overflow-auto mt-2 rounded-md border bg-card">
        {loading ? (
          <TableSkeleton rows={12} columns={5} />
        ) : viewMode === 'table' ? (
          <DocumentTable documents={documents} onEdit={handleEdit} onDelete={handleDelete}
            sortField={sortField} sortDirection={sortDirection}
            onSort={(field, dir) => { setSortField(field); setSortDirection(dir); const newSort = { [field]: dir }; setSort(newSort); setPage(0); loadDocuments(undefined, { sort: newSort }) }}
            selectedDocs={selectedDocs} onToggleSelect={handleToggleSelect}
          />
        ) : viewMode === 'tree' ? (
          <div className="p-3">
            <JSONTreeView data={documents} />
          </div>
        ) : (
          <pre className="overflow-auto p-4 text-xs font-mono leading-relaxed">
            {JSON.stringify(documents, null, 2)}
          </pre>
        )}
      </div>

      {/* ── Bottom Bar: Pagination ── */}
      <div className="flex items-center justify-between pt-2 border-t border-border mt-0">
        {/* Left: showing range + per page */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {totalCount > 0 ? (
              <>
                <span className="text-foreground font-medium">{(page * limit + 1).toLocaleString()}</span>
                <span> - </span>
                <span className="text-foreground font-medium">{Math.min((page + 1) * limit, totalCount).toLocaleString()}</span>
                <span> of </span>
                <span className="text-foreground font-medium">{totalCount.toLocaleString()}</span>
              </>
            ) : 'No records'}
          </span>
          <select value={limit} onChange={e => { const newLimit = Number(e.target.value); setLimit(newLimit); setPage(0); loadDocuments(undefined, { limit: newLimit, sort }) }}
            className="px-2 py-1 text-xs rounded border bg-background text-muted-foreground hover:text-foreground cursor-pointer">
            {[25, 50, 100, 250, 500].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>

        {/* Right: page navigation */}
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(0)} disabled={page === 0 || loading}
            className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent" title="First page">
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0 || loading}
            className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent" title="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1 mx-1">
            <span className="text-xs text-muted-foreground">Page</span>
            <input value={goToPage} onChange={e => setGoToPage(e.target.value)} placeholder={`${page + 1}`}
              onKeyDown={e => { if (e.key === 'Enter') { const p = parseInt(goToPage); if (p >= 1 && p <= totalPages) { setPage(p - 1); setGoToPage('') } } }}
              className="w-12 px-1.5 py-1 text-xs text-center rounded border bg-background focus:border-primary focus:outline-none transition-colors"
            />
            <span className="text-xs text-muted-foreground">of {totalPages.toLocaleString()}</span>
          </div>

          <button onClick={() => setPage(page + 1)} disabled={(page + 1) * limit >= totalCount || loading}
            className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent" title="Next page">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => setPage(Math.max(0, totalPages - 1))} disabled={(page + 1) * limit >= totalCount || loading}
            className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent" title="Last page">
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Document Editor Modal ── */}
      {editDoc && dbType === 'postgresql' && activeConnectionId && selectedDatabase && selectedCollection && (
        <SQLRowEditorModal
          mode={editDoc.mode}
          doc={editDoc.doc}
          connectionId={activeConnectionId}
          database={selectedDatabase}
          table={selectedCollection}
          onSave={(data) => {
            if (editDoc.mode === 'edit') handleUpdate(editDoc.doc, data)
            else insertDocument(data)
            setEditDoc(null)
          }}
          onClose={() => setEditDoc(null)}
        />
      )}
      {editDoc && dbType !== 'postgresql' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={() => setEditDoc(null)} onKeyDown={(e) => { if (e.key === 'Escape') setEditDoc(null) }}>
          <div className="bg-background border border-border rounded-lg w-[700px] max-h-[80vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">{editDoc.mode === 'edit' ? 'Edit Document' : 'Insert Document'}</h3>
              <button onClick={() => setEditDoc(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <textarea
                className="w-full h-[400px] bg-accent/30 border border-border rounded-md p-3 text-xs font-mono text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                value={editDocValue}
                onChange={(e) => setEditDocValue(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
              <button onClick={() => setEditDoc(null)} className="px-3 py-1.5 text-xs rounded-md border border-input text-muted-foreground hover:bg-accent">Cancel</button>
              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(editDocValue)
                    if (editDoc.mode === 'edit') {
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
                  } catch {
                    tt.error('Invalid JSON')
                  }
                }}
                className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {editDoc.mode === 'edit' ? 'Update' : 'Insert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff Viewer Modal */}
      {showDiff && selectedDocsData.size === 2 && (() => {
        const docs = Array.from(selectedDocsData.values())
        return <DiffViewer left={docs[0]} right={docs[1]} onClose={() => setShowDiff(false)} />
      })()}

      {/* Batch Operations Modal */}
      {showBatch && (
        <BatchOperations
          connectionId={activeConnectionId!}
          database={selectedDatabase!}
          collection={selectedCollection!}
          dbType={dbType}
          onClose={() => setShowBatch(false)}
          onSuccess={() => { setShowBatch(false); loadDocuments() }}
        />
      )}
    </div>
  )
}
