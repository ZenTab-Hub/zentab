import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),

  // Health check / ping
  ping: (connectionId: string, dbType: string) =>
    ipcRenderer.invoke('db:ping', connectionId, dbType),

  // MongoDB operations (will be implemented)
  mongodb: {
    connect: (connectionId: string, connectionString: string, sshTunnel?: any) =>
      ipcRenderer.invoke('mongodb:connect', connectionId, connectionString, sshTunnel),
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
    updateMany: (connectionId: string, dbName: string, collectionName: string, filter: any, update: any) =>
      ipcRenderer.invoke('mongodb:updateMany', connectionId, dbName, collectionName, filter, update),
    deleteMany: (connectionId: string, dbName: string, collectionName: string, filter: any) =>
      ipcRenderer.invoke('mongodb:deleteMany', connectionId, dbName, collectionName, filter),
    countDocuments: (connectionId: string, dbName: string, collectionName: string, filter: any) =>
      ipcRenderer.invoke('mongodb:countDocuments', connectionId, dbName, collectionName, filter),
    // Database management
    createDatabase: (connectionId: string, database: string) =>
      ipcRenderer.invoke('mongodb:createDatabase', connectionId, database),
    dropDatabase: (connectionId: string, database: string) =>
      ipcRenderer.invoke('mongodb:dropDatabase', connectionId, database),
    createCollection: (connectionId: string, database: string, collection: string, options?: any) =>
      ipcRenderer.invoke('mongodb:createCollection', connectionId, database, collection, options),
    dropCollection: (connectionId: string, database: string, collection: string) =>
      ipcRenderer.invoke('mongodb:dropCollection', connectionId, database, collection),
    renameCollection: (connectionId: string, database: string, oldName: string, newName: string) =>
      ipcRenderer.invoke('mongodb:renameCollection', connectionId, database, oldName, newName),
    // Index management
    listIndexes: (connectionId: string, database: string, collection: string) =>
      ipcRenderer.invoke('mongodb:listIndexes', connectionId, database, collection),
    createIndex: (connectionId: string, database: string, collection: string, keys: any, options?: any) =>
      ipcRenderer.invoke('mongodb:createIndex', connectionId, database, collection, keys, options),
    dropIndex: (connectionId: string, database: string, collection: string, indexName: string) =>
      ipcRenderer.invoke('mongodb:dropIndex', connectionId, database, collection, indexName),
    explainQuery: (connectionId: string, database: string, collection: string, filter: any) =>
      ipcRenderer.invoke('mongodb:explainQuery', connectionId, database, collection, filter),
    getServerStatus: (connectionId: string) =>
      ipcRenderer.invoke('mongodb:getServerStatus', connectionId),
  },

  // PostgreSQL operations
  postgresql: {
    connect: (connectionId: string, connectionString: string, sshTunnel?: any) =>
      ipcRenderer.invoke('postgresql:connect', connectionId, connectionString, sshTunnel),
    disconnect: (connectionId: string) =>
      ipcRenderer.invoke('postgresql:disconnect', connectionId),
    listDatabases: (connectionId: string) =>
      ipcRenderer.invoke('postgresql:listDatabases', connectionId),
    listTables: (connectionId: string, database: string) =>
      ipcRenderer.invoke('postgresql:listTables', connectionId, database),
    executeQuery: (connectionId: string, database: string, table: string, query: string, options: any) =>
      ipcRenderer.invoke('postgresql:executeQuery', connectionId, database, table, query, options),
    findQuery: (connectionId: string, database: string, table: string, filter: any, options: any) =>
      ipcRenderer.invoke('postgresql:findQuery', connectionId, database, table, filter, options),
    insertDocument: (connectionId: string, database: string, table: string, document: any) =>
      ipcRenderer.invoke('postgresql:insertDocument', connectionId, database, table, document),
    updateDocument: (connectionId: string, database: string, table: string, filter: any, update: any) =>
      ipcRenderer.invoke('postgresql:updateDocument', connectionId, database, table, filter, update),
    deleteDocument: (connectionId: string, database: string, table: string, filter: any) =>
      ipcRenderer.invoke('postgresql:deleteDocument', connectionId, database, table, filter),
    updateMany: (connectionId: string, database: string, table: string, filter: any, update: any) =>
      ipcRenderer.invoke('postgresql:updateMany', connectionId, database, table, filter, update),
    deleteMany: (connectionId: string, database: string, table: string, filter: any) =>
      ipcRenderer.invoke('postgresql:deleteMany', connectionId, database, table, filter),
    countRows: (connectionId: string, database: string, table: string, filter: any) =>
      ipcRenderer.invoke('postgresql:countRows', connectionId, database, table, filter),
    aggregate: (connectionId: string, database: string, table: string, query: string) =>
      ipcRenderer.invoke('postgresql:aggregate', connectionId, database, table, query),
    getTableSchema: (connectionId: string, database: string, table: string) =>
      ipcRenderer.invoke('postgresql:getTableSchema', connectionId, database, table),
    // Database management
    createDatabase: (connectionId: string, database: string) =>
      ipcRenderer.invoke('postgresql:createDatabase', connectionId, database),
    dropDatabase: (connectionId: string, database: string) =>
      ipcRenderer.invoke('postgresql:dropDatabase', connectionId, database),
    createTable: (connectionId: string, database: string, table: string, columns: any[]) =>
      ipcRenderer.invoke('postgresql:createTable', connectionId, database, table, columns),
    dropTable: (connectionId: string, database: string, table: string) =>
      ipcRenderer.invoke('postgresql:dropTable', connectionId, database, table),
    renameTable: (connectionId: string, database: string, oldName: string, newName: string) =>
      ipcRenderer.invoke('postgresql:renameTable', connectionId, database, oldName, newName),
    // Index management
    listIndexes: (connectionId: string, database: string, table: string) =>
      ipcRenderer.invoke('postgresql:listIndexes', connectionId, database, table),
    createIndex: (connectionId: string, database: string, table: string, indexName: string, columns: string[], options?: any) =>
      ipcRenderer.invoke('postgresql:createIndex', connectionId, database, table, indexName, columns, options),
    dropIndex: (connectionId: string, database: string, indexName: string) =>
      ipcRenderer.invoke('postgresql:dropIndex', connectionId, database, indexName),
    explainQuery: (connectionId: string, database: string, table: string, query: string) =>
      ipcRenderer.invoke('postgresql:explainQuery', connectionId, database, table, query),
    getServerStats: (connectionId: string) =>
      ipcRenderer.invoke('postgresql:getServerStats', connectionId),
  },

  // Redis operations
  redis: {
    connect: (connectionId: string, connectionString: string, sshTunnel?: any) =>
      ipcRenderer.invoke('redis:connect', connectionId, connectionString, sshTunnel),
    disconnect: (connectionId: string) =>
      ipcRenderer.invoke('redis:disconnect', connectionId),
    listDatabases: (connectionId: string) =>
      ipcRenderer.invoke('redis:listDatabases', connectionId),
    listKeys: (connectionId: string, database: string, pattern: string, count: number) =>
      ipcRenderer.invoke('redis:listKeys', connectionId, database, pattern, count),
    getKeyValue: (connectionId: string, database: string, key: string) =>
      ipcRenderer.invoke('redis:getKeyValue', connectionId, database, key),
    setKey: (connectionId: string, database: string, key: string, value: any, type: string, ttl?: number) =>
      ipcRenderer.invoke('redis:setKey', connectionId, database, key, value, type, ttl),
    deleteKey: (connectionId: string, database: string, key: string) =>
      ipcRenderer.invoke('redis:deleteKey', connectionId, database, key),
    executeCommand: (connectionId: string, database: string, command: string) =>
      ipcRenderer.invoke('redis:executeCommand', connectionId, database, command),
    getInfo: (connectionId: string) =>
      ipcRenderer.invoke('redis:getInfo', connectionId),
    // Management
    flushDatabase: (connectionId: string, database: string) =>
      ipcRenderer.invoke('redis:flushDatabase', connectionId, database),
    renameKey: (connectionId: string, database: string, oldKey: string, newKey: string) =>
      ipcRenderer.invoke('redis:renameKey', connectionId, database, oldKey, newKey),
    // Advanced
    getServerStats: (connectionId: string) =>
      ipcRenderer.invoke('redis:getServerStats', connectionId),
    getSlowLog: (connectionId: string, count?: number) =>
      ipcRenderer.invoke('redis:getSlowLog', connectionId, count || 50),
    getClients: (connectionId: string) =>
      ipcRenderer.invoke('redis:getClients', connectionId),
    memoryUsage: (connectionId: string, database: string, key: string) =>
      ipcRenderer.invoke('redis:memoryUsage', connectionId, database, key),
    bulkDelete: (connectionId: string, database: string, pattern: string) =>
      ipcRenderer.invoke('redis:bulkDelete', connectionId, database, pattern),
    bulkTTL: (connectionId: string, database: string, pattern: string, ttl: number) =>
      ipcRenderer.invoke('redis:bulkTTL', connectionId, database, pattern, ttl),
    addItem: (connectionId: string, database: string, key: string, keyType: string, field: string, value: string, score?: number) =>
      ipcRenderer.invoke('redis:addItem', connectionId, database, key, keyType, field, value, score),
    removeItem: (connectionId: string, database: string, key: string, keyType: string, field: string, index?: number) =>
      ipcRenderer.invoke('redis:removeItem', connectionId, database, key, keyType, field, index),
    // Pub/Sub
    subscribe: (connectionId: string, channels: string[]) =>
      ipcRenderer.invoke('redis:subscribe', connectionId, channels),
    unsubscribe: (connectionId: string, channels: string[]) =>
      ipcRenderer.invoke('redis:unsubscribe', connectionId, channels),
    unsubscribeAll: (connectionId: string) =>
      ipcRenderer.invoke('redis:unsubscribeAll', connectionId),
    publish: (connectionId: string, channel: string, message: string) =>
      ipcRenderer.invoke('redis:publish', connectionId, channel, message),
    getPubSubChannels: (connectionId: string) =>
      ipcRenderer.invoke('redis:getPubSubChannels', connectionId),
    onPubSubMessage: (callback: (data: { connectionId: string; channel: string; message: string; timestamp: number }) => void) => {
      const handler = (_event: any, data: any) => callback(data)
      ipcRenderer.on('redis:pubsubMessage', handler)
      return () => ipcRenderer.removeListener('redis:pubsubMessage', handler)
    },
    // Streams
    streamAdd: (connectionId: string, database: string, key: string, fields: Record<string, string>, id?: string) =>
      ipcRenderer.invoke('redis:streamAdd', connectionId, database, key, fields, id || '*'),
    streamRange: (connectionId: string, database: string, key: string, start?: string, end?: string, count?: number) =>
      ipcRenderer.invoke('redis:streamRange', connectionId, database, key, start || '-', end || '+', count || 200),
    streamLen: (connectionId: string, database: string, key: string) =>
      ipcRenderer.invoke('redis:streamLen', connectionId, database, key),
    streamDel: (connectionId: string, database: string, key: string, ids: string[]) =>
      ipcRenderer.invoke('redis:streamDel', connectionId, database, key, ids),
    streamTrim: (connectionId: string, database: string, key: string, maxLen: number) =>
      ipcRenderer.invoke('redis:streamTrim', connectionId, database, key, maxLen),
    streamInfo: (connectionId: string, database: string, key: string) =>
      ipcRenderer.invoke('redis:streamInfo', connectionId, database, key),
    // Key Encoding, Quick TTL, Copy Key
    getKeyEncoding: (connectionId: string, database: string, key: string) =>
      ipcRenderer.invoke('redis:getKeyEncoding', connectionId, database, key),
    setKeyTTL: (connectionId: string, database: string, key: string, ttl: number) =>
      ipcRenderer.invoke('redis:setKeyTTL', connectionId, database, key, ttl),
    copyKey: (connectionId: string, database: string, sourceKey: string, destKey: string) =>
      ipcRenderer.invoke('redis:copyKey', connectionId, database, sourceKey, destKey),
  },

  // Kafka operations
  kafka: {
    connect: (connectionId: string, connectionString: string, sshTunnel?: any) =>
      ipcRenderer.invoke('kafka:connect', connectionId, connectionString, sshTunnel),
    disconnect: (connectionId: string) =>
      ipcRenderer.invoke('kafka:disconnect', connectionId),
    listTopics: (connectionId: string) =>
      ipcRenderer.invoke('kafka:listTopics', connectionId),
    getTopicMetadata: (connectionId: string, topic: string) =>
      ipcRenderer.invoke('kafka:getTopicMetadata', connectionId, topic),
    consumeMessages: (connectionId: string, topic: string, limit: number, fromBeginning: boolean) =>
      ipcRenderer.invoke('kafka:consumeMessages', connectionId, topic, limit, fromBeginning),
    produceMessage: (connectionId: string, topic: string, messages: any[]) =>
      ipcRenderer.invoke('kafka:produceMessage', connectionId, topic, messages),
    createTopic: (connectionId: string, topic: string, numPartitions: number, replicationFactor: number) =>
      ipcRenderer.invoke('kafka:createTopic', connectionId, topic, numPartitions, replicationFactor),
    deleteTopic: (connectionId: string, topic: string) =>
      ipcRenderer.invoke('kafka:deleteTopic', connectionId, topic),
    getClusterInfo: (connectionId: string) =>
      ipcRenderer.invoke('kafka:getClusterInfo', connectionId),
  },

  // File dialog operations
  dialog: {
    showOpenDialog: (options: any) => ipcRenderer.invoke('dialog:showOpenDialog', options),
    showSaveDialog: (options: any) => ipcRenderer.invoke('dialog:showSaveDialog', options),
  },
  fs: {
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, data: string) => ipcRenderer.invoke('fs:writeFile', filePath, data),
  },

  // Storage operations (SQLite for local data)
  storage: {
    saveConnection: (connection: any) => ipcRenderer.invoke('storage:saveConnection', connection),
    getConnections: () => ipcRenderer.invoke('storage:getConnections'),
    deleteConnection: (id: string) => ipcRenderer.invoke('storage:deleteConnection', id),
    saveQuery: (query: any) => ipcRenderer.invoke('storage:saveQuery', query),
    deleteSavedQuery: (id: string) => ipcRenderer.invoke('storage:deleteSavedQuery', id),
    addQueryHistory: (history: any) => ipcRenderer.invoke('storage:addQueryHistory', history),
    getQueryHistory: (limit?: number) => ipcRenderer.invoke('storage:getQueryHistory', limit),
    saveFavorite: (favorite: any) => ipcRenderer.invoke('storage:saveFavorite', favorite),
    getFavorites: () => ipcRenderer.invoke('storage:getFavorites'),
    getQueryTemplates: () => ipcRenderer.invoke('storage:getQueryTemplates'),
    saveQueryTemplate: (template: any) => ipcRenderer.invoke('storage:saveQueryTemplate', template),
    deleteQueryTemplate: (id: string) => ipcRenderer.invoke('storage:deleteQueryTemplate', id),
    // AI Model Storage (with encrypted API keys)
    saveAIModel: (model: any) => ipcRenderer.invoke('storage:saveAIModel', model),
    getAIModels: () => ipcRenderer.invoke('storage:getAIModels'),
    deleteAIModel: (id: string) => ipcRenderer.invoke('storage:deleteAIModel', id),
    getAISetting: (key: string) => ipcRenderer.invoke('storage:getAISetting', key),
    setAISetting: (key: string, value: string) => ipcRenderer.invoke('storage:setAISetting', key, value),
  },

  // Auto-updater operations
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
    downloadUpdate: () => ipcRenderer.invoke('updater:downloadUpdate'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
    getState: () => ipcRenderer.invoke('updater:getState'),
    setAutoDownload: (enabled: boolean) => ipcRenderer.invoke('updater:setAutoDownload', enabled),
    onStatus: (callback: (data: any) => void) => {
      const listener = (_event: any, data: any) => callback(data)
      ipcRenderer.on('updater:status', listener)
      return () => { ipcRenderer.removeListener('updater:status', listener) }
    },
  },

  // Security / 2FA operations
  security: {
    setup2FA: () => ipcRenderer.invoke('security:setup2FA'),
    verify2FA: (secret: string, token: string) => ipcRenderer.invoke('security:verify2FA', secret, token),
    enable2FA: (secret: string) => ipcRenderer.invoke('security:enable2FA', secret),
    disable2FA: () => ipcRenderer.invoke('security:disable2FA'),
    get2FAStatus: () => ipcRenderer.invoke('security:get2FAStatus'),
    getIdleTimeout: () => ipcRenderer.invoke('security:getIdleTimeout'),
    setIdleTimeout: (minutes: number) => ipcRenderer.invoke('security:setIdleTimeout', minutes),
  },
})

