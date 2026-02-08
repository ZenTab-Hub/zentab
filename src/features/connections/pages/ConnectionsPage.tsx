import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { ConnectionForm } from '../components/ConnectionForm'
import { ConnectionList } from '../components/ConnectionList'
import { useConnectionStore } from '@/store/connectionStore'
import { storageService } from '@/services/storage.service'
import { mongodbService } from '@/services/mongodb.service'
import type { MongoDBConnection } from '@/types'

export const ConnectionsPage = () => {
  const [showForm, setShowForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<MongoDBConnection | null>(null)
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

      const connection: MongoDBConnection = {
        id: editingConnection?.id || Date.now().toString(),
        name: data.name,
        host: data.host || '',
        port: data.port || 27017,
        username: data.username,
        password: data.password,
        authDatabase: data.authDatabase,
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

  const handleConnect = async (connection: MongoDBConnection) => {
    try {
      setLoading(true)

      console.log('Connection object:', connection)

      // Build connection string
      let connectionString = ''
      if (connection.connectionString && connection.connectionString.trim()) {
        // Use connection string directly
        connectionString = connection.connectionString.trim()
        console.log('Using connection string:', connectionString)
      } else if (connection.host && connection.host.trim()) {
        // Build from individual fields
        const auth = connection.username && connection.password
          ? `${encodeURIComponent(connection.username)}:${encodeURIComponent(connection.password)}@`
          : ''
        const authDb = connection.authDatabase ? `?authSource=${connection.authDatabase}` : ''
        connectionString = `mongodb://${auth}${connection.host}:${connection.port}${authDb}`
        console.log('Built connection string:', connectionString)
      } else {
        console.error('Invalid connection:', connection)
        alert('Invalid connection: missing connection string or host')
        setLoading(false)
        return
      }

      // Connect via IPC
      const result: any = await mongodbService.connect(connection.id, connectionString)

      if (result.success) {
        setActiveConnection(connection.id)
        alert('Connected successfully!')

        // Load databases
        const dbResult: any = await mongodbService.listDatabases(connection.id)
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
      const result: any = await mongodbService.disconnect(connectionId)

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

  const handleEdit = (connection: MongoDBConnection) => {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Connections</h1>
          <p className="text-muted-foreground">Manage your MongoDB connections</p>
        </div>
        <Button onClick={() => setShowForm(true)} disabled={loading}>
          <Plus className="mr-2 h-4 w-4" />
          New Connection
        </Button>
      </div>

      {loading && (
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      )}

      {connections.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <div className="mx-auto max-w-md">
            <h3 className="mb-2 text-lg font-semibold">No connections yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Get started by creating your first MongoDB connection
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Connection
            </Button>
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

