import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Database,
  Search,
  Table,
  GitBranch,
  FileJson,
  Upload,
  Settings,
  Star,
  History,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useConnectionStore } from '@/store/connectionStore'
import { mongodbService } from '@/services/mongodb.service'
import { AISettingsModal } from '@/components/settings/AISettingsModal'

const navigation = [
  { name: 'Connections', href: '/', icon: Database },
  { name: 'Query Editor', href: '/query-editor', icon: Search },
  { name: 'Data Viewer', href: '/data-viewer', icon: Table },
  { name: 'Aggregation', href: '/aggregation', icon: GitBranch },
  { name: 'Schema Analyzer', href: '/schema-analyzer', icon: FileJson },
  { name: 'Import/Export', href: '/import-export', icon: Upload },
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
      console.log('Loading databases for connection:', activeConnectionId)
      const result: any = await mongodbService.listDatabases(activeConnectionId)
      console.log('Databases result:', result)
      if (result.success) {
        setDatabases(result.databases || [])
      } else {
        console.error('Failed to load databases:', result.error)
      }
    } catch (error) {
      console.error('Failed to load databases:', error)
    }
  }

  const loadCollections = async (dbName: string) => {
    if (!activeConnectionId) return

    try {
      const result: any = await mongodbService.listCollections(activeConnectionId, dbName)
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
    console.log('Selected collection:', dbName, collName)
    setSelectedDatabase(dbName)
    setSelectedCollection(collName)
    // Navigate to data viewer
    navigate('/data-viewer')
  }

  return (
    <div className="flex w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Database className="mr-2 h-6 w-6 text-primary" />
        <span className="text-lg font-semibold">MongoDB GUI</span>
      </div>

      {/* Active Connection Info */}
      {activeConnection && (
        <div className="border-b p-4">
          <div className="text-xs text-muted-foreground">Connected to</div>
          <div className="mt-1 truncate font-medium">{activeConnection.name}</div>
        </div>
      )}

      {/* Databases & Collections */}
      {activeConnectionId && databases.length > 0 && (
        <div className="max-h-64 overflow-y-auto border-b">
          <div className="p-2">
            <div className="text-xs font-semibold text-muted-foreground mb-2">DATABASES</div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search databases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-xs rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          {databases
            .filter((db) => db.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((db) => (
            <div key={db.name}>
              <button
                onClick={() => toggleDatabase(db.name)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
              >
                {expandedDbs.has(db.name) ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <Database className="h-3 w-3" />
                <span className="flex-1 truncate text-left">{db.name}</span>
              </button>
              {expandedDbs.has(db.name) && collections[db.name] && (
                <div className="ml-6 space-y-0.5">
                  {collections[db.name].map((coll: any) => (
                    <button
                      key={coll.name}
                      onClick={() => handleSelectCollection(db.name, coll.name)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1 text-xs hover:bg-accent',
                        selectedDatabase === db.name && selectedCollection === coll.name
                          ? 'bg-primary/10 text-primary'
                          : ''
                      )}
                    >
                      <Table className="h-3 w-3" />
                      <span className="truncate">{coll.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Quick Access */}
      <div className="border-t p-4">
        <div className="mb-2 text-xs font-semibold text-muted-foreground">QUICK ACCESS</div>
        <div className="space-y-1">
          <button className="flex w-full items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            <Star className="mr-3 h-4 w-4" />
            Favorites
          </button>
          <button className="flex w-full items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            <History className="mr-3 h-4 w-4" />
            History
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex w-full items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Settings className="mr-3 h-4 w-4" />
            Settings
          </button>
        </div>
      </div>

      <AISettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}