// Type definitions for TypeScript
export interface ElectronAPI {
  getVersion: () => Promise<string>
  getPath: (name: string) => Promise<string>
  ping: (connectionId: string, dbType: string) => Promise<{ success: boolean; error?: string }>
  mongodb: {
    connect: (connectionId: string, connectionString: string, sshTunnel?: any) => Promise<any>
    disconnect: (connectionId: string) => Promise<void>
    listDatabases: (connectionId: string) => Promise<any[]>
    listCollections: (connectionId: string, dbName: string) => Promise<any[]>
    executeQuery: (connectionId: string, dbName: string, collectionName: string, query: any, options: any) => Promise<any>
    insertDocument: (connectionId: string, dbName: string, collectionName: string, document: any) => Promise<any>
    updateDocument: (connectionId: string, dbName: string, collectionName: string, filter: any, update: any) => Promise<any>
    deleteDocument: (connectionId: string, dbName: string, collectionName: string, filter: any) => Promise<any>
    updateMany: (connectionId: string, dbName: string, collectionName: string, filter: any, update: any) => Promise<any>
    deleteMany: (connectionId: string, dbName: string, collectionName: string, filter: any) => Promise<any>
    countDocuments: (connectionId: string, dbName: string, collectionName: string, filter: any) => Promise<any>
  }
  postgresql: {
    connect: (connectionId: string, connectionString: string, sshTunnel?: any) => Promise<any>
    disconnect: (connectionId: string) => Promise<void>
    listDatabases: (connectionId: string) => Promise<any>
    listTables: (connectionId: string, database: string) => Promise<any>
    executeQuery: (connectionId: string, database: string, table: string, query: string, options: any) => Promise<any>
    findQuery: (connectionId: string, database: string, table: string, filter: any, options: any) => Promise<any>
    insertDocument: (connectionId: string, database: string, table: string, document: any) => Promise<any>
    updateDocument: (connectionId: string, database: string, table: string, filter: any, update: any) => Promise<any>
    deleteDocument: (connectionId: string, database: string, table: string, filter: any) => Promise<any>
    updateMany: (connectionId: string, database: string, table: string, filter: any, update: any) => Promise<any>
    deleteMany: (connectionId: string, database: string, table: string, filter: any) => Promise<any>
    countRows: (connectionId: string, database: string, table: string, filter: any) => Promise<any>
    aggregate: (connectionId: string, database: string, table: string, query: string) => Promise<any>
    getTableSchema: (connectionId: string, database: string, table: string) => Promise<any>
  }
  redis: {
    connect: (connectionId: string, connectionString: string, sshTunnel?: any) => Promise<any>
    disconnect: (connectionId: string) => Promise<void>
    listDatabases: (connectionId: string) => Promise<any>
    listKeys: (connectionId: string, database: string, pattern: string, count: number) => Promise<any>
    getKeyValue: (connectionId: string, database: string, key: string) => Promise<any>
    setKey: (connectionId: string, database: string, key: string, value: any, type: string, ttl?: number) => Promise<any>
    deleteKey: (connectionId: string, database: string, key: string) => Promise<any>
    executeCommand: (connectionId: string, database: string, command: string) => Promise<any>
    getInfo: (connectionId: string) => Promise<any>
  }
  kafka: {
    connect: (connectionId: string, connectionString: string, sshTunnel?: any) => Promise<any>
    disconnect: (connectionId: string) => Promise<any>
    listTopics: (connectionId: string) => Promise<any>
    getTopicMetadata: (connectionId: string, topic: string) => Promise<any>
    consumeMessages: (connectionId: string, topic: string, limit: number, fromBeginning: boolean) => Promise<any>
    produceMessage: (connectionId: string, topic: string, messages: any[]) => Promise<any>
    createTopic: (connectionId: string, topic: string, numPartitions: number, replicationFactor: number) => Promise<any>
    deleteTopic: (connectionId: string, topic: string) => Promise<any>
    getClusterInfo: (connectionId: string) => Promise<any>
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
    getConnections: () => Promise<any[]>
    deleteConnection: (id: string) => Promise<void>
    saveQuery: (query: any) => Promise<any>
    getQueryHistory: (limit?: number) => Promise<any[]>
    saveFavorite: (favorite: any) => Promise<any>
    getFavorites: () => Promise<any[]>
    getQueryTemplates: () => Promise<any[]>
    saveQueryTemplate: (template: any) => Promise<any>
    deleteQueryTemplate: (id: string) => Promise<{ success: boolean }>
  }
  updater: {
    checkForUpdates: () => Promise<{ success: boolean; updateInfo?: any; error?: string }>
    downloadUpdate: () => Promise<{ success: boolean; error?: string }>
    quitAndInstall: () => Promise<{ success: boolean }>
    getState: () => Promise<{
      checking: boolean
      updateAvailable: boolean
      updateDownloaded: boolean
      updateInfo: { version: string; releaseDate: string; releaseNotes: string } | null
      downloadProgress: { percent: number; transferred: number; total: number } | null
      error: string | null
    }>
    setAutoDownload: (enabled: boolean) => Promise<{ success: boolean }>
    onStatus: (callback: (data: any) => void) => () => void
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

