import { useState, useEffect } from 'react'
import { Key, RefreshCw, Trash2, Clock, Copy, Edit, Save, X } from 'lucide-react'
import { Input } from '@/components/common/Input'
import { useConnectionStore } from '@/store/connectionStore'
import { databaseService } from '@/services/database.service'

const TYPE_COLORS: Record<string, string> = {
  string: 'bg-green-500/15 text-green-400',
  hash: 'bg-blue-500/15 text-blue-400',
  list: 'bg-purple-500/15 text-purple-400',
  set: 'bg-amber-500/15 text-amber-400',
  zset: 'bg-pink-500/15 text-pink-400',
  unknown: 'bg-muted text-muted-foreground',
}

export const RedisKeyViewer = () => {
  const { activeConnectionId, selectedDatabase, selectedCollection } = useConnectionStore()
  const [keyData, setKeyData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [editTTL, setEditTTL] = useState('')
  const [saving, setSaving] = useState(false)

  // Load key value when selection changes
  useEffect(() => {
    if (activeConnectionId && selectedDatabase && selectedCollection) {
      loadKeyValue()
    } else {
      setKeyData(null)
    }
  }, [activeConnectionId, selectedDatabase, selectedCollection])

  const loadKeyValue = async () => {
    if (!activeConnectionId || !selectedDatabase || !selectedCollection) return
    try {
      setLoading(true)
      const result = await databaseService.redisGetKeyValue(activeConnectionId, selectedDatabase, selectedCollection)
      if (result.success) {
        setKeyData(result)
        setEditing(false)
      }
    } catch (error) {
      console.error('Failed to load key value:', error)
    } finally {
      setLoading(false)
    }
  }

  const startEditing = () => {
    if (!keyData) return
    const val = keyData.type === 'string' ? (keyData.value || '') : JSON.stringify(keyData.value, null, 2)
    setEditValue(val)
    setEditTTL(keyData.ttl > 0 ? String(keyData.ttl) : '')
    setEditing(true)
  }

  const handleSave = async () => {
    if (!activeConnectionId || !selectedDatabase || !selectedCollection || !keyData) return
    try {
      setSaving(true)
      let value: any = editValue
      if (keyData.type !== 'string') {
        value = JSON.parse(editValue)
      }
      const ttl = editTTL ? parseInt(editTTL) : undefined
      await databaseService.redisSetKey(activeConnectionId, selectedDatabase, selectedCollection, value, keyData.type, ttl)
      setEditing(false)
      await loadKeyValue()
    } catch (error: any) {
      alert('Save failed: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete key "${selectedCollection}"?`)) return
    if (!activeConnectionId || !selectedDatabase || !selectedCollection) return
    try {
      await databaseService.redisDeleteKey(activeConnectionId, selectedDatabase, selectedCollection)
      alert('Key deleted!')
      setKeyData(null)
    } catch (error: any) {
      alert('Delete failed: ' + error.message)
    }
  }

  const copyValue = () => {
    if (!keyData) return
    const text = typeof keyData.value === 'string' ? keyData.value : JSON.stringify(keyData.value, null, 2)
    navigator.clipboard.writeText(text)
  }

  const formatTTL = (ttl: number) => {
    if (ttl === -1) return 'No expiry'
    if (ttl === -2) return 'Key not found'
    if (ttl < 60) return `${ttl}s`
    if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`
    if (ttl < 86400) return `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`
    return `${Math.floor(ttl / 86400)}d ${Math.floor((ttl % 86400) / 3600)}h`
  }

  const renderValue = () => {
    if (!keyData) return null
    const { type, value } = keyData

    if (type === 'string') {
      // Try to detect JSON string
      try {
        const parsed = JSON.parse(value)
        return <pre className="text-[11px] font-mono whitespace-pre-wrap break-all">{JSON.stringify(parsed, null, 2)}</pre>
      } catch {
        return <pre className="text-[11px] font-mono whitespace-pre-wrap break-all">{value}</pre>
      }
    }

    if (type === 'hash') {
      return (
        <div className="space-y-0.5">
          {Object.entries(value || {}).map(([k, v]) => (
            <div key={k} className="flex gap-2 py-1 px-2 rounded hover:bg-muted/30 text-[11px] font-mono">
              <span className="text-blue-400 shrink-0 min-w-[100px]">{k}</span>
              <span className="text-muted-foreground">→</span>
              <span className="break-all">{String(v)}</span>
            </div>
          ))}
        </div>
      )
    }

    if (type === 'list' || type === 'set') {
      return (
        <div className="space-y-0.5">
          {(value || []).map((item: any, i: number) => (
            <div key={i} className="flex gap-2 py-1 px-2 rounded hover:bg-muted/30 text-[11px] font-mono">
              <span className="text-muted-foreground shrink-0 w-8 text-right">{i}</span>
              <span className="break-all">{String(item)}</span>
            </div>
          ))}
        </div>
      )
    }

    if (type === 'zset') {
      // zset returns [member, score, member, score, ...]
      const pairs: Array<{ member: string; score: string }> = []
      for (let i = 0; i < (value || []).length; i += 2) {
        pairs.push({ member: value[i], score: value[i + 1] })
      }
      return (
        <div className="space-y-0.5">
          {pairs.map((p, i) => (
            <div key={i} className="flex gap-2 py-1 px-2 rounded hover:bg-muted/30 text-[11px] font-mono">
              <span className="text-pink-400 shrink-0 w-16 text-right">{p.score}</span>
              <span className="text-muted-foreground">→</span>
              <span className="break-all">{p.member}</span>
            </div>
          ))}
        </div>
      )
    }

    return <pre className="text-[11px] font-mono">{JSON.stringify(value, null, 2)}</pre>
  }

  // Empty state - no key selected
  if (!selectedCollection) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Key className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Select a key from the sidebar to view its value</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Key Viewer</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedDatabase} › <span className="font-mono">{selectedCollection}</span>
          </p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={copyValue} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors" title="Copy value">
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
          {!editing && (
            <button onClick={startEditing} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors">
              <Edit className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
          <button onClick={handleDelete} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          <button onClick={loadKeyValue} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Key Info Bar */}
      {keyData && (
        <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Key className="h-3 w-3 text-red-400" />
            <span className="text-[11px] font-mono font-medium">{keyData.key}</span>
          </div>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_COLORS[keyData.type] || TYPE_COLORS.unknown}`}>
            {keyData.type}
          </span>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>TTL: {formatTTL(keyData.ttl)}</span>
          </div>
          {keyData.type !== 'string' && keyData.value && (
            <span className="text-[10px] text-muted-foreground">
              {Array.isArray(keyData.value) ? `${keyData.value.length} items` : typeof keyData.value === 'object' ? `${Object.keys(keyData.value).length} fields` : ''}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto rounded-md border bg-card">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        ) : editing ? (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold">Edit Value</span>
              <div className="flex gap-1.5">
                <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border hover:bg-accent transition-colors">
                  <X className="h-3 w-3" /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                  <Save className="h-3 w-3" /> {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full h-64 p-2 text-[11px] font-mono rounded-md border bg-background resize-y focus:outline-none focus:ring-1 focus:ring-primary"
              spellCheck={false}
            />
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-muted-foreground">TTL (seconds):</label>
              <Input
                type="number"
                placeholder="No expiry"
                value={editTTL}
                onChange={(e) => setEditTTL(e.target.value)}
                className="w-32 text-[11px] h-7"
              />
            </div>
          </div>
        ) : keyData ? (
          <div className="p-3">
            {renderValue()}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-muted-foreground">Key not found</p>
          </div>
        )}
      </div>
    </div>
  )
}

