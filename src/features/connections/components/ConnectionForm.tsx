import { useState, useCallback, memo, startTransition } from 'react'
import { X, Database, Server, HardDrive, Layers, Radio } from 'lucide-react'
import type { DatabaseType } from '@/types'

/* ── Static class strings (no cn/twMerge at runtime) ─────────── */
const INPUT_CLS = 'flex h-8 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
const LABEL_CLS = 'block text-xs font-medium mb-1.5'
const BTN_PRIMARY_CLS = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors'
const BTN_OUTLINE_CLS = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium h-9 px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors'
const TAB_ACTIVE = 'flex-1 px-3 py-1.5 text-xs font-medium rounded bg-background shadow-sm text-foreground transition-colors duration-100'
const TAB_INACTIVE = 'flex-1 px-3 py-1.5 text-xs font-medium rounded text-muted-foreground hover:text-foreground transition-colors duration-100'
const DB_BTN_ON = 'flex items-center gap-2 px-3 py-2 rounded text-xs font-medium border bg-primary/10 border-primary/50 text-primary transition-colors duration-100'
const DB_BTN_OFF = 'flex items-center gap-2 px-3 py-2 rounded text-xs font-medium border bg-background border-transparent hover:bg-accent text-muted-foreground hover:text-foreground transition-colors duration-100'

/* ── Collapsible section style (GPU-accelerated grid rows) ───── */
const SECTION_OPEN = 'grid transition-[grid-template-rows,opacity] duration-200 ease-out'
const SECTION_STYLE_OPEN = { gridTemplateRows: '1fr', opacity: 1 } as const
const SECTION_STYLE_CLOSED = { gridTemplateRows: '0fr', opacity: 0, pointerEvents: 'none' as const } as const

/* ── Static config (never re-created) ─────────────────────────── */
const DB_TYPES: DatabaseType[] = ['mongodb', 'postgresql', 'redis', 'kafka', 'mysql', 'sqlite', 'mssql']

const DB_CONFIGS = {
  mongodb:    { label: 'MongoDB',    defaultPort: 27017, icon: Database,  color: 'text-green-500',  iconOn: 'h-3.5 w-3.5 text-primary', placeholder: 'mongodb://localhost:27017',       connStringExample: 'mongodb+srv://user:pass@cluster.mongodb.net/db' },
  postgresql: { label: 'PostgreSQL', defaultPort: 5432,  icon: Server,    color: 'text-blue-500',   iconOn: 'h-3.5 w-3.5 text-primary', placeholder: 'postgresql://localhost:5432/mydb', connStringExample: 'postgresql://user:pass@host:5432/database' },
  mysql:      { label: 'MySQL',      defaultPort: 3306,  icon: Server,    color: 'text-orange-500', iconOn: 'h-3.5 w-3.5 text-primary', placeholder: 'mysql://localhost:3306/mydb',      connStringExample: 'mysql://user:pass@host:3306/database' },
  sqlite:     { label: 'SQLite',     defaultPort: 0,     icon: HardDrive, color: 'text-gray-400',   iconOn: 'h-3.5 w-3.5 text-primary', placeholder: '/path/to/database.db',            connStringExample: '/path/to/database.db' },
  redis:      { label: 'Redis',      defaultPort: 6379,  icon: Layers,    color: 'text-red-500',    iconOn: 'h-3.5 w-3.5 text-primary', placeholder: 'redis://localhost:6379',           connStringExample: 'redis://user:pass@host:6379/0' },
  kafka:      { label: 'Kafka',      defaultPort: 9092,  icon: Radio,     color: 'text-amber-500',  iconOn: 'h-3.5 w-3.5 text-primary', placeholder: 'kafka://localhost:9092',           connStringExample: 'kafka://user:pass@broker1:9092,broker2:9092' },
  mssql:      { label: 'SQL Server', defaultPort: 1433,  icon: Server,    color: 'text-purple-500', iconOn: 'h-3.5 w-3.5 text-primary', placeholder: 'mssql://localhost:1433',           connStringExample: 'mssql://user:pass@host:1433/database' },
} as const

/* ── Supported DB types ──────────────────────────────────────── */
const SUPPORTED_TYPES = new Set<DatabaseType>(['mongodb', 'postgresql', 'redis', 'kafka'])
const DB_BTN_SOON = 'relative flex items-center gap-2 px-3 py-2 rounded text-xs font-medium border bg-background border-transparent text-muted-foreground/50 cursor-not-allowed transition-colors duration-100'

