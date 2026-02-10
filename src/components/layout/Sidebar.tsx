import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Database,
  Search,
  Table,
  GitBranch,
  FileJson,
  Upload,
  Activity,
  Terminal,
  Settings,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  RefreshCw,
  PanelLeftClose,
  Key,
  Radio,
  Plus,
  Trash2,
  Edit3,
  List,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useConnectionStore } from '@/store/connectionStore'
import { databaseService } from '@/services/database.service'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { DatabaseIcon, getDatabaseTypeName } from '@/components/common/DatabaseIcon'
import {
  CreateDatabaseModal,
  ConfirmDropModal,
  RenameModal,
  CreateCollectionModal,
  IndexManagerModal,
} from '@/components/database/DatabaseManagementModals'

const navigation = [
  { name: 'Connections', href: '/', icon: Database },
  { name: 'Query Editor', href: '/query-editor', icon: Search },
  { name: 'Data Viewer', href: '/data-viewer', icon: Table },
  { name: 'Aggregation', href: '/aggregation', icon: GitBranch, dbType: 'mongodb' as const },
  { name: 'Schema', href: '/schema-analyzer', icon: FileJson },
  { name: 'Import/Export', href: '/import-export', icon: Upload },
  { name: 'Monitoring', href: '/monitoring', icon: Activity },
  { name: 'Redis Tools', href: '/redis-tools', icon: Terminal, dbType: 'redis' as const },
]

