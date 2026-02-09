import { useState } from 'react'
import { X, Trash2, Pencil, AlertTriangle, Play, Eye } from 'lucide-react'
import { databaseService } from '@/services/database.service'
import { useToast } from '@/components/common/Toast'

type BatchMode = 'update' | 'delete'

/** Parse simple "key = value" lines into a filter object for PostgreSQL */
function parsePostgresFilter(str: string): Record<string, any> {
  const filter: Record<string, any> = {}
  for (const line of str.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    // Try to parse as number/boolean, otherwise keep as string
    if (val === 'true') filter[key] = true
    else if (val === 'false') filter[key] = false
    else if (val === 'null') filter[key] = null
    else if (!isNaN(Number(val)) && val !== '') filter[key] = Number(val)
    else filter[key] = val
  }
  return filter
}

interface BatchOperationsProps {
  connectionId: string
  database: string
  collection: string
  dbType: string
  onClose: () => void
  onSuccess: () => void
}

export const BatchOperations = ({ connectionId, database, collection, dbType, onClose, onSuccess }: BatchOperationsProps) => {
  const tt = useToast()
  const [mode, setMode] = useState<BatchMode>('delete')
  const [filterStr, setFilterStr] = useState(dbType === 'postgresql' ? '' : '{}')
  const [updateStr, setUpdateStr] = useState('{}')
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const isMongo = dbType === 'mongodb'

  const handlePreview = async () => {
    setPreviewLoading(true)
    setResult(null)
    try {
      let filter: any
      if (isMongo) {
        filter = JSON.parse(filterStr)
      } else {
        // For PostgreSQL, convert simple key=value to object
        filter = filterStr.trim() ? parsePostgresFilter(filterStr) : {}
      }
      const res = await databaseService.countDocuments(connectionId, database, collection, filter, dbType as any)
      if (res.success) {
        setPreviewCount(res.count)
      } else {
        tt.error(res.error || 'Failed to count')
      }
    } catch (e: any) {
      tt.error(`Invalid filter: ${e.message}`)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleExecute = async () => {
    if (previewCount === null) { tt.warning('Preview first to see matching count'); return }
    if (previewCount === 0) { tt.warning('No documents match the filter'); return }
    setExecuting(true)
    setResult(null)
    try {
      let filter: any
      if (isMongo) {
        filter = JSON.parse(filterStr)
      } else {
        filter = filterStr.trim() ? parsePostgresFilter(filterStr) : {}
      }

      if (mode === 'delete') {
        const res = await databaseService.deleteMany(connectionId, database, collection, filter, dbType as any)
        if (res.success) {
          setResult(`✅ Deleted ${res.deletedCount} document(s)`)
          tt.success(`Deleted ${res.deletedCount} document(s)`)
          onSuccess()
        } else {
          setResult(`❌ ${res.error}`)
          tt.error(res.error)
        }
      } else {
        const update = JSON.parse(updateStr)
        const res = await databaseService.updateMany(connectionId, database, collection, filter, update, dbType as any)
        if (res.success) {
          setResult(`✅ Updated ${res.modifiedCount} of ${res.matchedCount} matched document(s)`)
          tt.success(`Updated ${res.modifiedCount} document(s)`)
          onSuccess()
        } else {
          setResult(`❌ ${res.error}`)
          tt.error(res.error)
        }
      }
    } catch (e: any) {
      tt.error(`Error: ${e.message}`)
      setResult(`❌ ${e.message}`)
    } finally {
      setExecuting(false)
      setPreviewCount(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={onClose} onKeyDown={e => { if (e.key === 'Escape') onClose() }}>
      <div className="bg-background border rounded-lg w-[600px] max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()} role="dialog">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Batch Operations — {collection}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b">
          <button onClick={() => { setMode('delete'); setResult(null); setPreviewCount(null) }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${mode === 'delete' ? 'border-b-2 border-red-500 text-red-500' : 'text-muted-foreground hover:text-foreground'}`}>
            <Trash2 className="h-3.5 w-3.5" /> Bulk Delete
          </button>
          <button onClick={() => { setMode('update'); setResult(null); setPreviewCount(null) }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${mode === 'update' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-muted-foreground hover:text-foreground'}`}>
            <Pencil className="h-3.5 w-3.5" /> Bulk Update
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {/* Filter */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
              {isMongo ? 'Filter (JSON)' : 'Filter (column = value, one per line)'}
            </label>
            <textarea value={filterStr} onChange={e => { setFilterStr(e.target.value); setPreviewCount(null) }}
              className="w-full h-20 bg-muted/30 border rounded-md px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={isMongo ? '{ "status": "inactive" }' : 'status = inactive\nage > 30'} />
          </div>

          {/* Update fields (only for update mode) */}
          {mode === 'update' && (
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                {isMongo ? 'Update Fields (JSON — will be wrapped in $set)' : 'Update Fields (JSON)'}
              </label>
              <textarea value={updateStr} onChange={e => setUpdateStr(e.target.value)}
                className="w-full h-20 bg-muted/30 border rounded-md px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder='{ "status": "archived" }' />
            </div>
          )}

          {/* Preview */}
          {previewCount !== null && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs ${previewCount > 0 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-muted/30 text-muted-foreground'}`}>
              <AlertTriangle className="h-3.5 w-3.5" />
              <span><strong>{previewCount}</strong> document(s) match this filter</span>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="px-3 py-2 rounded-md text-xs bg-muted/30">{result}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
          <button onClick={handlePreview} disabled={previewLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-accent transition-colors disabled:opacity-50">
            <Eye className="h-3.5 w-3.5" /> {previewLoading ? 'Counting...' : 'Preview'}
          </button>
          <button onClick={handleExecute} disabled={executing || previewCount === null || previewCount === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${mode === 'delete' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            <Play className="h-3.5 w-3.5" /> {executing ? 'Executing...' : mode === 'delete' ? 'Delete All' : 'Update All'}
          </button>
        </div>
      </div>
    </div>
  )
}

