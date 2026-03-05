import { create } from 'zustand'
import { DatabaseConnection, ConnectionStatus } from '@/types'

interface ConnectionState {
  connections: DatabaseConnection[]
  activeConnectionId: string | null
  connectionStatuses: Record<string, ConnectionStatus>
  selectedDatabase: string | null
  selectedCollection: string | null

  // Shared database/collection cache (prevents duplicate API calls from Header + Sidebar)
  cachedDatabases: any[]
  cachedCollections: Record<string, any[]>

  // Actions
  setConnections: (connections: DatabaseConnection[]) => void
  addConnection: (connection: DatabaseConnection) => void
  updateConnection: (id: string, connection: Partial<DatabaseConnection>) => void
  deleteConnection: (id: string) => void
  setActiveConnection: (id: string | null) => void
  setConnectionStatus: (id: string, status: ConnectionStatus) => void
  setSelectedDatabase: (database: string | null) => void
  setSelectedCollection: (collection: string | null) => void
  getActiveConnection: () => DatabaseConnection | null
  getConnectionStatus: (id: string) => ConnectionStatus | null
  setCachedDatabases: (databases: any[]) => void
  setCachedCollections: (db: string, collections: any[]) => void
  clearCache: () => void
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  activeConnectionId: null,
  connectionStatuses: {},
  selectedDatabase: null,
  selectedCollection: null,
  cachedDatabases: [],
  cachedCollections: {},

  setConnections: (connections) => set({ connections }),

  addConnection: (connection) =>
    set((state) => ({
      connections: [...state.connections, connection],
    })),

  updateConnection: (id, updates) =>
    set((state) => ({
      connections: state.connections.map((conn) =>
        conn.id === id ? { ...conn, ...updates, updatedAt: new Date() } : conn
      ),
    })),

  deleteConnection: (id) =>
    set((state) => ({
      connections: state.connections.filter((conn) => conn.id !== id),
      activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
    })),

  setActiveConnection: (id) =>
    set({
      activeConnectionId: id,
      selectedDatabase: null,
      selectedCollection: null,
      cachedDatabases: [],
      cachedCollections: {},
    }),

  setConnectionStatus: (id, status) =>
    set((state) => {
      // Only update if value actually changed (Record allows shallow equality)
      if (state.connectionStatuses[id] === status) return state
      return { connectionStatuses: { ...state.connectionStatuses, [id]: status } }
    }),

  setSelectedDatabase: (database) =>
    set({
      selectedDatabase: database,
      selectedCollection: null,
    }),

  setSelectedCollection: (collection) => set({ selectedCollection: collection }),

  getActiveConnection: () => {
    const state = get()
    return state.connections.find((conn) => conn.id === state.activeConnectionId) || null
  },

  getConnectionStatus: (id) => {
    const state = get()
    return state.connectionStatuses[id] || null
  },

  setCachedDatabases: (databases) => set({ cachedDatabases: databases }),

  setCachedCollections: (db, collections) =>
    set((state) => ({
      cachedCollections: { ...state.cachedCollections, [db]: collections },
    })),

  clearCache: () => set({ cachedDatabases: [], cachedCollections: {} }),
}))
