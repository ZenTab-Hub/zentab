import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),

  // MongoDB operations (will be implemented)
  mongodb: {
    connect: (connectionId: string, connectionString: string) =>
      ipcRenderer.invoke('mongodb:connect', connectionId, connectionString),
    disconnect: (connectionId: string) =>
      ipcRenderer.invoke('mongodb:disconnect', connectionId),
    listDatabases: (connectionId: string) =>
      ipcRenderer.invoke('mongodb:listDatabases', connectionId),
    listCollections: (connectionId: string, dbName: string) =>
      ipcRenderer.invoke('mongodb:listCollections', connectionId, dbName),
    executeQuery: (connectionId: string, dbName: string, collectionName: string, query: any, options: any) =>
      ipcRenderer.invoke('mongodb:executeQuery', connectionId, dbName, collectionName, query, options),
    insertDocument: (
      connectionId: string,
      dbName: string,
      collectionName: string,
      document: any
    ) =>
      ipcRenderer.invoke('mongodb:insertDocument', connectionId, dbName, collectionName, document),
    updateDocument: (
      connectionId: string,
      dbName: string,
      collectionName: string,
      filter: any,
      update: any
    ) =>
      ipcRenderer.invoke(
        'mongodb:updateDocument',
        connectionId,
        dbName,
        collectionName,
        filter,
        update
      ),
    deleteDocument: (
      connectionId: string,
      dbName: string,
      collectionName: string,
      filter: any
    ) =>
      ipcRenderer.invoke('mongodb:deleteDocument', connectionId, dbName, collectionName, filter),
  },

  // Storage operations (SQLite for local data)
  storage: {
    saveConnection: (connection: any) => ipcRenderer.invoke('storage:saveConnection', connection),
    getConnections: () => ipcRenderer.invoke('storage:getConnections'),
    deleteConnection: (id: string) => ipcRenderer.invoke('storage:deleteConnection', id),
    saveQuery: (query: any) => ipcRenderer.invoke('storage:saveQuery', query),
    getQueryHistory: (limit?: number) => ipcRenderer.invoke('storage:getQueryHistory', limit),
    saveFavorite: (favorite: any) => ipcRenderer.invoke('storage:saveFavorite', favorite),
    getFavorites: () => ipcRenderer.invoke('storage:getFavorites'),
  },
})

// Type definitions for TypeScript
export interface ElectronAPI {
  getVersion: () => Promise<string>
  getPath: (name: string) => Promise<string>
  mongodb: {
    connect: (connectionString: string) => Promise<any>
    disconnect: (connectionId: string) => Promise<void>
    listDatabases: (connectionId: string) => Promise<any[]>
    listCollections: (connectionId: string, dbName: string) => Promise<any[]>
    executeQuery: (
      connectionId: string,
      dbName: string,
      collectionName: string,
      query: any,
      options: any
    ) => Promise<any>
    insertDocument: (
      connectionId: string,
      dbName: string,
      collectionName: string,
      document: any
    ) => Promise<any>
    updateDocument: (
      connectionId: string,
      dbName: string,
      collectionName: string,
      filter: any,
      update: any
    ) => Promise<any>
    deleteDocument: (
      connectionId: string,
      dbName: string,
      collectionName: string,
      filter: any
    ) => Promise<any>
  }
  storage: {
    saveConnection: (connection: any) => Promise<any>
    getConnections: () => Promise<any[]>
    deleteConnection: (id: string) => Promise<void>
    saveQuery: (query: any) => Promise<any>
    getQueryHistory: (limit?: number) => Promise<any[]>
    saveFavorite: (favorite: any) => Promise<any>
    getFavorites: () => Promise<any[]>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