export const Sidebar = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { activeConnectionId, getActiveConnection, selectedDatabase, selectedCollection, setSelectedDatabase, setSelectedCollection } = useConnectionStore()
  const activeConnection = getActiveConnection()

  const [databases, setDatabases] = useState<any[]>([])
  const [collections, setCollections] = useState<{ [key: string]: any[] }>({})
  const [expandedDbs, setExpandedDbs] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; type: 'db' | 'coll'; db: string; coll?: string } | null>(null)
  // Modal states
  const [showCreateDb, setShowCreateDb] = useState(false)
  const [showDropDb, setShowDropDb] = useState<string | null>(null)
  const [showCreateColl, setShowCreateColl] = useState<string | null>(null)
  const [showDropColl, setShowDropColl] = useState<{ db: string; coll: string } | null>(null)
  const [showRenameColl, setShowRenameColl] = useState<{ db: string; coll: string } | null>(null)
  const [showIndexManager, setShowIndexManager] = useState<{ db: string; coll: string } | null>(null)
  const [indexes, setIndexes] = useState<any[]>([])

  // Close context menu on click outside
  useEffect(() => {
    const close = () => setCtxMenu(null)
    if (ctxMenu) window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [ctxMenu])

  useEffect(() => {
    if (activeConnectionId) {
      loadDatabases()
    } else {
      setDatabases([])
      setCollections({})
      setExpandedDbs(new Set())
    }
  }, [activeConnectionId])

  const loadDatabases = async () => {
    if (!activeConnectionId) return
    try {
      const result: any = await databaseService.listDatabases(activeConnectionId)
      if (result.success) {
        setDatabases(result.databases || [])
      }
    } catch (error) {
      console.error('Failed to load databases:', error)
    }
  }

  const loadCollections = async (dbName: string) => {
    if (!activeConnectionId) return
    try {
      const result: any = await databaseService.listCollections(activeConnectionId, dbName)
      if (result.success) {
        setCollections(prev => ({ ...prev, [dbName]: result.collections || [] }))
      }
    } catch (error) {
      console.error('Failed to load collections:', error)
    }
  }

  const toggleDatabase = (dbName: string) => {
    const newExpanded = new Set(expandedDbs)
    if (newExpanded.has(dbName)) {
      newExpanded.delete(dbName)
    } else {
      newExpanded.add(dbName)
      if (!collections[dbName]) {
        loadCollections(dbName)
      }
    }
    setExpandedDbs(newExpanded)
  }

  const handleSelectCollection = (dbName: string, collName: string) => {
    setSelectedDatabase(dbName)
    setSelectedCollection(collName)
    navigate('/data-viewer')
  }

  const dbType = activeConnection?.type || 'mongodb'
  const isRedis = dbType === 'redis'
  const isKafka = dbType === 'kafka'
  const isNoSQL = dbType === 'mongodb' || isRedis
  const itemLabel = isKafka ? 'Topic' : isRedis ? 'Key' : isNoSQL ? 'Collection' : 'Table'
  const supportsIndex = dbType === 'mongodb' || dbType === 'postgresql'

  // Context menu handlers
  const handleDbContext = (e: React.MouseEvent, dbName: string) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, type: 'db', db: dbName })
  }
  const handleCollContext = (e: React.MouseEvent, dbName: string, collName: string) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, type: 'coll', db: dbName, coll: collName })
  }

  // Management handlers
  const handleCreateDb = async (name: string) => {
    if (!activeConnectionId) return
    await databaseService.createDatabase(activeConnectionId, name, dbType as any)
    await loadDatabases()
  }
  const handleDropDb = async () => {
    if (!activeConnectionId || !showDropDb) return
    await databaseService.dropDatabase(activeConnectionId, showDropDb, dbType as any)
    await loadDatabases()
  }
  const handleCreateColl = async (name: string, options?: any) => {
    if (!activeConnectionId || !showCreateColl) return
    await databaseService.createCollection(activeConnectionId, showCreateColl, name, options, dbType as any)
    await loadCollections(showCreateColl)
  }
  const handleDropColl = async () => {
    if (!activeConnectionId || !showDropColl) return
    await databaseService.dropCollection(activeConnectionId, showDropColl.db, showDropColl.coll, dbType as any)
    await loadCollections(showDropColl.db)
  }
  const handleRenameColl = async (newName: string) => {
    if (!activeConnectionId || !showRenameColl) return
    await databaseService.renameCollection(activeConnectionId, showRenameColl.db, showRenameColl.coll, newName, dbType as any)
    await loadCollections(showRenameColl.db)
  }
  const openIndexManager = async (db: string, coll: string) => {
    if (!activeConnectionId) return
    setShowIndexManager({ db, coll })
    try {
      const result = await databaseService.listIndexes(activeConnectionId, db, coll, dbType as any)
      setIndexes(result?.indexes || result || [])
    } catch { setIndexes([]) }
  }
  const handleCreateIndex = async (keys: Record<string, any>, options?: any) => {
    if (!activeConnectionId || !showIndexManager) return
    await databaseService.createIndex(activeConnectionId, showIndexManager.db, showIndexManager.coll, keys, options, dbType as any)
    const result = await databaseService.listIndexes(activeConnectionId, showIndexManager.db, showIndexManager.coll, dbType as any)
    setIndexes(result?.indexes || result || [])
  }
  const handleDropIndex = async (indexName: string) => {
    if (!activeConnectionId || !showIndexManager) return
    await databaseService.dropIndex(activeConnectionId, showIndexManager.db, showIndexManager.coll, indexName, dbType as any)
    const result = await databaseService.listIndexes(activeConnectionId, showIndexManager.db, showIndexManager.coll, dbType as any)
    setIndexes(result?.indexes || result || [])
  }

  // Collapsed sidebar
  if (collapsed) {
    return (
      <div className="flex w-12 flex-col border-r bg-sidebar items-center py-2 gap-1">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded hover:bg-sidebar-accent transition-colors mb-1"
          title="Expand sidebar"
        >
          <img src="/logo.png" alt="Logo" className="h-5 w-5 object-contain rounded border border-border/50" />
        </button>
        {navigation.filter(item => !(item as any).dbType || (item as any).dbType === activeConnection?.type).map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              title={item.name}
              className={cn(
                'p-2 rounded transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
            </Link>
          )
        })}
        <div className="flex-1" />
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      </div>
    )
  }

  return (
    <div className="flex w-60 flex-col border-r bg-sidebar">
      {/* Header */}
      <div className="flex h-10 items-center justify-between px-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="h-5 w-5 object-contain rounded border border-border/50" />
          <span className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wider">Zentab</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded hover:bg-sidebar-accent transition-colors"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-3.5 w-3.5 text-sidebar-foreground" />
        </button>
      </div>

      {/* Connection Info */}
      {activeConnection && (
        <div className="px-3 py-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <DatabaseIcon type={activeConnection.type || 'mongodb'} className="h-3.5 w-3.5" />
            <span className="text-xs font-medium truncate flex-1">{activeConnection.name}</span>
            {!isRedis && (
              <button
                onClick={() => setShowCreateDb(true)}
                className="p-0.5 rounded hover:bg-sidebar-accent transition-colors"
                title="Create Database"
              >
                <Plus className="h-3 w-3 text-sidebar-foreground" />
              </button>
            )}
            <button
              onClick={loadDatabases}
              className="p-0.5 rounded hover:bg-sidebar-accent transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-3 w-3 text-sidebar-foreground" />
            </button>
          </div>
          <div className="text-[10px] text-sidebar-foreground mt-0.5 ml-5.5">
            {getDatabaseTypeName(activeConnection.type || 'mongodb')}
          </div>
        </div>
      )}

      {/* Database Tree */}
      {activeConnectionId && databases.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          {/* Search */}
          <div className="px-2 py-1.5">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-sidebar-foreground" />
              <input
                type="text"
                placeholder="Filter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-[11px] rounded border border-border/50 bg-background/50 focus:outline-none focus:border-primary/50 transition-colors placeholder:text-sidebar-foreground"
              />
            </div>
          </div>

          <div className="px-1 pb-2">
            {databases
              .filter((db) => db.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((db) => (
              <div key={db.name}>
                <button
                  onClick={() => toggleDatabase(db.name)}
                  onContextMenu={(e) => handleDbContext(e, db.name)}
                  className={cn(
                    'sidebar-tree-item w-full',
                    selectedDatabase === db.name && !selectedCollection && 'active'
                  )}
                >
                  {expandedDbs.has(db.name) ? (
                    <ChevronDown className="h-3 w-3 text-sidebar-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-sidebar-foreground shrink-0" />
                  )}
                  {expandedDbs.has(db.name) ? (
                    <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <Folder className="h-3.5 w-3.5 text-amber-500/70 shrink-0" />
                  )}
                  <span className="truncate flex-1 text-left text-[11px]">{db.name}</span>
                  {collections[db.name] && (
                    <span className="text-[10px] text-sidebar-foreground tabular-nums">
                      {collections[db.name].length}
                    </span>
                  )}
                </button>
                {expandedDbs.has(db.name) && collections[db.name] && (
                  <div className="ml-3 border-l border-border/30 pl-1">
                    {collections[db.name].map((coll: any) => (
                      <button
                        key={coll.name}
                        onClick={() => handleSelectCollection(db.name, coll.name)}
                        onContextMenu={(e) => handleCollContext(e, db.name, coll.name)}
                        className={cn(
                          'sidebar-tree-item w-full',
                          selectedDatabase === db.name && selectedCollection === coll.name && 'active'
                        )}
                      >
                        {isKafka ? (
                          <Radio className="h-3 w-3 text-amber-400/70 shrink-0" />
                        ) : isRedis ? (
                          <Key className="h-3 w-3 text-red-400/70 shrink-0" />
                        ) : (
                          <Table className="h-3 w-3 text-blue-400/70 shrink-0" />
                        )}
                        <span className="truncate flex-1 text-left text-[11px]">{coll.name}</span>
                        {isRedis && coll.type && (
                          <span className="text-[9px] text-muted-foreground/60 font-mono">{coll.type}</span>
                        )}
                        {isKafka && coll.partitions != null && (
                          <span className="text-[9px] text-muted-foreground/60 font-mono">{coll.partitions}p</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no databases */}
      {activeConnectionId && databases.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-[11px] text-sidebar-foreground text-center">No databases found</p>
        </div>
      )}

      {/* No connection state */}
      {!activeConnectionId && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Database className="h-6 w-6 text-sidebar-foreground mx-auto mb-2" />
            <p className="text-[11px] text-sidebar-foreground">No active connection</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="border-t border-border/50 p-1.5">
        <div className="space-y-0.5">
          {navigation.filter(item => !(item as any).dbType || (item as any).dbType === activeConnection?.type).map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-2 rounded px-2 py-1.5 text-[11px] font-medium transition-colors',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
                )}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                {item.name}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Settings */}
      <div className="border-t border-border/50 p-1.5">
        <button
          onClick={() => setShowSettings(true)}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[11px] font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </button>
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Context Menu */}
      {ctxMenu && (
        <div
          className="fixed z-[110] min-w-[160px] rounded-md border border-border bg-popover shadow-lg py-1"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={() => setCtxMenu(null)}
        >
          {ctxMenu.type === 'db' && (
            <>
              <button className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-accent"
                onClick={() => setShowCreateColl(ctxMenu.db)}>
                <Plus className="h-3 w-3" /> Create {itemLabel}
              </button>
              {!isRedis && (
                <button className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-accent text-destructive"
                  onClick={() => setShowDropDb(ctxMenu.db)}>
                  <Trash2 className="h-3 w-3" /> Drop Database
                </button>
              )}
              {isRedis && (
                <button className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-accent text-destructive"
                  onClick={() => setShowDropDb(ctxMenu.db)}>
                  <Trash2 className="h-3 w-3" /> Flush Database
                </button>
              )}
              <button className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-accent"
                onClick={() => { loadCollections(ctxMenu.db) }}>
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
            </>
          )}
          {ctxMenu.type === 'coll' && ctxMenu.coll && (
            <>
              {!isKafka && (
                <button className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-accent"
                  onClick={() => setShowRenameColl({ db: ctxMenu.db, coll: ctxMenu.coll! })}>
                  <Edit3 className="h-3 w-3" /> Rename {itemLabel}
                </button>
              )}
              {supportsIndex && (
                <button className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-accent"
                  onClick={() => openIndexManager(ctxMenu.db, ctxMenu.coll!)}>
                  <List className="h-3 w-3" /> Manage Indexes
                </button>
              )}
              <button className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-accent text-destructive"
                onClick={() => setShowDropColl({ db: ctxMenu.db, coll: ctxMenu.coll! })}>
                <Trash2 className="h-3 w-3" /> Drop {itemLabel}
              </button>
            </>
          )}
        </div>
      )}

      {/* Management Modals */}
      <CreateDatabaseModal isOpen={showCreateDb} onClose={() => setShowCreateDb(false)} onSubmit={handleCreateDb} />
      {showDropDb && (
        <ConfirmDropModal isOpen={true} onClose={() => setShowDropDb(null)} onConfirm={handleDropDb}
          itemType={isRedis ? 'Database (Flush)' : 'Database'} itemName={showDropDb} />
      )}
      {showCreateColl && (
        <CreateCollectionModal isOpen={true} onClose={() => setShowCreateColl(null)}
          onSubmit={handleCreateColl} dbType={dbType} />
      )}
      {showDropColl && (
        <ConfirmDropModal isOpen={true} onClose={() => setShowDropColl(null)} onConfirm={handleDropColl}
          itemType={itemLabel} itemName={showDropColl.coll} />
      )}
      {showRenameColl && (
        <RenameModal isOpen={true} onClose={() => setShowRenameColl(null)} onSubmit={handleRenameColl}
          itemType={itemLabel} currentName={showRenameColl.coll} />
      )}
      {showIndexManager && (
        <IndexManagerModal isOpen={true} onClose={() => setShowIndexManager(null)}
          indexes={indexes} onCreateIndex={handleCreateIndex} onDropIndex={handleDropIndex} dbType={dbType} />
      )}
    </div>
  )
}

