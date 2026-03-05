import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, Search, Database, Table, Check } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useConnectionStore } from '@/store/connectionStore'
import { DatabaseIcon } from '@/components/common/DatabaseIcon'

const PAGE_NAMES: Record<string, string> = {
  '/': 'Connections',
  '/query-editor': 'Query Editor',
  '/data-viewer': 'Data Viewer',
  '/aggregation': 'Aggregation',
  '/schema-analyzer': 'Schema',
  '/import-export': 'Import/Export',
  '/monitoring': 'Monitoring',
  '/pg-tools': 'PG Tools',
  '/redis-tools': 'Redis Tools',
  '/kafka-tools': 'Kafka Tools',
}

export const Header = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    activeConnectionId,
    getActiveConnection,
    selectedDatabase,
    selectedCollection,
    setSelectedDatabase,
    setSelectedCollection,
    cachedDatabases,
    cachedCollections,
  } = useConnectionStore()

  const activeConnection = getActiveConnection()
  const [showDatabaseDropdown, setShowDatabaseDropdown] = useState(false)
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false)
  const [databaseSearch, setDatabaseSearch] = useState('')
  const [collectionSearch, setCollectionSearch] = useState('')
  const dbDropdownRef = useRef<HTMLDivElement>(null)
  const collDropdownRef = useRef<HTMLDivElement>(null)

  const databases = cachedDatabases
  const collections = selectedDatabase ? (cachedCollections[selectedDatabase] || []) : []

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dbDropdownRef.current && !dbDropdownRef.current.contains(e.target as Node)) {
        setShowDatabaseDropdown(false)
      }
      if (collDropdownRef.current && !collDropdownRef.current.contains(e.target as Node)) {
        setShowCollectionDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelectDatabase = (dbName: string) => {
    setSelectedDatabase(dbName)
    setSelectedCollection(null)
    setShowDatabaseDropdown(false)
    setDatabaseSearch('')
  }

  const handleSelectCollection = (collName: string) => {
    setSelectedCollection(collName)
    setShowCollectionDropdown(false)
    setCollectionSearch('')
    navigate('/data-viewer')
  }

  const filteredDatabases = databases.filter((db) => {
    const dbName = typeof db === 'string' ? db : db.name
    return dbName.toLowerCase().includes(databaseSearch.toLowerCase())
  })

  const filteredCollections = collections.filter((coll) => {
    const collName = typeof coll === 'string' ? coll : coll.name
    return collName.toLowerCase().includes(collectionSearch.toLowerCase())
  })

  const pageName = PAGE_NAMES[location.pathname] || ''

  return (
    <header className="flex h-10 items-center border-b bg-toolbar px-3 gap-1.5">
      {/* Breadcrumb */}
      <div className="breadcrumb flex-1">
        {activeConnection && (
          <>
            <div className="flex items-center gap-1.5 breadcrumb-item">
              <DatabaseIcon type={activeConnection.type || 'mongodb'} className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">{activeConnection.name}</span>
            </div>
            <ChevronRight className="h-3 w-3 breadcrumb-separator mx-0.5" />
          </>
        )}

        {/* Database selector */}
        <div className="relative" ref={dbDropdownRef}>
          <button
            onClick={() => { setShowDatabaseDropdown(!showDatabaseDropdown); setShowCollectionDropdown(false) }}
            className="flex items-center gap-1 breadcrumb-item px-2 py-1 rounded-md hover:bg-accent transition-colors"
          >
            <Database className="h-3 w-3" />
            <span className="text-[11px]">{selectedDatabase || 'database'}</span>
            <ChevronDown className="h-2.5 w-2.5 opacity-40" />
          </button>

          {showDatabaseDropdown && (
            <div className="dropdown-menu w-60 left-0 top-full">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search databases..."
                    value={databaseSearch}
                    onChange={(e) => setDatabaseSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:border-primary/50"
                    autoFocus
                  />
                </div>
              </div>
              <div className="overflow-y-auto max-h-56 p-1">
                {filteredDatabases.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground text-center">No databases found</div>
                ) : (
                  filteredDatabases.map((db) => {
                    const dbName = typeof db === 'string' ? db : db.name
                    const isActive = selectedDatabase === dbName
                    return (
                      <button
                        key={dbName}
                        onClick={() => handleSelectDatabase(dbName)}
                        className={`dropdown-item ${isActive ? 'active' : ''}`}
                      >
                        <Database className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{dbName}</span>
                        {isActive && <Check className="h-3 w-3 text-primary shrink-0" />}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {selectedDatabase && (
          <>
            <ChevronRight className="h-3 w-3 breadcrumb-separator mx-0.5" />
            {/* Collection selector */}
            <div className="relative" ref={collDropdownRef}>
              <button
                onClick={() => { setShowCollectionDropdown(!showCollectionDropdown); setShowDatabaseDropdown(false) }}
                className="flex items-center gap-1 breadcrumb-item px-2 py-1 rounded-md hover:bg-accent transition-colors"
              >
                <Table className="h-3 w-3" />
                <span className="text-[11px]">{selectedCollection || 'collection'}</span>
                <ChevronDown className="h-2.5 w-2.5 opacity-40" />
              </button>

              {showCollectionDropdown && (
                <div className="dropdown-menu w-60 left-0 top-full">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search collections..."
                        value={collectionSearch}
                        onChange={(e) => setCollectionSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:border-primary/50"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-56 p-1">
                    {filteredCollections.length === 0 ? (
                      <div className="p-4 text-xs text-muted-foreground text-center">No collections found</div>
                    ) : (
                      filteredCollections.map((coll) => {
                        const collName = typeof coll === 'string' ? coll : coll.name
                        const isActive = selectedCollection === collName
                        return (
                          <button
                            key={collName}
                            onClick={() => handleSelectCollection(collName)}
                            className={`dropdown-item ${isActive ? 'active' : ''}`}
                          >
                            <Table className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate">{collName}</span>
                            {isActive && <Check className="h-3 w-3 text-primary shrink-0" />}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {pageName && (
          <>
            <ChevronRight className="h-3 w-3 breadcrumb-separator mx-0.5" />
            <span className="text-[11px] text-foreground font-medium">{pageName}</span>
          </>
        )}
      </div>

      {/* Status indicator */}
      {activeConnectionId && (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/10">
          <div className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="text-[10px] text-success font-medium">Connected</span>
        </div>
      )}
    </header>
  )
}