/* ── Memoised single DB-type button ───────────────────────────── */
const DbTypeButton = memo(({ type, selected, onSelect }: { type: DatabaseType; selected: boolean; onSelect: (t: DatabaseType) => void }) => {
  const cfg = DB_CONFIGS[type]
  const Icon = cfg.icon
  const comingSoon = !SUPPORTED_TYPES.has(type)
  return (
    <button
      type="button"
      onClick={() => !comingSoon && onSelect(type)}
      className={comingSoon ? DB_BTN_SOON : (selected ? DB_BTN_ON : DB_BTN_OFF)}
      disabled={comingSoon}
    >
      <Icon className={comingSoon ? 'h-3.5 w-3.5 text-muted-foreground/40' : (selected ? cfg.iconOn : `h-3.5 w-3.5 ${cfg.color}`)} />
      {cfg.label}
      {comingSoon && (
        <span className="absolute -top-1.5 -right-1 text-[8px] font-bold bg-yellow-500/20 text-yellow-600 px-1 py-0.5 rounded leading-none">
          SOON
        </span>
      )}
    </button>
  )
})
DbTypeButton.displayName = 'DbTypeButton'

/* ── Collapsible wrapper (GPU grid-rows animation) ────────────── */
const Collapsible = memo(({ open, children }: { open: boolean; children: React.ReactNode }) => (
  <div className={SECTION_OPEN} style={open ? SECTION_STYLE_OPEN : SECTION_STYLE_CLOSED}>
    <div style={{ overflow: 'hidden' }}>{children}</div>
  </div>
))
Collapsible.displayName = 'Collapsible'

/* ── Form data shape ──────────────────────────────────────────── */
interface FormFields { name: string; host: string; port: string; username: string; password: string; database: string; authDatabase: string }

/* ── Main component ───────────────────────────────────────────── */
interface ConnectionFormProps { onSubmit: (data: any) => void; onCancel: () => void; initialData?: any }

