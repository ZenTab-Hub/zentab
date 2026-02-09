import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'

function ModalShell({ isOpen, onClose, title, children, width = 'max-w-md' }: {
  isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: string
}) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className={`${width} w-full mx-4 bg-background border border-border rounded-lg shadow-2xl`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

const IC = 'w-full h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const BP = 'h-8 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50'
const BD = 'h-8 px-4 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50'
const BS = 'h-8 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent disabled:opacity-50'

export function CreateDatabaseModal({ isOpen, onClose, onSubmit }: {
  isOpen: boolean; onClose: () => void; onSubmit: (name: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const go = async () => {
    if (!name.trim()) return
    setLoading(true)
    try { await onSubmit(name.trim()); setName(''); onClose() } catch {} finally { setLoading(false) }
  }
  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Create Database">
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium mb-1 block">Database Name</label>
          <input className={IC} value={name} onChange={e => setName(e.target.value)}
            placeholder="my_database" autoFocus onKeyDown={e => e.key === 'Enter' && go()} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className={BS} onClick={onClose}>Cancel</button>
          <button className={BP} onClick={go} disabled={!name.trim() || loading}>
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

export function ConfirmDropModal({ isOpen, onClose, onConfirm, itemType, itemName }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => Promise<void>; itemType: string; itemName: string
}) {
  const [loading, setLoading] = useState(false)
  const [ct, setCt] = useState('')
  const go = async () => {
    setLoading(true)
    try { await onConfirm(); setCt(''); onClose() } catch {} finally { setLoading(false) }
  }
  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={`Drop ${itemType}`}>
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">This action cannot be undone!</p>
            <p className="text-xs text-muted-foreground mt-1">
              This will permanently delete <strong>{itemName}</strong> and all its data.
            </p>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">
            Type <strong>{itemName}</strong> to confirm
          </label>
          <input className={IC} value={ct} onChange={e => setCt(e.target.value)}
            placeholder={itemName} onKeyDown={e => e.key === 'Enter' && ct === itemName && go()} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className={BS} onClick={onClose}>Cancel</button>
          <button className={BD} onClick={go} disabled={ct !== itemName || loading}>
            {loading ? 'Dropping...' : `Drop ${itemType}`}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

export function RenameModal({ isOpen, onClose, onSubmit, itemType, currentName }: {
  isOpen: boolean; onClose: () => void
  onSubmit: (newName: string) => Promise<void>
  itemType: string; currentName: string
}) {
  const [name, setName] = useState(currentName)
  const [loading, setLoading] = useState(false)
  const go = async () => {
    if (!name.trim() || name.trim() === currentName) return
    setLoading(true)
    try { await onSubmit(name.trim()); onClose() } catch {} finally { setLoading(false) }
  }
  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={`Rename ${itemType}`}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium mb-1 block">Current Name</label>
          <input className={`${IC} opacity-60`} value={currentName} disabled />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">New Name</label>
          <input className={IC} value={name} onChange={e => setName(e.target.value)}
            autoFocus onKeyDown={e => e.key === 'Enter' && go()} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className={BS} onClick={onClose}>Cancel</button>
          <button className={BP} onClick={go}
            disabled={!name.trim() || name.trim() === currentName || loading}>
            {loading ? 'Renaming...' : 'Rename'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

export function CreateCollectionModal({ isOpen, onClose, onSubmit, dbType }: {
  isOpen: boolean; onClose: () => void
  onSubmit: (name: string, options?: any) => Promise<void>
  dbType: string
}) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [capped, setCapped] = useState(false)
  const [size, setSize] = useState('1048576')
  const label = dbType === 'kafka' ? 'Topic' : dbType === 'mongodb' ? 'Collection' : 'Table'
  const go = async () => {
    if (!name.trim()) return
    setLoading(true)
    const opts = dbType === 'mongodb' && capped ? { capped: true, size: parseInt(size) || 1048576 } : undefined
    try { await onSubmit(name.trim(), opts); setName(''); setCapped(false); onClose() } catch {} finally { setLoading(false) }
  }
  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={`Create ${label}`}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium mb-1 block">{label} Name</label>
          <input className={IC} value={name} onChange={e => setName(e.target.value)}
            placeholder={dbType === 'mongodb' ? 'my_collection' : dbType === 'kafka' ? 'my_topic' : 'my_table'}
            autoFocus onKeyDown={e => e.key === 'Enter' && go()} />
        </div>
        {dbType === 'mongodb' && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={capped} onChange={e => setCapped(e.target.checked)}
                className="rounded border-input" />
              Capped Collection
            </label>
            {capped && (
              <div>
                <label className="text-xs font-medium mb-1 block">Max Size (bytes)</label>
                <input className={IC} value={size} onChange={e => setSize(e.target.value)}
                  placeholder="1048576" type="number" />
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button className={BS} onClick={onClose}>Cancel</button>
          <button className={BP} onClick={go} disabled={!name.trim() || loading}>
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

export function IndexManagerModal({ isOpen, onClose, indexes, onCreateIndex, onDropIndex, dbType }: {
  isOpen: boolean; onClose: () => void
  indexes: any[]
  onCreateIndex: (keys: Record<string, any>, options?: any) => Promise<void>
  onDropIndex: (indexName: string) => Promise<void>
  dbType: string
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [keyField, setKeyField] = useState('')
  const [keyDir, setKeyDir] = useState('1')
  const [indexName, setIndexName] = useState('')
  const [unique, setUnique] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropLoading, setDropLoading] = useState('')

  const handleCreate = async () => {
    if (!keyField.trim()) return
    setLoading(true)
    try {
      const keys = { [keyField.trim()]: parseInt(keyDir) }
      const opts: any = {}
      if (indexName.trim()) opts.name = indexName.trim()
      if (unique) opts.unique = true
      await onCreateIndex(keys, opts)
      setKeyField(''); setKeyDir('1'); setIndexName(''); setUnique(false); setShowCreate(false)
    } catch {} finally { setLoading(false) }
  }

  const handleDrop = async (name: string) => {
    if (name === '_id_') return
    setDropLoading(name)
    try { await onDropIndex(name) } catch {} finally { setDropLoading('') }
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Index Manager" width="max-w-lg">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{indexes.length} index(es)</span>
          <button className={BP} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : '+ New Index'}
          </button>
        </div>
        {showCreate && (
          <div className="p-3 rounded-md border border-border space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium mb-1 block">Field</label>
                <input className={IC} value={keyField} onChange={e => setKeyField(e.target.value)} placeholder="field_name" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Direction</label>
                <select className={IC} value={keyDir} onChange={e => setKeyDir(e.target.value)}>
                  <option value="1">Ascending (1)</option>
                  <option value="-1">Descending (-1)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Index Name (optional)</label>
              <input className={IC} value={indexName} onChange={e => setIndexName(e.target.value)} placeholder="auto-generated" />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={unique} onChange={e => setUnique(e.target.checked)} className="rounded border-input" />
              Unique
            </label>
            <div className="flex justify-end">
              <button className={BP} onClick={handleCreate} disabled={!keyField.trim() || loading}>
                {loading ? 'Creating...' : 'Create Index'}
              </button>
            </div>
          </div>
        )}
        <div className="max-h-60 overflow-y-auto space-y-1">
          {indexes.map((idx: any, i: number) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-accent/30 text-xs">
              <div className="flex-1 min-w-0">
                <span className="font-medium">{idx.name}</span>
                {idx.unique && <span className="ml-1 text-amber-500">(unique)</span>}
                <div className="text-muted-foreground truncate">
                  {dbType === 'mongodb' ? JSON.stringify(idx.key) : idx.definition || ''}
                </div>
              </div>
              {idx.name !== '_id_' && (
                <button className="p-1 rounded hover:bg-destructive/20 text-destructive shrink-0"
                  onClick={() => handleDrop(idx.name)} disabled={dropLoading === idx.name}>
                  {dropLoading === idx.name ? '...' : <X className="h-3 w-3" />}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </ModalShell>
  )
}

export { ModalShell, IC, BP, BD, BS }
