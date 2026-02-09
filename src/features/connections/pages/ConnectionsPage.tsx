import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { ConnectionForm } from '../components/ConnectionForm'
import { ConnectionList } from '../components/ConnectionList'
import { useConnectionStore } from '@/store/connectionStore'
import { storageService } from '@/services/storage.service'
import { databaseService } from '@/services/database.service'
import type { DatabaseConnection } from '@/types'

export const ConnectionsPage = () => {
  const [showForm, setShowForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null)
  const [loading, setLoading] = useState(false)

  const { connections, setConnections, addConnection, updateConnection, deleteConnection, setActiveConnection, activeConnectionId } =
    useConnectionStore()

  // Load connections from storage on mount
  useEffect(() => {
    loadConnections()
  }, [])

  const loadConnections = async () => {
    try {
      const savedConnections = await storageService.getConnections()
      setConnections(savedConnections)
    } catch (error) {
      console.error('Failed to load connections:', error)
    }
  }

  const handleSubmit = async (data: any) => {
    try {
      setLoading(true)

      const connection: DatabaseConnection = {
        id: editingConnection?.id || Date.now().toString(),
        name: data.name,
        type: data.type || 'mongodb',
        host: data.host || '',
        port: data.port || 27017,
        username: data.username,
        password: data.password,
        authDatabase: data.authDatabase,
        database: data.database,
        connectionString: data.connectionString,
        createdAt: editingConnection?.createdAt || new Date() as any,
        updatedAt: new Date() as any,
      }

      console.log('Saving connection:', connection)

      // Save to SQLite
      await storageService.saveConnection(connection)

      // Update store
      if (editingConnection) {
        updateConnection(connection.id, connection)
      } else {
        addConnection(connection)
      }

      setShowForm(false)
      setEditingConnection(null)
    } catch (error) {
      console.error('Failed to save connection:', error)
      alert('Failed to save connection: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const buildConnectionString = (connection: DatabaseConnection): string => {
    // Use connection string directly if provided
    if (connection.connectionString && connection.connectionString.trim()) {
      return connection.connectionString.trim()
    }

    if (!connection.host || !connection.host.trim()) {
      throw new Error('Missing connection string or host')
    }

    const auth = connection.username && connection.password
      ? `${encodeURIComponent(connection.username)}:${encodeURIComponent(connection.password)}@`
      : ''
    const dbType = connection.type || 'mongodb'

    if (dbType === 'postgresql') {
      const database = connection.database || 'postgres'
      const sslParam = connection.ssl ? '?sslmode=require' : ''
      return `postgresql://${auth}${connection.host}:${connection.port || 5432}/${database}${sslParam}`
    }

    if (dbType === 'redis') {
      const db = connection.database ? `/${connection.database}` : ''
      return `redis://${auth}${connection.host}:${connection.port || 6379}${db}`
    }

    if (dbType === 'kafka') {
      return `kafka://${auth}${connection.host}:${connection.port || 9092}`
    }

    // MongoDB
    const authDb = connection.authDatabase ? `?authSource=${connection.authDatabase}` : ''
    return `mongodb://${auth}${connection.host}:${connection.port || 27017}${authDb}`
  }

  const handleConnect = async (connection: DatabaseConnection) => {
    try {
      setLoading(true)
      console.log('Connection object:', connection)

      const connectionString = buildConnectionString(connection)
      console.log('Built connection string:', connectionString)

      const dbType = connection.type || 'mongodb'

      // Connect via unified service
      const result: any = await databaseService.connect(connection.id, connectionString, dbType)

      if (result.success) {
        setActiveConnection(connection.id)
        alert('Connected successfully!')

        // Load databases
        const dbResult: any = await databaseService.listDatabases(connection.id, dbType)
        if (dbResult.success) {
          console.log('Databases:', dbResult.databases)
        }
      } else {
        alert('Connection failed: ' + result.error)
      }
    } catch (error) {
      console.error('Connection error:', error)
      alert('Connection failed: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async (connectionId: string) => {
    try {
      setLoading(true)
      const connection = connections.find(c => c.id === connectionId)
      const dbType = connection?.type || 'mongodb'
      const result: any = await databaseService.disconnect(connectionId, dbType)

      if (result && result.success) {
        if (activeConnectionId === connectionId) {
          setActiveConnection(null)
        }
        alert('Disconnected successfully!')
      } else {
        alert('Disconnect failed: ' + (result?.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Disconnect error:', error)
      alert('Disconnect failed: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (connection: DatabaseConnection) => {
    setEditingConnection(connection)
    setShowForm(true)
  }

  const handleDelete = async (connectionId: string) => {
    if (confirm('Are you sure you want to delete this connection?')) {
      try {
        await storageService.deleteConnection(connectionId)
        deleteConnection(connectionId)
      } catch (error) {
        console.error('Failed to delete connection:', error)
        alert('Failed to delete connection')
      }
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingConnection(null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold">Connections</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your database connections</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          New Connection
        </button>
      </div>

      {loading && (
        <div className="rounded-md border bg-card p-3 text-center mb-4">
          <p className="text-xs text-muted-foreground">Connecting...</p>
        </div>
      )}

      {connections.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Plus className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold mb-1">No connections yet</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Create your first database connection to get started
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Connection
            </button>
          </div>
        </div>
      ) : (
        <ConnectionList
          connections={connections}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onEdit={handleEdit}
          onDelete={handleDelete}
          activeConnectionId={activeConnectionId || undefined}
        />
      )}

      {showForm && (
        <ConnectionForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          initialData={editingConnection || undefined}
        />
      )}
    </div>
  )
}

