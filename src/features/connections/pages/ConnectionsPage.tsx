import { useState, useEffect, useCallback } from 'react'
import { Plus, Download, Upload, Database, Search } from 'lucide-react'
import { ConnectionForm } from '../components/ConnectionForm'
import { ConnectionList } from '../components/ConnectionList'
import { useConnectionStore } from '@/store/connectionStore'
import { storageService } from '@/services/storage.service'
import { databaseService } from '@/services/database.service'
import { useToast } from '@/components/common/Toast'
import { CardGridSkeleton } from '@/components/common/Skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import type { DatabaseConnection } from '@/types'

export const ConnectionsPage = () => {
  const [showForm, setShowForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null)
  const [loading, setLoading] = useState(false)

  const { connections, setConnections, addConnection, updateConnection, deleteConnection, setActiveConnection, activeConnectionId } =
    useConnectionStore()
  const t = useToast()

  // Load connections from storage on mount
  useEffect(() => {
    loadConnections()
  }, [])

  const loadConnections = async () => {
    try {
      const savedConnections = await storageService.getConnections()
      setConnections(savedConnections)
    } catch {
      // connections will load on next mount
    }
  }

  const handleSubmit = useCallback(async (data: any) => {
    try {
      setLoading(true)

      const connection: DatabaseConnection = {
        id: editingConnection?.id || crypto.randomUUID(),
        name: data.name,
        type: data.type || 'mongodb',
        host: data.host || '',
        port: data.port || 27017,
        username: data.username,
        password: data.password,
        authDatabase: data.authDatabase,
        database: data.database,
        connectionString: data.connectionString,
        sshTunnel: data.sshEnabled ? {
          enabled: true,
          host: data.sshHost || '',
          port: Number(data.sshPort) || 22,
          username: data.sshUsername || '',
          password: data.sshPassword || '',
          privateKey: data.sshPrivateKey || '',
        } : undefined,
        kafkaSASL: data.kafkaSASL,
        kafkaSSL: data.kafkaSSL,
        createdAt: editingConnection?.createdAt || new Date() as any,
        updatedAt: new Date() as any,
      }

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
      t.error('Failed to save connection: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }, [editingConnection, addConnection, updateConnection, t])

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
      const port = connection.port || 9092
      // Build brokers: host field may contain comma-separated brokers
      const brokers = (connection.host || '').split(',').map(b => {
        const h = b.trim()
        return h.includes(':') ? h : `${h}:${port}`
      }).join(',')

      // Build protocol prefix
      let proto = 'kafka'
      const sasl = connection.kafkaSASL || 'none'
      if (sasl === 'plain') proto += '+sasl_plain'
      else if (sasl === 'scram-sha-256') proto += '+sasl_scram256'
      else if (sasl === 'scram-sha-512') proto += '+sasl_scram512'
      if (connection.kafkaSSL) proto += '+ssl'

      // Auth part (only when SASL is not none)
      const kafkaAuth = sasl !== 'none' && connection.username && connection.password
        ? `${encodeURIComponent(connection.username)}:${encodeURIComponent(connection.password)}@`
        : ''

      return `${proto}://${kafkaAuth}${brokers}`
    }

    // MongoDB
    const authDb = connection.authDatabase ? `?authSource=${connection.authDatabase}` : ''
    return `mongodb://${auth}${connection.host}:${connection.port || 27017}${authDb}`
  }

  const handleConnect = async (connection: DatabaseConnection) => {
    try {
      setLoading(true)
      const connectionString = buildConnectionString(connection)

      const dbType = connection.type || 'mongodb'

      // Connect via unified service (pass SSH tunnel config if present)
      const result: any = await databaseService.connect(connection.id, connectionString, dbType, connection.sshTunnel)

      if (result.success) {
        setActiveConnection(connection.id)
        t.success('Connected successfully!')
        // Sidebar will auto-load databases via useEffect on activeConnectionId change
      } else {
        t.error('Connection failed: ' + result.error)
      }
    } catch (error) {
      t.error('Connection failed: ' + (error as Error).message)
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
        t.success('Disconnected successfully!')
      } else {
        t.error('Disconnect failed: ' + (result?.error || 'Unknown error'))
      }
    } catch (error) {
      t.error('Disconnect failed: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (connection: DatabaseConnection) => {
    setEditingConnection(connection)
    setShowForm(true)
  }

  const handleClone = (connection: DatabaseConnection) => {
    const cloned: DatabaseConnection = {
      ...connection,
      id: crypto.randomUUID(),
      name: `${connection.name} (Copy)`,
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    }
    setEditingConnection(cloned)
    setShowForm(true)
  }

  const handleDelete = (connectionId: string) => {
    t.confirm('Are you sure you want to delete this connection?', async () => {
      try {
        await storageService.deleteConnection(connectionId)
        deleteConnection(connectionId)
        t.success('Connection deleted')
      } catch (error) {
        t.error('Failed to delete connection: ' + (error as Error).message)
      }
    })
  }

  const handleCancel = useCallback(() => {
    setShowForm(false)
    setEditingConnection(null)
  }, [])

  const handleExport = async () => {
    try {
      if (connections.length === 0) { t.warning('No connections to export'); return }
      const result = await window.electronAPI.dialog.showSaveDialog({
        title: 'Export Connections',
        defaultPath: `zentab-connections-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (result.canceled || !result.filePath) return
      // Strip passwords for security — user can re-enter after import
      const exportData = connections.map(({ id, name, type, host, port, username, database, authDatabase, connectionString, ssl, sshTunnel, createdAt, updatedAt }) => ({
        id, name, type, host, port, username, database, authDatabase, connectionString, ssl,
        sshTunnel: sshTunnel ? { ...sshTunnel, password: undefined, privateKey: undefined } : undefined,
        createdAt, updatedAt,
      }))
      await window.electronAPI.fs.writeFile(result.filePath, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), connections: exportData }, null, 2))
      t.success(`Exported ${connections.length} connection(s)`)
    } catch (error) {
      t.error('Export failed: ' + (error as Error).message)
    }
  }

  const handleImport = async () => {
    try {
      const result = await window.electronAPI.dialog.showOpenDialog({
        title: 'Import Connections',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
      })
      if (result.canceled || !result.filePaths.length) return
      const raw = await window.electronAPI.fs.readFile(result.filePaths[0])
      const data = JSON.parse(raw)
      const imported: any[] = data.connections || data
      if (!Array.isArray(imported) || imported.length === 0) { t.warning('No valid connections found in file'); return }
      let count = 0
      for (const conn of imported) {
        if (!conn.name || !conn.type) continue
        const newConn: DatabaseConnection = {
          ...conn,
          id: crypto.randomUUID(),
          password: conn.password || '',
          createdAt: new Date() as any,
          updatedAt: new Date() as any,
        }
        await storageService.saveConnection(newConn)
        addConnection(newConn)
        count++
      }
      t.success(`Imported ${count} connection(s)`)
    } catch (error) {
      t.error('Import failed: ' + (error as Error).message)
    }
  }

  const [searchQuery, setSearchQuery] = useState('')

  const filteredConnections = searchQuery.trim()
    ? connections.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.host || '').toLowerCase().includes(searchQuery.toLowerCase()) || (c.type || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : connections

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">Connections</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {connections.length} {connections.length === 1 ? 'connection' : 'connections'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border hover:bg-accent transition-all duration-150 disabled:opacity-50"
            title="Import connections from JSON"
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </button>
          <button
            onClick={handleExport}
            disabled={loading || connections.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border hover:bg-accent transition-all duration-150 disabled:opacity-50"
            title="Export connections to JSON"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
          <button
            onClick={() => setShowForm(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all duration-150 disabled:opacity-50 active:scale-[0.97]"
          >
            <Plus className="h-3.5 w-3.5" />
            New Connection
          </button>
        </div>
      </div>

      {/* Search bar */}
      {connections.length > 0 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search connections by name, host, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50"
          />
          {searchQuery && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
              {filteredConnections.length} found
            </span>
          )}
        </div>
      )}

      {loading && (
        <CardGridSkeleton cards={3} className="mb-4" />
      )}

      {!loading && connections.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={Database}
            title="No connections yet"
            description="Create your first database connection to get started"
            action={{ label: 'Create Connection', onClick: () => setShowForm(true) }}
          />
        </div>
      ) : (
        <ConnectionList
          connections={filteredConnections}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onClone={handleClone}
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

