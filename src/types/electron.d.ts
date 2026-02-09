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
  dialog: {
    showOpenDialog: (options: any) => Promise<{ canceled: boolean; filePaths: string[] }>
    showSaveDialog: (options: any) => Promise<{ canceled: boolean; filePath: string }>
  }
  fs: {
    readFile: (filePath: string) => Promise<string>
    writeFile: (filePath: string, data: string) => Promise<{ success: boolean }>
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
  security: {
    setup2FA: () => Promise<{ success: boolean; secret?: string; uri?: string; qrDataUrl?: string; error?: string }>
    verify2FA: (secret: string, token: string) => Promise<{ success: boolean; valid?: boolean; error?: string }>
    enable2FA: (secret: string) => Promise<{ success: boolean; error?: string }>
    disable2FA: () => Promise<{ success: boolean; error?: string }>
    get2FAStatus: () => Promise<{ success: boolean; enabled?: boolean; hasSecret?: boolean; error?: string }>
    getIdleTimeout: () => Promise<{ success: boolean; minutes: number }>
    setIdleTimeout: (minutes: number) => Promise<{ success: boolean }>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}

