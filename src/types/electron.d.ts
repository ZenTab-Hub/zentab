// Electron API types
export interface ElectronAPI {
  mongodb: {
    connect: (connection: any) => Promise<any>
    disconnect: (connectionId: string) => Promise<any>
    listDatabases: (connectionId: string) => Promise<any>
    listCollections: (connectionId: string, database: string) => Promise<any>
    executeQuery: (
      connectionId: string,
      dbName: string,
      collectionName: string,
      query: any,
      options: any
    ) => Promise<any>
    insertDocument: (
      connectionId: string,
      database: string,
      collection: string,
      document: any
    ) => Promise<any>
    updateDocument: (
      connectionId: string,
      database: string,
      collection: string,
      filter: any,
      update: any
    ) => Promise<any>
    deleteDocument: (
      connectionId: string,
      database: string,
      collection: string,
      filter: any
    ) => Promise<any>
    getCollectionStats: (
      connectionId: string,
      database: string,
      collection: string
    ) => Promise<any>
  }
  storage: {
    saveConnection: (connection: any) => Promise<any>
    getConnections: () => Promise<any>
    deleteConnection: (id: string) => Promise<any>
    saveQuery: (query: any) => Promise<any>
    getSavedQueries: () => Promise<any>
    deleteSavedQuery: (id: string) => Promise<any>
    addQueryHistory: (history: any) => Promise<any>
    getQueryHistory: () => Promise<any>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}

