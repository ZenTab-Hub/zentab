import { useState, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useConnectionStore } from '@/store/connectionStore'
import { Button } from '@/components/common/Button'
import { mongodbService } from '@/services/mongodb.service'

export const Header = () => {
  const navigate = useNavigate()
  const {
    activeConnectionId,
    selectedDatabase,
    selectedCollection,
    setSelectedDatabase,
    setSelectedCollection
  } = useConnectionStore()

  const [showDatabaseDropdown, setShowDatabaseDropdown] = useState(false)
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false)
  const [databases, setDatabases] = useState<any[]>([])
  const [collections, setCollections] = useState<any[]>([])
  const [databaseSearch, setDatabaseSearch] = useState('')
  const [collectionSearch, setCollectionSearch] = useState('')

  // Load databases when connection is active
  useEffect(() => {
    if (activeConnectionId) {
      loadDatabases()
    }
  }, [activeConnectionId])

  // Load collections when database is selected
  useEffect(() => {
    if (activeConnectionId && selectedDatabase) {
      loadCollections()
    }
  }, [activeConnectionId, selectedDatabase])

  const loadDatabases = async () => {
    if (!activeConnectionId) return
    try {
      const result: any = await mongodbService.listDatabases(activeConnectionId)
      if (result.success && result.databases) {
        setDatabases(result.databases)
      }
    } catch (error) {
      console.error('Failed to load databases:', error)
    }
  }

  const loadCollections = async () => {
    if (!activeConnectionId || !selectedDatabase) return
    try {
      const result: any = await mongodbService.listCollections(activeConnectionId, selectedDatabase)
      if (result.success && result.collections) {
        setCollections(result.collections)
      }
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

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b bg-card px-6">
        <div className="flex items-center space-x-4">
          {/* Database Selector */}
          <div className="flex items-center space-x-2 relative">
            <span className="text-sm text-muted-foreground">Database:</span>
            <Button
              variant="outline"
              size="sm"
              className="min-w-[150px] justify-between"
              onClick={() => setShowDatabaseDropdown(!showDatabaseDropdown)}
            >
              <span>{selectedDatabase || 'Select database'}</span>
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>

            {showDatabaseDropdown && (
              <div className="absolute top-full left-20 mt-1 w-64 bg-card border rounded-lg shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search databases..."
                      value={databaseSearch}
                      onChange={(e) => setDatabaseSearch(e.target.value)}
                      className="w-full pl-7 pr-2 py-1 text-xs rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                <div className="overflow-y-auto max-h-64">
                  {filteredDatabases.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      {databases.length === 0 ? 'No databases found' : 'No matching databases'}
                    </div>
                  ) : (
                    filteredDatabases.map((db) => {
                      const dbName = typeof db === 'string' ? db : db.name
                      return (
                        <button
                          key={dbName}
                          onClick={() => handleSelectDatabase(dbName)}
                          className={`w-full text-left px-4 py-2 hover:bg-muted ${
                            selectedDatabase === dbName ? 'bg-muted font-medium' : ''
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

          {/* Collection Selector */}
          {selectedDatabase && (
            <div className="flex items-center space-x-2 relative">
              <span className="text-sm text-muted-foreground">Collection:</span>
              <Button
                variant="outline"
                size="sm"
                className="min-w-[150px] justify-between"
                onClick={() => setShowCollectionDropdown(!showCollectionDropdown)}
              >
                <span>{selectedCollection || 'Select collection'}</span>
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>

              {showCollectionDropdown && (
                <div className="absolute top-full left-24 mt-1 w-64 bg-card border rounded-lg shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search collections..."
                        value={collectionSearch}
                        onChange={(e) => setCollectionSearch(e.target.value)}
                        className="w-full pl-7 pr-2 py-1 text-xs rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-64">
                    {filteredCollections.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">
                        {collections.length === 0 ? 'No collections found' : 'No matching collections'}
                      </div>
                    ) : (
                      filteredCollections.map((coll) => {
                        const collName = typeof coll === 'string' ? coll : coll.name
                        return (
                          <button
                            key={collName}
                            onClick={() => handleSelectCollection(collName)}
                            className={`w-full text-left px-4 py-2 hover:bg-muted ${
                              selectedCollection === collName ? 'bg-muted font-medium' : ''
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
          )}
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-sm text-muted-foreground">
            <span className="inline-flex h-2 w-2 rounded-full bg-green-500 mr-2"></span>
            Connected
          </div>
        </div>
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

