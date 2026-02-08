import { useState, useEffect } from 'react'
import { RefreshCw, Plus, ChevronLeft, ChevronRight, Table, FileJson, Sparkles } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { DocumentTable } from '../components/DocumentTable'
import { useConnectionStore } from '@/store/connectionStore'
import { useAISettingsStore } from '@/store/aiSettingsStore'
import { mongodbService } from '@/services/mongodb.service'
import { aiService } from '@/services/ai.service'

type ViewMode = 'table' | 'json'

export const DataViewerPage = () => {
  const { activeConnectionId, selectedDatabase, selectedCollection } = useConnectionStore()
  const { models, selectedModelId, selectModel } = useAISettingsStore()
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('{}')
  const [page, setPage] = useState(0)
  const [limit, setLimit] = useState(50)
  const [sort, setSort] = useState<any>({})
  const [totalCount, setTotalCount] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (activeConnectionId && selectedDatabase && selectedCollection) {
      loadDocuments()
    }
  }, [activeConnectionId, selectedDatabase, selectedCollection, page])

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

      const result = await mongodbService.executeQuery(
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
        alert('Failed to load documents: ' + result.error)
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

    const newValue = prompt('Edit document (JSON):', JSON.stringify(docForEdit, null, 2))
    if (newValue) {
      try {
        const updated = JSON.parse(newValue)
        handleUpdate(doc, updated)
      } catch (e) {
        alert('Invalid JSON')
      }
    }
  }

  const handleUpdate = async (oldDoc: any, newDoc: any) => {
    if (!activeConnectionId || !selectedDatabase || !selectedCollection) return

    try {
      console.log('Updating document:', { oldDoc, newDoc })

      const result = await mongodbService.updateDocument(
        activeConnectionId,
        selectedDatabase,
        selectedCollection,
        { _id: oldDoc._id },
        newDoc
      )

      console.log('Update result:', result)

      if (result.success) {
        alert('Document updated!')
        loadDocuments()
      } else {
        alert('Update failed: ' + result.error)
      }
    } catch (error) {
      console.error('Update error:', error)
      alert('Update error: ' + error)
    }
  }

  const handleDelete = async (doc: any) => {
    if (!confirm('Are you sure you want to delete this document?')) return
    if (!activeConnectionId || !selectedDatabase || !selectedCollection) return

    try {
      console.log('Deleting document:', doc)

      const result = await mongodbService.deleteDocument(
        activeConnectionId,
        selectedDatabase,
        selectedCollection,
        { _id: doc._id }
      )

      console.log('Delete result:', result)

      if (result.success) {
        alert('Document deleted!')
        loadDocuments()
      } else {
        alert('Delete failed: ' + result.error)
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Delete error: ' + error)
    }
  }

  const handleInsert = () => {
    const newDoc = prompt('New document (JSON):', '{\n  \n}')
    if (newDoc) {
      try {
        const doc = JSON.parse(newDoc)
        insertDocument(doc)
      } catch (e) {
        alert('Invalid JSON')
      }
    }
  }

  const handleAiQuery = async () => {
    if (!naturalLanguageQuery.trim()) {
      alert('Please enter a query')
      return
    }

    const selectedModel = models.find((m) => m.id === selectedModelId)
    if (!selectedModel) {
      alert('Please select an AI model in settings (click the Settings icon in header)')
      return
    }

    setAiLoading(true)
    try {
      // Get sample document for context
      let sampleDoc = documents.length > 0 ? documents[0] : undefined

      // If no documents loaded yet, fetch one sample document
      if (!sampleDoc) {
        const sampleResult = await mongodbService.executeQuery(
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
        alert('AI Query Error: ' + (result.error || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('AI query error:', error)
      alert('Error: ' + error.message)
    } finally {
      setAiLoading(false)
    }
  }

  const insertDocument = async (doc: any) => {
    if (!activeConnectionId || !selectedDatabase || !selectedCollection) return

    try {
      const result = await mongodbService.insertDocument(
        activeConnectionId,
        selectedDatabase,
        selectedCollection,
        doc
      )

      if (result.success) {
        alert('Document inserted!')
        loadDocuments()
      } else {
        alert('Insert failed: ' + result.error)
      }
    } catch (error) {
      console.error('Insert error:', error)
    }
  }

  if (!activeConnectionId || !selectedDatabase || !selectedCollection) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Data Viewer</h1>
            <p className="text-muted-foreground">Browse and edit documents</p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            Select a collection from the sidebar to view documents
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Viewer</h1>
          <p className="text-muted-foreground">
            {selectedDatabase} / {selectedCollection}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleInsert}>
            <Plus className="mr-2 h-4 w-4" />
            Insert Document
          </Button>
          <Button onClick={() => loadDocuments()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* AI Natural Language Query */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <h3 className="font-semibold">AI Query Assistant</h3>
          </div>
          {models.length > 0 && (
            <select
              value={selectedModelId || ''}
              onChange={(e) => selectModel(e.target.value)}
              className="px-3 py-2 rounded-md border bg-background text-sm"
            >
              <option value="">Select AI Model</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder='Ask in natural language: "find users with age > 25" or "show users named John"'
            value={naturalLanguageQuery}
            onChange={(e) => setNaturalLanguageQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !aiLoading) {
                handleAiQuery()
              }
            }}
            className="flex-1"
          />
          <Button onClick={handleAiQuery} disabled={aiLoading || !selectedModelId}>
            {aiLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Ask AI
              </>
            )}
          </Button>
        </div>
        {models.length === 0 && (
          <p className="text-xs text-muted-foreground">
            💡 Click the Settings icon in the header to add AI models (DeepSeek, OpenAI, Gemini, or Custom)
          </p>
        )}
        {models.length > 0 && !selectedModelId && (
          <p className="text-xs text-muted-foreground">
            💡 Select an AI model from the dropdown above
          </p>
        )}
        {selectedModelId && (
          <p className="text-xs text-muted-foreground">
            ✅ Using <strong>{models.find((m) => m.id === selectedModelId)?.name}</strong>
          </p>
        )}
      </div>

      {/* Manual JSON Filter */}
      <div className="flex gap-2">
        <Input
          placeholder='Manual filter (JSON): {"name": "John"}'
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1"
        />
        <Button onClick={() => { setPage(0); loadDocuments(); }}>Apply Filter</Button>
      </div>

      {/* View Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={viewMode === 'table' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('table')}
        >
          <Table className="mr-2 h-4 w-4" />
          Table View
        </Button>
        <Button
          variant={viewMode === 'json' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('json')}
        >
          <FileJson className="mr-2 h-4 w-4" />
          JSON View
        </Button>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {page * limit + 1} - {Math.min((page + 1) * limit, totalCount)} of {totalCount} documents
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={(page + 1) * limit >= totalCount || loading}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : viewMode === 'table' ? (
        <DocumentTable documents={documents} onEdit={handleEdit} onDelete={handleDelete} />
      ) : (
        <div className="rounded-lg border bg-card">
          <pre className="overflow-auto p-4 text-sm">
            {JSON.stringify(documents, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