export const ConnectionForm = ({ onSubmit, onCancel, initialData }: ConnectionFormProps) => {
  const [dbType, setDbType] = useState<DatabaseType>(initialData?.type || 'mongodb')
  const [useConnStr, setUseConnStr] = useState(!!initialData?.connectionString?.trim())
  const [connStr, setConnStr] = useState(initialData?.connectionString || '')
  const [fields, setFields] = useState<FormFields>(() => ({
    name: initialData?.name || '',
    host: initialData?.host || '',
    port: initialData?.port != null ? String(initialData.port) : '',
    username: initialData?.username || '',
    password: initialData?.password || '',
    database: initialData?.database || '',
    authDatabase: initialData?.authDatabase || '',
  }))
  const [nameError, setNameError] = useState('')

  const cfg = DB_CONFIGS[dbType]
  const hasHostPort = dbType !== 'sqlite'
  const hasCreds = dbType !== 'sqlite'
  const hasAuthDb = dbType === 'mongodb'
  const hasConnStr = dbType !== 'sqlite' && dbType !== 'kafka'
  const hasDatabase = dbType !== 'kafka'

  /* Switch DB type — wrapped in startTransition so React keeps UI responsive */
  const handleDbTypeChange = useCallback((type: DatabaseType) => {
    startTransition(() => {
      setDbType(prev => {
        // update port only if user hasn't customised it
        const curDefault = String(DB_CONFIGS[prev]?.defaultPort || '')
        const newDefault = String(DB_CONFIGS[type].defaultPort)
        setFields(f => (f.port === '' || f.port === curDefault) ? { ...f, port: newDefault } : f)
        // If switching to a type that doesn't support connection string, reset to params
        const noConnStr = type === 'sqlite' || type === 'kafka'
        if (noConnStr) setUseConnStr(false)
        return type
      })
    })
  }, [])

  /* Fast field updater */
  const setField = useCallback((key: keyof FormFields, value: string) => {
    setFields(prev => prev[key] === value ? prev : { ...prev, [key]: value })
  }, [])

  const handleParamSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!fields.name.trim()) { setNameError('Name is required'); return }
    setNameError('')
    onSubmit({ name: fields.name, type: dbType, host: fields.host, port: Number(fields.port) || cfg.defaultPort, username: fields.username, password: fields.password, database: fields.database, authDatabase: fields.authDatabase })
  }, [fields, dbType, cfg.defaultPort, onSubmit])

  const handleConnStrSubmit = useCallback(() => {
    if (!fields.name.trim()) { setNameError('Name is required'); return }
    if (!connStr.trim()) return
    setNameError('')
    onSubmit({ name: fields.name, type: dbType, host: '', port: cfg.defaultPort, connectionString: connStr })
  }, [fields.name, connStr, dbType, cfg.defaultPort, onSubmit])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-lg bg-card border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-sidebar">
          <h2 className="text-sm font-semibold">{initialData ? 'Edit Connection' : 'New Connection'}</h2>
          <button onClick={onCancel} className="p-1 rounded hover:bg-accent transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* DB Type Selector */}
          <div>
            <span className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Database Type</span>
            <div className="grid grid-cols-3 gap-1.5">
              {DB_TYPES.map(t => <DbTypeButton key={t} type={t} selected={dbType === t} onSelect={handleDbTypeChange} />)}
            </div>
          </div>

          {/* Tab Toggle — only show if DB supports connection string */}
          {hasConnStr && (
            <div className="flex rounded-md border bg-sidebar p-0.5">
              <button type="button" onClick={() => setUseConnStr(false)} className={useConnStr ? TAB_INACTIVE : TAB_ACTIVE}>Parameters</button>
              <button type="button" onClick={() => setUseConnStr(true)} className={useConnStr ? TAB_ACTIVE : TAB_INACTIVE}>Connection String</button>
            </div>
          )}

          {useConnStr && hasConnStr ? (
            <div className="space-y-3">
              <div>
                <label className={LABEL_CLS}>Name</label>
                <input className={INPUT_CLS} placeholder={`My ${cfg.label}`} value={fields.name} onChange={e => setField('name', e.target.value)} />
                {nameError && <p className="mt-1 text-[11px] text-destructive">{nameError}</p>}
              </div>
              <div>
                <label className={LABEL_CLS}>Connection String</label>
                <input className={`${INPUT_CLS} font-mono`} placeholder={cfg.placeholder} value={connStr} onChange={e => setConnStr(e.target.value)} />
                <p className="mt-1 text-[11px] text-muted-foreground">e.g. {cfg.connStringExample}</p>
              </div>
            </div>
          ) : (
            <form id="connection-form" onSubmit={handleParamSubmit} className="space-y-3">
              <div>
                <label className={LABEL_CLS}>Name</label>
                <input className={INPUT_CLS} placeholder={`My ${cfg.label}`} value={fields.name} onChange={e => setField('name', e.target.value)} />
                {nameError && <p className="mt-1 text-[11px] text-destructive">{nameError}</p>}
              </div>

              <Collapsible open={hasHostPort}>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={LABEL_CLS}>Host</label>
                    <input className={INPUT_CLS} placeholder="localhost" value={fields.host} onChange={e => setField('host', e.target.value)} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Port</label>
                    <input type="number" className={INPUT_CLS} placeholder={String(cfg.defaultPort)} value={fields.port} onChange={e => setField('port', e.target.value)} />
                  </div>
                </div>
              </Collapsible>

              <Collapsible open={hasCreds}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>{dbType === 'redis' ? 'Username (ACL)' : 'Username'}</label>
                    <input className={INPUT_CLS} placeholder={dbType === 'redis' ? 'default' : 'admin'} value={fields.username} onChange={e => setField('username', e.target.value)} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Password</label>
                    <input type="password" className={INPUT_CLS} placeholder="••••••••" value={fields.password} onChange={e => setField('password', e.target.value)} />
                  </div>
                </div>
              </Collapsible>

              <Collapsible open={hasDatabase}>
                <div className={hasAuthDb ? 'grid grid-cols-2 gap-3' : ''}>
                  <div>
                    <label className={LABEL_CLS}>{dbType === 'sqlite' ? 'File Path' : dbType === 'redis' ? 'Database Index' : 'Database'}</label>
                    <input className={INPUT_CLS} placeholder={dbType === 'sqlite' ? '/path/to/db.sqlite' : dbType === 'redis' ? '0' : 'mydb'} value={fields.database} onChange={e => setField('database', e.target.value)} />
                  </div>
                  <Collapsible open={hasAuthDb}>
                    <div>
                      <label className={LABEL_CLS}>Auth Database</label>
                      <input className={INPUT_CLS} placeholder="admin" value={fields.authDatabase} onChange={e => setField('authDatabase', e.target.value)} />
                    </div>
                  </Collapsible>
                </div>
              </Collapsible>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t bg-sidebar">
          <button className={BTN_OUTLINE_CLS} onClick={onCancel}>Cancel</button>
          {useConnStr ? (
            <button className={BTN_PRIMARY_CLS} onClick={handleConnStrSubmit}>Save Connection</button>
          ) : (
            <button type="submit" form="connection-form" className={BTN_PRIMARY_CLS}>Save Connection</button>
          )}
        </div>
      </div>
    </div>
  )
}