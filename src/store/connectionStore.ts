import { create } from 'zustand'
import { DatabaseConnection, ConnectionStatus } from '@/types'

interface ConnectionState {
  connections: DatabaseConnection[]
  activeConnectionId: string | null
  connectionStatuses: Map<string, ConnectionStatus>
  selectedDatabase: string | null
  selectedCollection: string | null

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
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  activeConnectionId: null,
  connectionStatuses: new Map(),
  selectedDatabase: null,
  selectedCollection: null,

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
    }),

  setConnectionStatus: (id, status) =>
    set((state) => {
      const newStatuses = new Map(state.connectionStatuses)
      newStatuses.set(id, status)
      return { connectionStatuses: newStatuses }
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
    return state.connectionStatuses.get(id) || null
  },
}))

