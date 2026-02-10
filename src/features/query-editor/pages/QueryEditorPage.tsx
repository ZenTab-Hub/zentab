import { useState, useCallback, useEffect, useRef } from 'react'
import { Play, Save, History, BookOpen, X, Plus, FileSearch, FileCode2, Sparkles } from 'lucide-react'
import { Input } from '@/components/common/Input'
import { MonacoQueryEditor } from '../components/MonacoQueryEditor'
import { QueryResults } from '../components/QueryResults'
import { QueryHistory } from '../components/QueryHistory'
import { QueryTemplates } from '../components/QueryTemplates'
import { ExplainPlanTree } from '@/components/explain/ExplainPlanTree'
import { useConnectionStore } from '@/store/connectionStore'
import { useQueryTabStore } from '@/store/queryTabStore'
import { databaseService } from '@/services/database.service'
import { storageService } from '@/services/storage.service'
import { useToast } from '@/components/common/Toast'
import { aiService } from '@/services/ai.service'
import { useAISettingsStore } from '@/store/aiSettingsStore'

/* ─── Simple Markdown renderer for AI output ─── */
const escapeHtml = (str: string): string =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const renderMarkdown = (text: string): string => {
  return text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, lang, code) =>
      `<pre class="ai-code-block"><code class="language-${lang || ''}">${escapeHtml(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h4 class="text-xs font-semibold mt-2 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-sm font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-sm font-bold mt-3 mb-1">$1</h2>')
    .replace(/^- (.+)$/gm, '<li class="ml-3">• $1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-3">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}

export const QueryEditorPage = () => {
  const { activeConnectionId, selectedDatabase, selectedCollection, getActiveConnection } = useConnectionStore()
  const activeConnection = getActiveConnection()
  const dbType = activeConnection?.type || 'mongodb'
  const isPostgreSQL = dbType === 'postgresql'
  const isRedis = dbType === 'redis'
  const isKafka = dbType === 'kafka'

  const { tabs, activeTabId, addTab: storeAddTab, closeTab: storeCloseTab, setActiveTab, updateTab: storeUpdateTab } = useQueryTabStore()

  // Ensure at least one tab exists (first mount or after clearing)
  useEffect(() => {
    if (tabs.length === 0) storeAddTab(dbType)
  }, [tabs.length, dbType, storeAddTab])
  const [showHistory, setShowHistory] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateVarDialog, setTemplateVarDialog] = useState<{ query: string; variables: string[] } | null>(null)
  const [templateVarValues, setTemplateVarValues] = useState<Record<string, string>>({})
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [queryName, setQueryName] = useState('')
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [schemaFields, setSchemaFields] = useState<string[]>([])
  const [collectionNames, setCollectionNames] = useState<string[]>([])
  const [showExplain, setShowExplain] = useState(false)
  const [explainPlan, setExplainPlan] = useState<any>(null)
  const [explainLoading, setExplainLoading] = useState(false)
  const [showOptimize, setShowOptimize] = useState(false)
  const [optimizeResult, setOptimizeResult] = useState('')
  const [optimizeLoading, setOptimizeLoading] = useState(false)
  const optimizeAbortRef = useRef<AbortController | null>(null)
  const tt = useToast()

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0]

  // Fetch collection/table names when database changes
  useEffect(() => {
    const fetchCollections = async () => {
      if (!activeConnectionId || !selectedDatabase) { setCollectionNames([]); return }
      try {
        const result = await databaseService.listCollections(activeConnectionId, selectedDatabase, dbType)
        if (result.success) {
          const names = (result.collections || result.tables || result.keys || result.topics || []).map((c: any) => typeof c === 'string' ? c : c.name || c.tableName || c)
          setCollectionNames(names)
        }
      } catch (e) { console.error('Failed to fetch collections:', e) }
    }
    fetchCollections()
  }, [activeConnectionId, selectedDatabase, dbType])

  // Fetch schema fields when collection changes
  useEffect(() => {
    const fetchSchema = async () => {
      if (!activeConnectionId || !selectedDatabase || !selectedCollection) { setSchemaFields([]); return }
      try {
        const result = await databaseService.getCollectionStats(activeConnectionId, selectedDatabase, selectedCollection, dbType)
        if (result.success) {
          // PostgreSQL returns columns array, MongoDB returns schema from sample docs
          const cols = result.columns || result.stats?.columns || result.schema?.columns || []
          if (cols.length > 0) {
            setSchemaFields(cols.map((c: any) => c.column_name || c.name || c))
          } else if (result.stats?.sampleFields) {
            setSchemaFields(result.stats.sampleFields)
          } else if (result.documents && result.documents.length > 0) {
            setSchemaFields(Object.keys(result.documents[0]))
          } else {
            setSchemaFields([])
          }
        }
      } catch (e) { console.error('Failed to fetch schema:', e) }
    }
    fetchSchema()
  }, [activeConnectionId, selectedDatabase, selectedCollection, dbType])

  const updateTab = useCallback((tabId: string, updates: Partial<import('@/store/queryTabStore').QueryTab>) => {
    storeUpdateTab(tabId, updates)
  }, [storeUpdateTab])

  const addTab = () => storeAddTab(dbType)

  const closeTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    storeCloseTab(tabId)
  }

  const executeQuery = async () => {
    if (!activeTab || !activeConnectionId || !selectedDatabase) {
      tt.warning('Please select a database first'); return
    }
    if (!isRedis && !isKafka && !selectedCollection) {
      tt.warning('Please select a collection/table first'); return
    }
    const tabId = activeTab.id
    const query = activeTab.query
    try {
      updateTab(tabId, { loading: true, error: undefined })
      const startTime = Date.now()
      let result: any
      if (isKafka) {
        const topic = selectedCollection || ''
        if (activeTab.kafkaMode === 'consume') {
          result = await databaseService.kafkaConsumeMessages(activeConnectionId, topic, 50, true)
        } else {
          try {
            const msg = JSON.parse(query)
            const messages = Array.isArray(msg) ? msg : [msg]
            result = await databaseService.kafkaProduceMessage(activeConnectionId, topic, messages)
          } catch { throw new Error('Invalid JSON message') }
        }
      } else if (isRedis) {
        result = await databaseService.executeQuery(activeConnectionId, selectedDatabase, selectedCollection || '', query)
      } else if (isPostgreSQL) {
        result = await databaseService.executeQuery(activeConnectionId, selectedDatabase, selectedCollection || '', query)
      } else {
        let queryInput: any
        try { queryInput = JSON.parse(query) } catch { throw new Error('Invalid JSON query') }
        result = await databaseService.executeQuery(activeConnectionId, selectedDatabase, selectedCollection || '', queryInput, { limit: 100 })
      }
      const execTime = Date.now() - startTime
      let formattedResults: any[]
      if (isKafka) {
        formattedResults = activeTab.kafkaMode === 'consume' ? (result.documents || []) : [{ status: 'Message sent successfully', ...result }]
      } else if (isRedis) {
        const r = result.result !== undefined ? result.result : result.value
        formattedResults = Array.isArray(r) ? r.map((v: any, i: number) => ({ index: i, value: v })) : [{ result: r }]
      } else {
        formattedResults = result.documents
      }
      updateTab(tabId, { results: formattedResults, executionTime: execTime, loading: false, error: undefined })
      await storageService.addQueryHistory({
        id: Date.now().toString(), query: isKafka ? `[${activeTab.kafkaMode}] ${query}` : query,
        database: selectedDatabase, collection: selectedCollection,
        executedAt: new Date().toISOString(), executionTime: execTime, resultCount: formattedResults?.length || 0,
      })
    } catch (err: any) {
      updateTab(tabId, { error: err.message || 'Failed to execute query', results: [], loading: false })
    }
  }

  const handleSaveQuery = async () => {
    if (!queryName.trim()) { tt.warning('Please enter a query name'); return }
    try {
      await storageService.saveQuery({
        id: Date.now().toString(), name: queryName, query: activeTab?.query as any,
        database: selectedDatabase, collection: selectedCollection,
        createdAt: new Date().toISOString() as any, updatedAt: new Date().toISOString() as any,
      } as any)
      tt.success('Query saved!'); setShowSaveDialog(false); setQueryName('')
    } catch { tt.error('Failed to save query') }
  }

  const handleSelectFromHistory = (historyQuery: string) => {
    if (activeTab) updateTab(activeTab.id, { query: historyQuery })
    setShowHistory(false)
  }

  const handleSelectTemplate = (query: string, variables?: string[]) => {
    if (!activeTab) return
    if (variables && variables.length > 0) {
      setTemplateVarDialog({ query, variables })
      setTemplateVarValues(Object.fromEntries(variables.map(v => [v, ''])))
    } else {
      updateTab(activeTab.id, { query })
      setShowTemplates(false)
    }
  }

  const handleApplyTemplateVars = () => {
    if (!activeTab || !templateVarDialog) return
    let q = templateVarDialog.query
    for (const [key, val] of Object.entries(templateVarValues)) {
      q = q.split(`{{${key}}}`).join(val || `{{${key}}}`)
    }
    updateTab(activeTab.id, { query: q })
    setTemplateVarDialog(null)
    setShowTemplates(false)
  }

  const handleExplain = async () => {
    if (!activeTab || !activeConnectionId || !selectedDatabase) {
      tt.warning('Please select a database first'); return
    }
    if (!selectedCollection) {
      tt.warning('Please select a collection/table first'); return
    }
    if (isRedis || isKafka) {
      tt.warning('Explain is not supported for this database type'); return
    }
    setExplainLoading(true)
    try {
      let queryInput: any
      if (isPostgreSQL) {
        queryInput = activeTab.query
      } else {
        try { queryInput = JSON.parse(activeTab.query) } catch { queryInput = {} }
      }
      const result = await databaseService.explainQuery(activeConnectionId, selectedDatabase, selectedCollection, queryInput, dbType)
      if (result.success) {
        setExplainPlan(result.explain)
        setShowExplain(true)
      } else {
        tt.error('Explain failed: ' + result.error)
      }
    } catch (err: any) {
      tt.error('Explain failed: ' + err.message)
    } finally {
      setExplainLoading(false)
    }
  }

  const handleOptimize = async () => {
    if (!activeTab || !activeConnectionId || !selectedDatabase) {
      tt.warning('Please select a database first'); return
    }
    if (!selectedCollection) {
      tt.warning('Please select a collection/table first'); return
    }
    if (isRedis || isKafka) {
      tt.warning('Optimize is not supported for this database type'); return
    }
    const { models, selectedModelId } = useAISettingsStore.getState()
    const model = models.find(m => m.id === selectedModelId) || models[0]
    if (!model) {
      tt.warning('No AI model configured. Go to Settings → AI Models to add one.'); return
    }

    setOptimizeLoading(true)
    setOptimizeResult('')
    setShowOptimize(true)

    try {
      // 1. Get explain plan
      let queryInput: any
      if (isPostgreSQL) {
        queryInput = activeTab.query
      } else {
        try { queryInput = JSON.parse(activeTab.query) } catch { queryInput = {} }
      }
      const explainResult = await databaseService.explainQuery(activeConnectionId, selectedDatabase, selectedCollection, queryInput, dbType)
      if (!explainResult.success) {
        setOptimizeResult(`❌ Failed to get explain plan: ${explainResult.error}`)
        setOptimizeLoading(false)
        return
      }

      // 2. Build AI prompt with query + explain plan
      const systemPrompt = `You are a database performance expert. Analyze the query and its execution plan, then provide specific optimization suggestions.

