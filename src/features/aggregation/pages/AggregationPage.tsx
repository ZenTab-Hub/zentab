import { useState } from 'react'
import { Plus, Play, Code, BookOpen, Key, Radio } from 'lucide-react'
import { PipelineStage } from '../components/PipelineStage'
import { PipelinePreview } from '../components/PipelinePreview'
import { useConnectionStore } from '@/store/connectionStore'
import { databaseService } from '@/services/database.service'

interface Stage {
  id: string
  type: string
  content: string
}

export const AggregationPage = () => {
  const { activeConnectionId, selectedDatabase, selectedCollection, getActiveConnection } = useConnectionStore()
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
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          {dbType === 'redis' ? (
            <Key className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          ) : (
            <Radio className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          )}
          <p className="text-sm font-medium mb-1">Aggregation Not Available</p>
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

  const addStage = () => {
    const newStage: Stage = {
      id: Date.now().toString(),
      type: '$match',
      content: '{}',
    }
    setStages([...stages, newStage])
  }

  const updateStage = (id: string, content: string) => {
    setStages(stages.map((stage) => (stage.id === id ? { ...stage, content } : stage)))
  }

  const deleteStage = (id: string) => {
    if (stages.length === 1) {
      alert('Pipeline must have at least one stage')
      return
    }
    setStages(stages.filter((stage) => stage.id !== id))
  }

  const duplicateStage = (id: string) => {
    const stage = stages.find((s) => s.id === id)
    if (stage) {
      const newStage: Stage = {
        id: Date.now().toString(),
        type: stage.type,
        content: stage.content,
      }
      const index = stages.findIndex((s) => s.id === id)
      const newStages = [...stages]
      newStages.splice(index + 1, 0, newStage)
      setStages(newStages)
    }
  }

  const runPipeline = async () => {
    if (!activeConnectionId || !selectedDatabase || !selectedCollection) {
      alert('Please select a database and collection first')
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
    <div className="flex h-full flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Aggregation Pipeline</h1>
          {selectedDatabase && selectedCollection && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedDatabase} › {selectedCollection}
            </p>
          )}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowCode(!showCode)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors"
          >
            <Code className="h-3.5 w-3.5" />
            {showCode ? 'Hide' : 'Show'} Code
          </button>
          <button
            onClick={addStage}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Stage
          </button>
          <button
            onClick={runPipeline}
            disabled={loading || !activeConnectionId}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            {loading ? 'Running...' : 'Run Pipeline'}
          </button>
        </div>
      </div>

      {!activeConnectionId || !selectedDatabase || !selectedCollection ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              Select a database and table/collection to build pipelines
            </p>
          </div>
        </div>
      ) : (
        <>
          {showCode && (
            <div className="rounded-md border bg-card p-3">
              <span className="text-[11px] font-semibold mb-1.5 block">Generated Code</span>
              <pre className="bg-muted/50 p-3 rounded text-[11px] overflow-x-auto">
                {generateCode()}
              </pre>
            </div>
          )}

          <div className="flex flex-1 gap-3 overflow-hidden">
            <div className="w-1/2 flex flex-col gap-3 overflow-auto">
              <div className="rounded-md border bg-card p-3">
                <span className="text-[11px] font-semibold mb-2 block">Pipeline Stages</span>
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

            <div className="w-1/2 rounded-md border bg-card p-3 overflow-auto">
              <span className="text-[11px] font-semibold mb-2 block">Results Preview</span>
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

