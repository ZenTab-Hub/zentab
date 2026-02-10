import { useState, useCallback, useMemo, memo, startTransition } from 'react'
import { X, Database, Server, HardDrive, Layers, Radio, Shield } from 'lucide-react'
import type { DatabaseType } from '@/types'

/* ── Static class strings (no cn/twMerge at runtime) ─────────── */
const INPUT_CLS = 'flex h-8 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
const LABEL_CLS = 'block text-xs font-medium mb-1.5 text-muted-foreground'
const BTN_PRIMARY_CLS = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors'
const BTN_OUTLINE_CLS = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium h-9 px-4 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors'
const TAB_ACTIVE = 'flex-1 px-3 py-1.5 text-xs font-medium rounded-md bg-background shadow-sm text-foreground transition-all duration-150'
const TAB_INACTIVE = 'flex-1 px-3 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground transition-all duration-150'

/* ── Collapsible section style (GPU-accelerated grid rows) ───── */
const SECTION_OPEN = 'grid transition-[grid-template-rows,opacity] duration-200 ease-out'
const SECTION_STYLE_OPEN = { gridTemplateRows: '1fr', opacity: 1 } as const
const SECTION_STYLE_CLOSED = { gridTemplateRows: '0fr', opacity: 0, pointerEvents: 'none' as const } as const

