import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Search, Database, Table } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useConnectionStore } from '@/store/connectionStore'
import { databaseService } from '@/services/database.service'
import { DatabaseIcon } from '@/components/common/DatabaseIcon'

const PAGE_NAMES: Record<string, string> = {
  '/': 'Connections',
  '/query-editor': 'Query Editor',
  '/data-viewer': 'Data Viewer',
  '/aggregation': 'Aggregation',
  '/schema-analyzer': 'Schema',
  '/import-export': 'Import/Export',
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
    setSelectedCollection
  } = useConnectionStore()

  const activeConnection = getActiveConnection()
  const [showDatabaseDropdown, setShowDatabaseDropdown] = useState(false)
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false)
  const [databases, setDatabases] = useState<any[]>([])
  const [collections, setCollections] = useState<any[]>([])
  const [databaseSearch, setDatabaseSearch] = useState('')
  const [collectionSearch, setCollectionSearch] = useState('')

  useEffect(() => {
    if (activeConnectionId) loadDatabases()
  }, [activeConnectionId])

  useEffect(() => {
    if (activeConnectionId && selectedDatabase) loadCollections()
  }, [activeConnectionId, selectedDatabase])

  const loadDatabases = async () => {
    if (!activeConnectionId) return
    try {
      const result: any = await databaseService.listDatabases(activeConnectionId)
      if (result.success && result.databases) setDatabases(result.databases)
    } catch (error) {
      console.error('Failed to load databases:', error)
    }
  }

  const loadCollections = async () => {
    if (!activeConnectionId || !selectedDatabase) return
    try {
      const result: any = await databaseService.listCollections(activeConnectionId, selectedDatabase)
      if (result.success && result.collections) setCollections(result.collections)
    } catch (error) {
      console.error('Failed to load collections:', error)
    }
  }

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
    <>
      <header className="flex h-9 items-center border-b bg-toolbar px-3 gap-2">
        {/* Breadcrumb */}
        <div className="breadcrumb flex-1">
          {activeConnection && (
            <>
              <div className="flex items-center gap-1 breadcrumb-item">
                <DatabaseIcon type={activeConnection.type || 'mongodb'} className="h-3 w-3" />
                <span className="text-[11px]">{activeConnection.name}</span>
              </div>
              <ChevronRight className="h-3 w-3 breadcrumb-separator" />
            </>
          )}

          {/* Database selector */}
          <div className="relative">
            <button
              onClick={() => setShowDatabaseDropdown(!showDatabaseDropdown)}
              className="flex items-center gap-1 breadcrumb-item px-1.5 py-0.5 rounded hover:bg-accent transition-colors"
            >
              <Database className="h-3 w-3" />
              <span className="text-[11px]">{selectedDatabase || 'database'}</span>
              <ChevronDown className="h-2.5 w-2.5 opacity-50" />
            </button>

            {showDatabaseDropdown && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-popover border rounded-md shadow-lg z-50 overflow-hidden">
                <div className="p-1.5 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={databaseSearch}
                      onChange={(e) => setDatabaseSearch(e.target.value)}
                      className="w-full pl-7 pr-2 py-1 text-[11px] rounded border bg-background focus:outline-none focus:border-primary/50"
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="overflow-y-auto max-h-48 p-0.5">
                  {filteredDatabases.length === 0 ? (
                    <div className="p-3 text-[11px] text-muted-foreground text-center">No databases</div>
                  ) : (
                    filteredDatabases.map((db) => {
                      const dbName = typeof db === 'string' ? db : db.name
                      return (
                        <button
                          key={dbName}
                          onClick={() => handleSelectDatabase(dbName)}
                          className={`w-full text-left px-2 py-1.5 text-[11px] rounded hover:bg-accent transition-colors ${
                            selectedDatabase === dbName ? 'bg-primary/10 text-primary font-medium' : ''
                          }`}
                        >
                          {dbName}
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
              <ChevronRight className="h-3 w-3 breadcrumb-separator" />
              {/* Collection selector */}
              <div className="relative">
                <button
                  onClick={() => setShowCollectionDropdown(!showCollectionDropdown)}
                  className="flex items-center gap-1 breadcrumb-item px-1.5 py-0.5 rounded hover:bg-accent transition-colors"
                >
                  <Table className="h-3 w-3" />
                  <span className="text-[11px]">{selectedCollection || 'collection'}</span>
                  <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                </button>

                {showCollectionDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-popover border rounded-md shadow-lg z-50 overflow-hidden">
                    <div className="p-1.5 border-b">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={collectionSearch}
                          onChange={(e) => setCollectionSearch(e.target.value)}
                          className="w-full pl-7 pr-2 py-1 text-[11px] rounded border bg-background focus:outline-none focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto max-h-48 p-0.5">
                      {filteredCollections.length === 0 ? (
                        <div className="p-3 text-[11px] text-muted-foreground text-center">No collections</div>
                      ) : (
                        filteredCollections.map((coll) => {
                          const collName = typeof coll === 'string' ? coll : coll.name
                          return (
                            <button
                              key={collName}
                              onClick={() => handleSelectCollection(collName)}
                              className={`w-full text-left px-2 py-1.5 text-[11px] rounded hover:bg-accent transition-colors ${
                                selectedCollection === collName ? 'bg-primary/10 text-primary font-medium' : ''
                              }`}
                            >
                              {collName}
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
              <ChevronRight className="h-3 w-3 breadcrumb-separator" />
              <span className="text-[11px] text-foreground font-medium">{pageName}</span>
            </>
          )}
        </div>

        {/* Status */}
        {activeConnectionId && (
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] text-muted-foreground">Connected</span>
          </div>
        )}
      </header>

      {/* Click outside to close dropdowns */}
      {(showDatabaseDropdown || showCollectionDropdown) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowDatabaseDropdown(false)
            setShowCollectionDropdown(false)
          }}
        />
      )}
    </>
  )
}

