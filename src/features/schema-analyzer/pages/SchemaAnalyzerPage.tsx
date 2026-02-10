import { useState } from 'react'
import { Search, Download, RefreshCw, Key, Radio } from 'lucide-react'
import { Input } from '@/components/common/Input'
import { SchemaVisualization } from '../components/SchemaVisualization'
import { useConnectionStore } from '@/store/connectionStore'
import { databaseService } from '@/services/database.service'
import { useToast } from '@/components/common/Toast'
import { TableSkeleton } from '@/components/common/Skeleton'
import { NoSchema, NoConnection } from '@/components/common/EmptyState'

interface FieldInfo {
  name: string
  types: { [type: string]: number }
  totalCount: number
  nullCount: number
  uniqueValues?: number
  samples?: any[]
}

export const SchemaAnalyzerPage = () => {
  const { activeConnectionId, selectedDatabase, selectedCollection, getActiveConnection } = useConnectionStore()
  const tt = useToast()
  const [schema, setSchema] = useState<{ [field: string]: FieldInfo } | null>(null)
  const [totalDocuments, setTotalDocuments] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sampleSize, setSampleSize] = useState('1000')

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
          <p className="text-sm font-medium mb-1">Schema Analysis Not Available</p>
          <p className="text-xs text-muted-foreground">
            Schema analysis is not supported for {dbType === 'redis' ? 'Redis' : 'Kafka'}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Use the <span className="font-medium text-primary">Query Editor</span> to explore your data
          </p>
        </div>
      </div>
    )
  }

  const analyzeSchema = async () => {
    if (!activeConnectionId || !selectedDatabase || !selectedCollection) {
      tt.warning('Please select a database and collection first')
      return
    }

    try {
      setLoading(true)
      const limit = parseInt(sampleSize) || 1000

      // Fetch sample documents
      const result = await databaseService.executeQuery(
        activeConnectionId,
        selectedDatabase,
        selectedCollection,
        {},
        { limit }
      )

      const documents = result.documents
      setTotalDocuments(result.totalCount)

      // Analyze schema
      const schemaMap: { [field: string]: FieldInfo } = {}

      documents.forEach((doc) => {
        analyzeDocument(doc, schemaMap, '')
      })

      setSchema(schemaMap)
    } catch (error: any) {
      tt.error('Failed to analyze schema: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const analyzeDocument = (obj: any, schemaMap: { [field: string]: FieldInfo }, prefix: string) => {
    Object.entries(obj).forEach(([key, value]) => {
      const fieldName = prefix ? `${prefix}.${key}` : key
      const type = getType(value)

      if (!schemaMap[fieldName]) {
        schemaMap[fieldName] = {
          name: fieldName,
          types: {},
          totalCount: 0,
          nullCount: 0,
          samples: [],
        }
      }

      const field = schemaMap[fieldName]
      field.totalCount++

      if (value === null || value === undefined) {
        field.nullCount++
      } else {
        field.types[type] = (field.types[type] || 0) + 1

        // Collect samples (max 10)
        if (field.samples && field.samples.length < 10) {
          if (type !== 'object' && type !== 'array') {
            field.samples.push(value)
          }
        }
      }

      // Recursively analyze nested objects (but not too deep)
      if (type === 'object' && prefix.split('.').length < 3) {
        analyzeDocument(value, schemaMap, fieldName)
      }
    })
  }

  const getType = (value: any): string => {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (Array.isArray(value)) return 'array'
    if (value instanceof Date) return 'date'
    if (typeof value === 'object') return 'object'
    if (typeof value === 'number') return 'number'
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'string') return 'string'
    return 'unknown'
  }

  const exportSchema = () => {
    if (!schema) {
      tt.warning('No schema to export. Please analyze first.')
      return
    }

    const schemaDoc = {
      database: selectedDatabase,
      collection: selectedCollection,
      analyzedAt: new Date().toISOString(),
      totalDocuments,
      sampleSize: parseInt(sampleSize),
      fields: schema,
    }

    const blob = new Blob([JSON.stringify(schemaDoc, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `schema-${selectedCollection}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Schema Analyzer</h1>
          {selectedDatabase && selectedCollection ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedDatabase} › {selectedCollection}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">Analyze schema and data types</p>
          )}
        </div>
        <div className="flex gap-1.5 items-center">
          {schema && (
            <button
              onClick={exportSchema}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          )}
          <Input
            type="number"
            placeholder="Sample size"
            value={sampleSize}
            onChange={(e) => setSampleSize(e.target.value)}
            className="w-24 text-[11px] h-7"
          />
          <button
            onClick={analyzeSchema}
            disabled={loading || !activeConnectionId}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      {!activeConnectionId || !selectedDatabase || !selectedCollection ? (
        <div className="flex-1 flex items-center justify-center">
          <NoConnection />
        </div>
      ) : loading ? (
        <div className="flex-1 p-4">
          <TableSkeleton rows={8} columns={4} />
        </div>
      ) : schema ? (
        <div className="flex-1 overflow-auto">
          <SchemaVisualization schema={schema} totalDocuments={totalDocuments} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <NoSchema collection={selectedCollection} onAnalyze={analyzeSchema} />
        </div>
      )}
    </div>
  )
}