Format your response as:
## Performance Analysis
Brief summary of current performance.

## Issues Found
List specific performance issues (e.g., full table scan, missing indexes, inefficient joins).

## Optimization Suggestions
1. **Suggestion title** — Detailed explanation with exact code/command to implement.

## Optimized Query
If the query can be rewritten for better performance, provide the optimized version.

Be specific and actionable. Include exact CREATE INDEX commands or query rewrites.`

      const userPrompt = `Database: ${isPostgreSQL ? 'PostgreSQL' : 'MongoDB'}
Table/Collection: ${selectedCollection}
${schemaFields.length > 0 ? `Fields: ${schemaFields.join(', ')}` : ''}

Query:
${activeTab.query}

Execution Plan:
${JSON.stringify(explainResult.explain, null, 2)}`

      // 3. Stream AI response
      const controller = new AbortController()
      optimizeAbortRef.current = controller

      await aiService.chatStream(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model,
        (chunk) => {
          setOptimizeResult(prev => prev + chunk)
        },
        controller.signal
      )
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setOptimizeResult(prev => prev + `\n\n❌ Error: ${err.message}`)
      }
    } finally {
      setOptimizeLoading(false)
      optimizeAbortRef.current = null
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); executeQuery() }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); setShowSaveDialog(true) }
      if ((e.metaKey || e.ctrlKey) && e.key === 't') { e.preventDefault(); addTab() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') { e.preventDefault(); if (tabs.length > 1) closeTab(activeTabId) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <div className="flex h-full flex-col">
      {/* Tab Bar */}
      <div className="flex items-center bg-muted/50 min-h-[36px] border-b border-border">
        <div className="flex-1 flex items-center overflow-x-auto scrollbar-none gap-px pl-1 pt-1">
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                onDoubleClick={() => { setRenamingTabId(tab.id); setRenameValue(tab.name) }}
                className={`group relative flex items-center gap-1.5 px-3.5 py-[7px] text-[11px] font-medium cursor-pointer min-w-[110px] max-w-[200px] transition-all rounded-t-md ${
                  isActive
                    ? 'bg-background text-foreground border border-border border-b-transparent z-10'
                    : 'text-muted-foreground/70 hover:text-muted-foreground hover:bg-accent/60'
                }`}
              >
                {isActive && <span className="absolute top-0 left-2 right-2 h-[2px] bg-primary rounded-b" />}
                {renamingTabId === tab.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => { updateTab(tab.id, { name: renameValue || tab.name }); setRenamingTabId(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') { updateTab(tab.id, { name: renameValue || tab.name }); setRenamingTabId(null) } if (e.key === 'Escape') setRenamingTabId(null) }}
                    className="bg-transparent border-b border-primary outline-none text-[11px] w-full"
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className="truncate">{tab.name}</span>
                    {tab.loading && <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse shrink-0" />}
                  </>
                )}
                {tabs.length > 1 && (
                  <button onClick={e => closeTab(tab.id, e)} className="opacity-0 group-hover:opacity-100 shrink-0 hover:text-red-400 transition-opacity ml-auto">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <button onClick={addTab} className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 mr-1" title="New Tab (⌘T)">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-1 py-1.5 gap-2">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {selectedDatabase && <span className="px-1.5 py-0.5 rounded bg-muted">{selectedDatabase}</span>}
          {selectedCollection && <><span>›</span><span className="px-1.5 py-0.5 rounded bg-muted">{selectedCollection}</span></>}
        </div>
        <div className="flex gap-1">
          {isKafka && activeTab && (
            <div className="flex items-center rounded-md border overflow-hidden">
              <button onClick={() => updateTab(activeTab.id, { kafkaMode: 'consume' })}
                className={`px-2 py-1 text-[10px] font-medium ${activeTab.kafkaMode === 'consume' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>Consume</button>
              <button onClick={() => updateTab(activeTab.id, { kafkaMode: 'produce' })}
                className={`px-2 py-1 text-[10px] font-medium ${activeTab.kafkaMode === 'produce' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>Produce</button>
            </div>
          )}
          <button onClick={() => { setShowTemplates(!showTemplates); setShowHistory(false) }} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border hover:bg-accent transition-colors">
            <FileCode2 className="h-3 w-3" /> Templates
          </button>
          <button onClick={() => { setShowHistory(!showHistory); setShowTemplates(false) }} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border hover:bg-accent transition-colors">
            <History className="h-3 w-3" /> History
          </button>
          <button onClick={() => setShowSaveDialog(true)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border hover:bg-accent transition-colors">
            <Save className="h-3 w-3" /> Save (⌘S)
          </button>
          <button onClick={executeQuery} disabled={activeTab?.loading || !activeConnectionId}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            <Play className="h-3 w-3" /> {activeTab?.loading ? 'Running...' : 'Run (⌘↵)'}
          </button>
          {!isRedis && !isKafka && (
            <>
              <button onClick={handleExplain} disabled={explainLoading || !activeConnectionId}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-orange-500/50 text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-50">
                <FileSearch className="h-3 w-3" /> {explainLoading ? 'Analyzing...' : 'Explain'}
              </button>
              <button onClick={handleOptimize} disabled={optimizeLoading || !activeConnectionId}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-purple-500/50 text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-50">
                <Sparkles className="h-3 w-3" /> {optimizeLoading ? 'Optimizing...' : 'AI Optimize'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {!activeConnectionId || !selectedDatabase || (!isKafka && !selectedCollection) ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">Select a database and table/collection to start querying</p>
          </div>
        </div>
      ) : activeTab ? (
        <div className="flex-1 flex flex-col gap-2 overflow-hidden px-1 pb-1">
          <div className="flex-1 rounded-md border bg-card overflow-hidden min-h-[120px]">
            <MonacoQueryEditor value={activeTab.query} onChange={v => updateTab(activeTab.id, { query: v })} height="100%"
              language={isPostgreSQL ? 'sql' : isRedis ? 'redis' : 'javascript'}
              schemaFields={schemaFields} collectionNames={collectionNames} />
          </div>
          <div className="rounded-md border bg-card p-2 max-h-[45%] overflow-auto">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold">Results {activeTab.results.length > 0 && `(${activeTab.results.length})`}</span>
              {activeTab.executionTime !== undefined && <span className="text-[10px] text-muted-foreground">{activeTab.executionTime}ms</span>}
            </div>
            <QueryResults results={activeTab.results} executionTime={activeTab.executionTime} error={activeTab.error} />
          </div>
        </div>
      ) : null}

      {/* History Sidebar */}
      {showHistory && (
        <div className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-lg z-50 overflow-auto">
          <div className="p-3 border-b flex items-center justify-between sticky top-0 bg-background">
            <span className="text-xs font-semibold">Query History</span>
            <button onClick={() => setShowHistory(false)} className="p-1 rounded hover:bg-accent"><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className="p-3"><QueryHistory onSelectQuery={handleSelectFromHistory} /></div>
        </div>
      )}

      {/* Templates Sidebar */}
      {showTemplates && (
        <div className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-lg z-50 overflow-auto">
          <div className="p-3 border-b flex items-center justify-between sticky top-0 bg-background">
            <span className="text-xs font-semibold">Query Templates</span>
            <button onClick={() => setShowTemplates(false)} className="p-1 rounded hover:bg-accent"><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className="p-3">
            <QueryTemplates onSelectTemplate={handleSelectTemplate} dbType={dbType} currentQuery={activeTab?.query} />
          </div>
        </div>
      )}

      {/* Template Variable Dialog */}
      {templateVarDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-background rounded-lg p-5 w-96 border shadow-lg">
            <h2 className="text-sm font-semibold mb-1">Fill Template Variables</h2>
            <p className="text-[10px] text-muted-foreground mb-3">Replace placeholders with actual values</p>
            <div className="space-y-2 mb-4 max-h-60 overflow-auto">
              {templateVarDialog.variables.map(v => (
                <div key={v}>
                  <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">{`{{${v}}}`}</label>
                  <input value={templateVarValues[v] || ''} onChange={e => setTemplateVarValues(prev => ({ ...prev, [v]: e.target.value }))}
                    placeholder={v} className="w-full px-2 py-1.5 text-[11px] rounded-md border bg-muted/50 outline-none focus:ring-1 focus:ring-primary" />
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 justify-end">
              <button onClick={() => setTemplateVarDialog(null)} className="px-3 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent">Cancel</button>
              <button onClick={handleApplyTemplateVars} className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-5 w-80 border shadow-lg">
            <h2 className="text-sm font-semibold mb-3">Save Query</h2>
            <Input placeholder="Query name" value={queryName} onChange={e => setQueryName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveQuery() }} className="mb-3 text-[11px] h-8" />
            <div className="flex gap-1.5 justify-end">
              <button onClick={() => setShowSaveDialog(false)} className="px-3 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent">Cancel</button>
              <button onClick={handleSaveQuery} className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Explain Plan Modal */}
      {showExplain && explainPlan && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" onClick={() => setShowExplain(false)}>
          <div className="bg-background rounded-lg w-[800px] max-h-[80vh] flex flex-col border shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <FileSearch className="h-4 w-4 text-orange-400" />
                <h3 className="text-sm font-semibold">Query Execution Plan</h3>
                <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">{isPostgreSQL ? 'PostgreSQL' : 'MongoDB'}</span>
              </div>
              <button onClick={() => setShowExplain(false)} className="p-1 rounded hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <ExplainPlanTree plan={explainPlan} dbType={isPostgreSQL ? 'postgresql' : 'mongodb'} />
            </div>
          </div>
        </div>
      )}

      {/* AI Optimization Modal */}
      {showOptimize && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" onClick={() => { if (!optimizeLoading) setShowOptimize(false) }}>
          <div className="bg-background rounded-lg w-[900px] max-h-[85vh] flex flex-col border shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-semibold">AI Query Optimization</h3>
                <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">{isPostgreSQL ? 'PostgreSQL' : 'MongoDB'}</span>
                {optimizeLoading && (
                  <span className="flex items-center gap-1 text-[10px] text-purple-400">
                    <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
                    Analyzing...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {optimizeLoading && (
                  <button onClick={() => { optimizeAbortRef.current?.abort(); setOptimizeLoading(false) }}
                    className="px-2 py-1 text-[10px] font-medium rounded border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors">
                    Cancel
                  </button>
                )}
                {!optimizeLoading && optimizeResult && (
                  <button onClick={() => navigator.clipboard.writeText(optimizeResult).then(() => tt.success('Copied!'))}
                    className="px-2 py-1 text-[10px] font-medium rounded border hover:bg-accent transition-colors">
                    Copy
                  </button>
                )}
                <button onClick={() => { if (!optimizeLoading) setShowOptimize(false) }} disabled={optimizeLoading}
                  className="p-1 rounded hover:bg-accent disabled:opacity-50"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {optimizeResult ? (
                <div className="text-[12px] leading-relaxed ai-msg-content"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(optimizeResult) }} />
              ) : (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="h-5 w-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Analyzing query performance...</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Getting explain plan & sending to AI</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

