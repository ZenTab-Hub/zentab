import { useState, useCallback } from 'react'
import { Plus, Play, Code, BookOpen, Key, Radio } from 'lucide-react'
import { PipelineStage } from '../components/PipelineStage'
import { PipelinePreview } from '../components/PipelinePreview'
import { useConnectionStore } from '@/store/connectionStore'
import { databaseService } from '@/services/database.service'
import { useToast } from '@/components/common/Toast'

interface Stage {
  id: string
  type: string
  content: string
}

export const AggregationPage = () => {
  const { activeConnectionId, selectedDatabase, selectedCollection, getActiveConnection } = useConnectionStore()
  const tt = useToast()
  const [stages, setStages] = useState<Stage[]>([
    { id: '1', type: '$match', content: '{}' },
  ])
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [showCode, setShowCode] = useState(false)

  const activeConnection = getActiveConnection()
  const dbType = activeConnection?.type || 'mongodb'

  // Not supported for Redis and Kafka
  if (dbType === 'redis' || dbType === 'kafka') {
    return (
      <div className="h-full flex items-center justify-center animate-fade-in">
        <div className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-2xl bg-muted/50 w-fit">
            {dbType === 'redis' ? (
              <Key className="h-8 w-8 text-muted-foreground/50" />
            ) : (
              <Radio className="h-8 w-8 text-muted-foreground/50" />
            )}
          </div>
          <p className="text-sm font-semibold mb-1">Aggregation Not Available</p>
          <p className="text-xs text-muted-foreground">
            Aggregation pipelines are not supported for {dbType === 'redis' ? 'Redis' : 'Kafka'}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Use the <span className="font-medium text-primary">Query Editor</span> to run commands
          </p>
        </div>
      </div>
    )
  }

  const addStage = useCallback(() => {
    const newStage: Stage = {
      id: crypto.randomUUID(),
      type: '$match',
      content: '{}',
    }
    setStages(prev => [...prev, newStage])
  }, [])

  const updateStage = useCallback((id: string, content: string) => {
    setStages(prev => prev.map((stage) => (stage.id === id ? { ...stage, content } : stage)))
  }, [])

  const deleteStage = useCallback((id: string) => {
    setStages(prev => {
      if (prev.length === 1) {
        tt.warning('Pipeline must have at least one stage')
        return prev
      }
      return prev.filter((stage) => stage.id !== id)
    })
  }, [tt])

  const duplicateStage = useCallback((id: string) => {
    setStages(prev => {
      const stage = prev.find((s) => s.id === id)
      if (!stage) return prev
      const newStage: Stage = {
        id: crypto.randomUUID(),
        type: stage.type,
        content: stage.content,
      }
      const index = prev.findIndex((s) => s.id === id)
      const newStages = [...prev]
      newStages.splice(index + 1, 0, newStage)
      return newStages
    })
  }, [])

  const runPipeline = async () => {
    if (!activeConnectionId || !selectedDatabase || !selectedCollection) {
      tt.warning('Please select a database and collection first')
      return
    }

    try {
      setLoading(true)
      setError(undefined)

      // Build pipeline array
      const pipeline = stages.map((stage) => {
        try {
          const content = JSON.parse(stage.content)
          return { [stage.type]: content }
        } catch (e) {
          throw new Error(`Invalid JSON in stage: ${stage.type}`)
        }
      })

      // Execute aggregation
      const result = await databaseService.aggregate(
        activeConnectionId,
        selectedDatabase,
        selectedCollection,
        pipeline
      )

      setResults(result)
    } catch (err: any) {
      setError(err.message || 'Failed to execute pipeline')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const generateCode = () => {
    const pipeline = stages.map((stage) => {
      try {
        const content = JSON.parse(stage.content)
        return { [stage.type]: content }
      } catch (e) {
        return { [stage.type]: {} }
      }
    })

    return `db.${selectedCollection || 'collection'}.aggregate(${JSON.stringify(pipeline, null, 2)})`
  }

  return (
    <div className="flex h-full flex-col gap-3 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Aggregation Pipeline</h1>
          {selectedDatabase && selectedCollection && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-medium">{selectedDatabase}</span> <span className="text-muted-foreground/40">›</span> <span className="font-medium">{selectedCollection}</span>
            </p>
          )}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowCode(!showCode)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border hover:bg-accent transition-all duration-150 active:scale-[0.97]"
          >
            <Code className="h-3.5 w-3.5" />
            {showCode ? 'Hide' : 'Show'} Code
          </button>
          <button
            onClick={addStage}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border hover:bg-accent transition-all duration-150 active:scale-[0.97]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Stage
          </button>
          <button
            onClick={runPipeline}
            disabled={loading || !activeConnectionId}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            {loading ? 'Running...' : 'Run Pipeline'}
          </button>
        </div>
      </div>

      {!activeConnectionId || !selectedDatabase || !selectedCollection ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center animate-fade-in">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-xs text-muted-foreground">
              Select a database and table/collection to build pipelines
            </p>
          </div>
        </div>
      ) : (
        <>
          {showCode && (
            <div className="rounded-xl border bg-card p-3 animate-slide-up">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Generated Code</span>
              <pre className="bg-muted/50 p-3 rounded-lg text-[11px] overflow-x-auto font-mono leading-relaxed">
                {generateCode()}
              </pre>
            </div>
          )}

          <div className="flex flex-1 gap-3 overflow-hidden">
            <div className="w-1/2 flex flex-col gap-3 overflow-auto">
              <div className="rounded-xl border bg-card p-3 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pipeline Stages</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">{stages.length}</span>
                  <div className="flex-1 h-px bg-border/30" />
                </div>
                <div className="space-y-3">
                  {stages.map((stage, index) => (
                    <PipelineStage
                      key={stage.id}
                      stage={stage}
                      index={index}
                      onUpdate={updateStage}
                      onDelete={deleteStage}
                      onDuplicate={duplicateStage}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="w-1/2 rounded-xl border bg-card p-3 overflow-auto shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Results Preview</span>
                {results.length > 0 && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">{results.length}</span>}
                <div className="flex-1 h-px bg-border/30" />
              </div>
              <PipelinePreview
                results={results}
                loading={loading}
                error={error}
                onRefresh={runPipeline}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

