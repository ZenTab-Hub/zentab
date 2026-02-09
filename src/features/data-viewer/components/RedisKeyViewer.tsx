import { useState, useEffect } from 'react'
import { Key, RefreshCw, Trash2, Clock, Copy, Edit, Save, X, Plus, HardDrive } from 'lucide-react'
import { Input } from '@/components/common/Input'
import { useConnectionStore } from '@/store/connectionStore'
import { databaseService } from '@/services/database.service'
import { useToast } from '@/components/common/Toast'
import { formatBytes } from '@/utils/formatters'

const TYPE_COLORS: Record<string, string> = {
  string: 'bg-green-500/15 text-green-400',
  hash: 'bg-blue-500/15 text-blue-400',
  list: 'bg-purple-500/15 text-purple-400',
  set: 'bg-amber-500/15 text-amber-400',
  zset: 'bg-pink-500/15 text-pink-400',
  unknown: 'bg-muted text-muted-foreground',
}

const KEY_TYPES = ['string', 'hash', 'list', 'set', 'zset'] as const

export const RedisKeyViewer = () => {
  const { activeConnectionId, selectedDatabase, selectedCollection, setSelectedCollection } = useConnectionStore()
  const tt = useToast()
  const [keyData, setKeyData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [editTTL, setEditTTL] = useState('')
  const [saving, setSaving] = useState(false)
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addField, setAddField] = useState('')
  const [addValue, setAddValue] = useState('')
  const [addScore, setAddScore] = useState('')
  // Create new key state
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyType, setNewKeyType] = useState<typeof KEY_TYPES[number]>('string')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [newKeyTTL, setNewKeyTTL] = useState('')
  const [creatingLoading, setCreatingLoading] = useState(false)

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
        setShowAddForm(false)
      }
      // Load memory usage
      try {
        const memResult = await databaseService.redisMemoryUsage(activeConnectionId, selectedDatabase, selectedCollection)
        if (memResult.success) setMemoryUsage(memResult.bytes)
        else setMemoryUsage(null)
      } catch { setMemoryUsage(null) }
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
      tt.error('Save failed: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    tt.confirm(`Delete key "${selectedCollection}"?`, async () => {
      if (!activeConnectionId || !selectedDatabase || !selectedCollection) return
      try {
        await databaseService.redisDeleteKey(activeConnectionId, selectedDatabase, selectedCollection)
        tt.success('Key deleted!')
        setKeyData(null)
      } catch (error: any) {
        tt.error('Delete failed: ' + error.message)
      }
    })
  }

  const copyValue = () => {
    if (!keyData) return
    const text = typeof keyData.value === 'string' ? keyData.value : JSON.stringify(keyData.value, null, 2)
    navigator.clipboard.writeText(text)
  }

  const handleAddItem = async () => {
    if (!activeConnectionId || !selectedDatabase || !selectedCollection || !keyData) return
    try {
      const score = addScore ? Number.parseFloat(addScore) : undefined
      const r = await databaseService.redisAddItem(activeConnectionId, selectedDatabase, selectedCollection, keyData.type, addField, addValue, score)
      if (r.success) {
        tt.success('Item added')
        setAddField(''); setAddValue(''); setAddScore(''); setShowAddForm(false)
        await loadKeyValue()
      } else { tt.error(r.error) }
    } catch (e: any) { tt.error(e.message) }
  }

  const handleRemoveItem = async (field: string, index?: number) => {
    if (!activeConnectionId || !selectedDatabase || !selectedCollection || !keyData) return
    tt.confirm(`Remove "${field}" from this key?`, async () => {
      try {
        const r = await databaseService.redisRemoveItem(activeConnectionId, selectedDatabase, selectedCollection, keyData.type, field, index)
        if (r.success) { tt.success('Item removed'); await loadKeyValue() }
        else { tt.error(r.error) }
      } catch (e: any) { tt.error(e.message) }
    })
  }

  const handleCreateKey = async () => {
    if (!activeConnectionId || !selectedDatabase) return
    if (!newKeyName.trim()) { tt.error('Key name is required'); return }
    try {
      setCreatingLoading(true)
      let value: any = newKeyValue
      if (newKeyType === 'hash') {
        try { value = newKeyValue ? JSON.parse(newKeyValue) : {} } catch { value = {} }
      } else if (newKeyType === 'list' || newKeyType === 'set') {
        try { value = newKeyValue ? JSON.parse(newKeyValue) : [] } catch { value = newKeyValue ? newKeyValue.split('\n').filter(Boolean) : [] }
      } else if (newKeyType === 'zset') {
        try { value = newKeyValue ? JSON.parse(newKeyValue) : [] } catch { value = [] }
      }
      const ttl = newKeyTTL ? parseInt(newKeyTTL) : undefined
      const result = await databaseService.redisSetKey(activeConnectionId, selectedDatabase, newKeyName.trim(), value, newKeyType, ttl)
      if (result.success) {
        tt.success(`Key "${newKeyName.trim()}" created!`)
        setCreating(false)
        setNewKeyName(''); setNewKeyValue(''); setNewKeyTTL(''); setNewKeyType('string')
        // Select the newly created key
        setSelectedCollection(newKeyName.trim())
      } else {
        tt.error(result.error || 'Failed to create key')
      }
    } catch (error: any) {
      tt.error('Create failed: ' + error.message)
    } finally {
      setCreatingLoading(false)
    }
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
            <div key={k} className="group flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/30 text-[11px] font-mono">
              <span className="text-blue-400 shrink-0 min-w-[100px]">{k}</span>
              <span className="text-muted-foreground">→</span>
              <span className="break-all flex-1">{String(v)}</span>
              <button onClick={() => handleRemoveItem(k)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 text-destructive transition-opacity" title="Remove field">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )
    }

    if (type === 'list' || type === 'set') {
      return (
        <div className="space-y-0.5">
          {(value || []).map((item: any, i: number) => (
            <div key={`${i}-${item}`} className="group flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/30 text-[11px] font-mono">
              <span className="text-muted-foreground shrink-0 w-8 text-right">{i}</span>
              <span className="break-all flex-1">{String(item)}</span>
              <button onClick={() => handleRemoveItem(String(item), i)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 text-destructive transition-opacity" title="Remove item">
                <X className="h-3 w-3" />
              </button>
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
          {pairs.map((p) => (
            <div key={p.member} className="group flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/30 text-[11px] font-mono">
              <span className="text-pink-400 shrink-0 w-16 text-right">{p.score}</span>
              <span className="text-muted-foreground">→</span>
              <span className="break-all flex-1">{p.member}</span>
              <button onClick={() => handleRemoveItem(p.member)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 text-destructive transition-opacity" title="Remove member">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )
    }

    return <pre className="text-[11px] font-mono">{JSON.stringify(value, null, 2)}</pre>
  }

  // Create new key form (full page)
  if (creating && !selectedCollection) {
    return (
      <div className="h-full flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Create New Key</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{selectedDatabase}</p>
          </div>
          <button onClick={() => setCreating(false)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors">
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
        <div className="rounded-md border bg-card p-4 space-y-4">
          {/* Key Name */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Key Name</label>
            <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="my:key:name"
              className="w-full px-3 py-2 text-[12px] font-mono rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary" autoFocus />
          </div>
          {/* Key Type */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Type</label>
            <div className="flex gap-1.5">
              {KEY_TYPES.map(t => (
                <button key={t} onClick={() => setNewKeyType(t)}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-md border transition-colors ${newKeyType === t ? TYPE_COLORS[t] + ' border-current' : 'hover:bg-accent'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {/* Value */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">
              Value {newKeyType === 'hash' && <span className="text-muted-foreground/60">(JSON object, e.g. {`{"field":"value"}`})</span>}
              {(newKeyType === 'list' || newKeyType === 'set') && <span className="text-muted-foreground/60">(JSON array or one item per line)</span>}
              {newKeyType === 'zset' && <span className="text-muted-foreground/60">(JSON array: ["member", score, ...])</span>}
            </label>
            <textarea value={newKeyValue} onChange={e => setNewKeyValue(e.target.value)}
              placeholder={newKeyType === 'string' ? 'Enter value...' : newKeyType === 'hash' ? '{"field1": "value1", "field2": "value2"}' : newKeyType === 'zset' ? '["member1", 1, "member2", 2]' : '["item1", "item2", "item3"]'}
              className="w-full h-32 px-3 py-2 text-[12px] font-mono rounded-md border bg-background resize-y focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          {/* TTL */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">TTL (seconds) <span className="text-muted-foreground/60">— leave empty for no expiry</span></label>
            <input value={newKeyTTL} onChange={e => setNewKeyTTL(e.target.value)} type="number" placeholder="No expiry"
              className="w-40 px-3 py-2 text-[12px] font-mono rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          {/* Submit */}
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreateKey} disabled={creatingLoading || !newKeyName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
              <Plus className="h-3.5 w-3.5" /> {creatingLoading ? 'Creating...' : 'Create Key'}
            </button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-[12px] font-medium rounded-md border hover:bg-accent transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Empty state - no key selected
  if (!selectedCollection) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Key className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground mb-3">Select a key from the sidebar to view its value</p>
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mx-auto">
            <Plus className="h-3.5 w-3.5" /> Create New Key
          </button>
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
          <button onClick={() => { setCreating(true); setSelectedCollection(null) }} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors" title="Create new key">
            <Plus className="h-3.5 w-3.5" />
            New Key
          </button>
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
          {memoryUsage !== null && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <HardDrive className="h-3 w-3" />
              <span>{formatBytes(memoryUsage)}</span>
            </div>
          )}
          {keyData.type !== 'string' && keyData.value && (
            <span className="text-[10px] text-muted-foreground">
              {Array.isArray(keyData.value) ? `${keyData.value.length} items` : typeof keyData.value === 'object' ? `${Object.keys(keyData.value).length} fields` : ''}
            </span>
          )}
          <div className="flex-1" />
          {keyData.type !== 'string' && (
            <button onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md border hover:bg-accent transition-colors">
              <Plus className="h-3 w-3" /> Add Item
            </button>
          )}
        </div>
      )}

      {/* Add Item Form */}
      {showAddForm && keyData && keyData.type !== 'string' && (
        <div className="rounded-md border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {(keyData.type === 'hash') && (
              <input value={addField} onChange={e => setAddField(e.target.value)} placeholder="Field name"
                className="px-2 py-1.5 text-[11px] font-mono rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary w-40" />
            )}
            <input value={addValue} onChange={e => setAddValue(e.target.value)}
              placeholder={keyData.type === 'hash' ? 'Value' : keyData.type === 'zset' ? 'Member' : 'Item value'}
              className="px-2 py-1.5 text-[11px] font-mono rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary flex-1 min-w-[150px]" />
            {keyData.type === 'zset' && (
              <input value={addScore} onChange={e => setAddScore(e.target.value)} placeholder="Score" type="number"
                className="px-2 py-1.5 text-[11px] font-mono rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary w-24" />
            )}
            <button onClick={handleAddItem} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="h-3 w-3" /> Add
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-2 py-1.5 text-[10px] rounded-md border hover:bg-accent transition-colors">
              Cancel
            </button>
          </div>
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

