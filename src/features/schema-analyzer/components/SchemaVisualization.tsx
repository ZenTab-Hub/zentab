import { FileJson, Hash, Calendar, ToggleLeft, List } from 'lucide-react'

interface FieldInfo {
  name: string
  types: { [type: string]: number }
  totalCount: number
  nullCount: number
  uniqueValues?: number
  samples?: any[]
}

interface SchemaVisualizationProps {
  schema: { [field: string]: FieldInfo }
  totalDocuments: number
}

export const SchemaVisualization = ({ schema, totalDocuments }: SchemaVisualizationProps) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'string':
        return <FileJson className="h-4 w-4 text-blue-500" />
      case 'number':
        return <Hash className="h-4 w-4 text-green-500" />
      case 'boolean':
        return <ToggleLeft className="h-4 w-4 text-purple-500" />
      case 'date':
        return <Calendar className="h-4 w-4 text-orange-500" />
      case 'array':
        return <List className="h-4 w-4 text-pink-500" />
      case 'object':
        return <FileJson className="h-4 w-4 text-indigo-500" />
      default:
        return <FileJson className="h-4 w-4 text-gray-500" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
      case 'number':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
      case 'boolean':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
      case 'date':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
      case 'array':
        return 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300'
      case 'object':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  const fields = Object.entries(schema).sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold mb-2">Schema Overview</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Total Documents:</span>
            <span className="ml-2 font-semibold">{totalDocuments}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Total Fields:</span>
            <span className="ml-2 font-semibold">{fields.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Sample Size:</span>
            <span className="ml-2 font-semibold">{Math.min(totalDocuments, 1000)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {fields.map(([fieldName, fieldInfo]) => {
          const coverage = ((fieldInfo.totalCount / totalDocuments) * 100).toFixed(1)
          const types = Object.entries(fieldInfo.types).sort((a, b) => b[1] - a[1])
          const primaryType = types[0]?.[0] || 'unknown'

          return (
            <div key={fieldName} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getTypeIcon(primaryType)}
                  <span className="font-mono font-semibold">{fieldName}</span>
                </div>
                <div className="flex gap-2">
                  {types.map(([type, count]) => (
                    <span
                      key={type}
                      className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(type)}`}
                    >
                      {type} ({count})
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Coverage:</span>
                    <span className="ml-2 font-semibold">{coverage}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Present:</span>
                    <span className="ml-2">{fieldInfo.totalCount}</span>
                  </div>
                  {fieldInfo.nullCount > 0 && (
                    <div>
                      <span className="text-muted-foreground">Null:</span>
                      <span className="ml-2">{fieldInfo.nullCount}</span>
                    </div>
                  )}
                  {fieldInfo.uniqueValues !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Unique:</span>
                      <span className="ml-2">{fieldInfo.uniqueValues}</span>
                    </div>
                  )}
                </div>

                {/* Coverage bar */}
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary rounded-full h-2 transition-all"
                    style={{ width: `${coverage}%` }}
                  />
                </div>

                {/* Sample values */}
                {fieldInfo.samples && fieldInfo.samples.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-muted-foreground">Sample values:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {fieldInfo.samples.slice(0, 5).map((sample, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-muted rounded text-xs font-mono"
                        >
                          {typeof sample === 'object' ? JSON.stringify(sample) : String(sample)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