/* ── Static config (never re-created) ─────────────────────────── */
const DB_CONFIGS = {
  mongodb:    { label: 'MongoDB',    defaultPort: 27017, icon: Database,  color: 'text-green-500',  bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30', placeholder: 'mongodb://localhost:27017',       connStringExample: 'mongodb+srv://user:pass@cluster.mongodb.net/db' },
  postgresql: { label: 'PostgreSQL', defaultPort: 5432,  icon: Server,    color: 'text-blue-500',   bgColor: 'bg-blue-500/10',  borderColor: 'border-blue-500/30',  placeholder: 'postgresql://localhost:5432/mydb', connStringExample: 'postgresql://user:pass@host:5432/database' },
  mysql:      { label: 'MySQL',      defaultPort: 3306,  icon: Server,    color: 'text-orange-500', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30', placeholder: 'mysql://localhost:3306/mydb',      connStringExample: 'mysql://user:pass@host:3306/database' },
  sqlite:     { label: 'SQLite',     defaultPort: 0,     icon: HardDrive, color: 'text-gray-400',   bgColor: 'bg-gray-500/10',  borderColor: 'border-gray-500/30',  placeholder: '/path/to/database.db',            connStringExample: '/path/to/database.db' },
  redis:      { label: 'Redis',      defaultPort: 6379,  icon: Layers,    color: 'text-red-500',    bgColor: 'bg-red-500/10',   borderColor: 'border-red-500/30',   placeholder: 'redis://localhost:6379',           connStringExample: 'redis://user:pass@host:6379/0' },
  kafka:      { label: 'Kafka',      defaultPort: 9092,  icon: Radio,     color: 'text-amber-500',  bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30', placeholder: 'kafka://localhost:9092',           connStringExample: 'kafka://user:pass@broker1:9092,broker2:9092' },
  mssql:      { label: 'SQL Server', defaultPort: 1433,  icon: Server,    color: 'text-purple-500', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30', placeholder: 'mssql://localhost:1433',           connStringExample: 'mssql://user:pass@host:1433/database' },
} as const

/* ── Grouped DB types ──────────────────────────────────────────── */
const DB_GROUPS: { label: string; types: DatabaseType[]; color: string; bg: string; border: string }[] = [
  { label: 'NoSQL',          types: ['mongodb'],                                  color: 'text-emerald-400', bg: 'bg-emerald-500/[0.04]', border: 'border-emerald-500/15' },
  { label: 'SQL',            types: ['postgresql', 'mysql', 'sqlite', 'mssql'],   color: 'text-blue-400',    bg: 'bg-blue-500/[0.04]',    border: 'border-blue-500/15' },
  { label: 'Stream & Cache', types: ['redis', 'kafka'],                           color: 'text-amber-400',   bg: 'bg-amber-500/[0.04]',   border: 'border-amber-500/15' },
]

/* ── Supported DB types ──────────────────────────────────────── */
const SUPPORTED_TYPES = new Set<DatabaseType>(['mongodb', 'postgresql', 'redis', 'kafka'])

/* ── Memoised single DB-type button ───────────────────────────── */
const DbTypeButton = memo(({ type, selected, onSelect }: { type: DatabaseType; selected: boolean; onSelect: (t: DatabaseType) => void }) => {
  const cfg = DB_CONFIGS[type]
  const Icon = cfg.icon
  const comingSoon = !SUPPORTED_TYPES.has(type)
  return (
    <button
      type="button"
      onClick={() => !comingSoon && onSelect(type)}
      disabled={comingSoon}
      className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-150 ${
        comingSoon
          ? 'bg-muted/30 border-transparent text-muted-foreground/40 cursor-not-allowed'
          : selected
            ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.color} shadow-sm`
            : 'bg-background border-transparent hover:bg-accent text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${comingSoon ? 'text-muted-foreground/30' : cfg.color}`} />
      {cfg.label}
      {comingSoon && (
        <span className="absolute -top-1.5 -right-1 text-[7px] font-bold bg-yellow-500/20 text-yellow-600 px-1 py-0.5 rounded leading-none">
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
interface SSHFields { enabled: boolean; host: string; port: string; username: string; password: string; privateKey: string }

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
  const [ssh, setSSH] = useState<SSHFields>(() => ({
    enabled: initialData?.sshTunnel?.enabled || false,
    host: initialData?.sshTunnel?.host || '',
    port: initialData?.sshTunnel?.port ? String(initialData.sshTunnel.port) : '22',
    username: initialData?.sshTunnel?.username || '',
    password: initialData?.sshTunnel?.password || '',
    privateKey: initialData?.sshTunnel?.privateKey || '',
  }))
  const [sshAuthMode, setSSHAuthMode] = useState<'password' | 'privateKey'>(initialData?.sshTunnel?.privateKey ? 'privateKey' : 'password')

  // Kafka-specific state
  const [kafkaSASL, setKafkaSASL] = useState<'none' | 'plain' | 'scram-sha-256' | 'scram-sha-512'>(() => {
    const cs = initialData?.connectionString || ''
    if (cs.includes('+sasl_scram512')) return 'scram-sha-512'
    if (cs.includes('+sasl_scram256')) return 'scram-sha-256'
    if (cs.includes('+sasl_plain')) return 'plain'
    if (initialData?.username && initialData?.type === 'kafka') return 'plain'
    return 'none'
  })
  const [kafkaSSL, setKafkaSSL] = useState(() => {
    const cs = initialData?.connectionString || ''
    if (cs.includes('+ssl')) return true
    return initialData?.ssl === true
  })

  const setSSHField = useCallback((key: keyof SSHFields, value: string | boolean) => {
    setSSH(prev => prev[key] === value ? prev : { ...prev, [key]: value })
  }, [])

  const cfg = useMemo(() => DB_CONFIGS[dbType], [dbType])
  const isKafka = dbType === 'kafka'
  const hasHostPort = dbType !== 'sqlite'
  const hasCreds = dbType !== 'sqlite' && !isKafka
  const hasAuthDb = dbType === 'mongodb'
  const hasConnStr = dbType !== 'sqlite'
  const hasDatabase = !isKafka

  /* Switch DB type — wrapped in startTransition so React keeps UI responsive */
  const handleDbTypeChange = useCallback((type: DatabaseType) => {
    startTransition(() => {
      setDbType(prev => {
        // update port only if user hasn't customised it
        const curDefault = String(DB_CONFIGS[prev]?.defaultPort || '')
        const newDefault = String(DB_CONFIGS[type].defaultPort)
        setFields(f => (f.port === '' || f.port === curDefault) ? { ...f, port: newDefault } : f)
        // If switching to a type that doesn't support connection string, reset to params
        const noConnStr = type === 'sqlite'
        if (noConnStr) setUseConnStr(false)
        return type
      })
    })
  }, [])

  /* Fast field updater */
  const setField = useCallback((key: keyof FormFields, value: string) => {
    setFields(prev => prev[key] === value ? prev : { ...prev, [key]: value })
  }, [])

  const sshData = useMemo(() => ssh.enabled
    ? { sshEnabled: true, sshHost: ssh.host, sshPort: ssh.port, sshUsername: ssh.username, sshPassword: ssh.password, sshPrivateKey: ssh.privateKey }
    : { sshEnabled: false as const },
    [ssh.enabled, ssh.host, ssh.port, ssh.username, ssh.password, ssh.privateKey])

  const handleParamSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!fields.name.trim()) { setNameError('Name is required'); return }
    setNameError('')
    const base = { name: fields.name, type: dbType, host: fields.host, port: Number(fields.port) || cfg.defaultPort, username: fields.username, password: fields.password, database: fields.database, authDatabase: fields.authDatabase, ...sshData }
    if (isKafka) {
      Object.assign(base, { kafkaSASL, kafkaSSL })
    }
    onSubmit(base)
  }, [fields, dbType, cfg.defaultPort, onSubmit, sshData, isKafka, kafkaSASL, kafkaSSL])

  const handleConnStrSubmit = useCallback(() => {
    if (!fields.name.trim()) { setNameError('Name is required'); return }
    if (!connStr.trim()) return
    setNameError('')
    onSubmit({ name: fields.name, type: dbType, host: '', port: cfg.defaultPort, connectionString: connStr, ...sshData })
  }, [fields.name, connStr, dbType, cfg.defaultPort, onSubmit, sshData])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div className="w-full max-w-lg rounded-xl bg-card border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${cfg.bgColor}`}>
              <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
            </div>
            <div>
              <h2 className="text-sm font-semibold">{initialData ? 'Edit Connection' : 'New Connection'}</h2>
              <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* DB Type Selector — Grouped */}
          <div className="space-y-2.5">
            {DB_GROUPS.map(group => (
              <div key={group.label} className={`rounded-lg border ${group.border} ${group.bg} p-2.5`}>
                <span className={`inline-block text-[10px] font-bold uppercase tracking-widest mb-2 ${group.color}`}>{group.label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {group.types.map(t => <DbTypeButton key={t} type={t} selected={dbType === t} onSelect={handleDbTypeChange} />)}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border/50" />

          {/* Connection Name — always visible */}
          <div>
            <label className={LABEL_CLS}>Connection Name</label>
            <input className={INPUT_CLS} placeholder={`My ${cfg.label}`} value={fields.name} onChange={e => setField('name', e.target.value)} autoFocus />
            {nameError && <p className="mt-1 text-[11px] text-destructive">{nameError}</p>}
          </div>

          {/* Tab Toggle — only show if DB supports connection string */}
          {hasConnStr && (
            <div className="flex rounded-lg border bg-muted/30 p-0.5">
              <button type="button" onClick={() => setUseConnStr(false)} className={useConnStr ? TAB_INACTIVE : TAB_ACTIVE}>Parameters</button>
              <button type="button" onClick={() => setUseConnStr(true)} className={useConnStr ? TAB_ACTIVE : TAB_INACTIVE}>Connection String</button>
            </div>
          )}

          {useConnStr && hasConnStr ? (
            <div>
              <label className={LABEL_CLS}>Connection String</label>
              <input className={`${INPUT_CLS} font-mono text-xs`} placeholder={cfg.placeholder} value={connStr} onChange={e => setConnStr(e.target.value)} />
              <p className="mt-1.5 text-[10px] text-muted-foreground/70">e.g. {cfg.connStringExample}</p>
            </div>
          ) : (
            <form id="connection-form" onSubmit={handleParamSubmit} className="space-y-3">
              {/* Kafka: Brokers (comma-separated) + Port */}
              {isKafka ? (
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-3">
                    <label className={LABEL_CLS}>Brokers</label>
                    <input className={INPUT_CLS} placeholder="broker1,broker2,broker3" value={fields.host} onChange={e => setField('host', e.target.value)} />
                    <p className="mt-1 text-[10px] text-muted-foreground/70">Comma-separated hostnames</p>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Port</label>
                    <input type="number" className={INPUT_CLS} placeholder="9092" value={fields.port} onChange={e => setField('port', e.target.value)} />
                  </div>
                </div>
              ) : (
                <Collapsible open={hasHostPort}>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-3">
                      <label className={LABEL_CLS}>Host</label>
                      <input className={INPUT_CLS} placeholder="localhost" value={fields.host} onChange={e => setField('host', e.target.value)} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Port</label>
                      <input type="number" className={INPUT_CLS} placeholder={String(cfg.defaultPort)} value={fields.port} onChange={e => setField('port', e.target.value)} />
                    </div>
                  </div>
                </Collapsible>
              )}

              {/* Kafka: SASL & SSL config */}
              {isKafka && (
                <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Radio className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Security</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLS}>SASL Mechanism</label>
                      <select className={INPUT_CLS} value={kafkaSASL} onChange={e => setKafkaSASL(e.target.value as any)}>
                        <option value="none">None (No Auth)</option>
                        <option value="plain">PLAIN</option>
                        <option value="scram-sha-256">SCRAM-SHA-256</option>
                        <option value="scram-sha-512">SCRAM-SHA-512</option>
                      </select>
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <div className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 ${kafkaSSL ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                          onClick={() => setKafkaSSL(!kafkaSSL)}>
                          <div className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 ${kafkaSSL ? 'translate-x-[16px]' : 'translate-x-[2px]'}`} />
                        </div>
                        <span className="text-xs font-medium">SSL / TLS</span>
                      </label>
                    </div>
                  </div>
                  {kafkaSASL !== 'none' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={LABEL_CLS}>Username</label>
                        <input className={INPUT_CLS} placeholder="kafka-user" value={fields.username} onChange={e => setField('username', e.target.value)} />
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Password</label>
                        <input type="password" className={INPUT_CLS} placeholder="••••••••" value={fields.password} onChange={e => setField('password', e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              )}

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

          {/* SSH Tunnel Section */}
          <div className="border-t border-border/50 pt-4">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 ${ssh.enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                onClick={() => setSSHField('enabled', !ssh.enabled)}>
                <div className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 ${ssh.enabled ? 'translate-x-[16px]' : 'translate-x-[2px]'}`} />
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">SSH Tunnel</span>
              </div>
            </label>

            <Collapsible open={ssh.enabled}>
              <div className="mt-3 space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3">
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-3">
                    <label className={LABEL_CLS}>SSH Host</label>
                    <input className={INPUT_CLS} placeholder="ssh.example.com" value={ssh.host} onChange={e => setSSHField('host', e.target.value)} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>SSH Port</label>
                    <input type="number" className={INPUT_CLS} placeholder="22" value={ssh.port} onChange={e => setSSHField('port', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>SSH Username</label>
                  <input className={INPUT_CLS} placeholder="ubuntu" value={ssh.username} onChange={e => setSSHField('username', e.target.value)} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Authentication</label>
                  <div className="flex rounded-lg border bg-muted/30 p-0.5 mb-2">
                    <button type="button" onClick={() => setSSHAuthMode('password')} className={sshAuthMode === 'password' ? TAB_ACTIVE : TAB_INACTIVE}>Password</button>
                    <button type="button" onClick={() => setSSHAuthMode('privateKey')} className={sshAuthMode === 'privateKey' ? TAB_ACTIVE : TAB_INACTIVE}>Private Key</button>
                  </div>
                  {sshAuthMode === 'password' ? (
                    <input type="password" className={INPUT_CLS} placeholder="••••••••" value={ssh.password} onChange={e => setSSHField('password', e.target.value)} />
                  ) : (
                    <textarea className={`${INPUT_CLS} h-20 resize-none font-mono text-[11px]`} placeholder="Paste private key here..." value={ssh.privateKey} onChange={e => setSSHField('privateKey', e.target.value)} />
                  )}
                </div>
              </div>
            </Collapsible>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t bg-muted/30">
          <p className="text-[10px] text-muted-foreground">
            {SUPPORTED_TYPES.has(dbType) ? '✓ Ready to connect' : '⏳ Coming soon'}
          </p>
          <div className="flex gap-2">
            <button className={BTN_OUTLINE_CLS} onClick={onCancel}>Cancel</button>
            {useConnStr ? (
              <button className={BTN_PRIMARY_CLS} onClick={handleConnStrSubmit}>Save</button>
            ) : (
              <button type="submit" form="connection-form" className={BTN_PRIMARY_CLS}>Save</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}