/**
 * MongoDB Service
 * This service handles all MongoDB operations through Electron IPC
 */

import { QueryFilter, QueryOptions, QueryResult } from '@/types'

class MongoDBService {
  private async callElectronAPI<T>(method: string, ...args: any[]): Promise<T> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available')
    }
    return (window.electronAPI as any).mongodb[method](...args)
  }

  async connect(connectionId: string, connectionString: string, sshTunnel?: any): Promise<any> {
    return this.callElectronAPI('connect', connectionId, connectionString, sshTunnel)
  }

  async disconnect(connectionId: string): Promise<void> {
    return this.callElectronAPI('disconnect', connectionId)
  }

  async listDatabases(connectionId: string): Promise<any[]> {
    return this.callElectronAPI('listDatabases', connectionId)
  }

  async listCollections(connectionId: string, dbName: string): Promise<any[]> {
    return this.callElectronAPI('listCollections', connectionId, dbName)
  }

  async executeQuery(
    connectionId: string,
    dbName: string,
    collectionName: string,
    filter: QueryFilter,
    options?: QueryOptions
  ): Promise<QueryResult> {
    const opts = options || {}
    console.log('MongoDBService.executeQuery called with options:', opts)
    return this.callElectronAPI('executeQuery', connectionId, dbName, collectionName, filter, opts)
  }

  async insertDocument(
    connectionId: string,
    dbName: string,
    collectionName: string,
    document: any
  ): Promise<any> {
    return this.callElectronAPI('insertDocument', connectionId, dbName, collectionName, document)
  }

  async updateDocument(
    connectionId: string,
    dbName: string,
    collectionName: string,
    filter: QueryFilter,
    update: any
  ): Promise<any> {
    return this.callElectronAPI(
      'updateDocument',
      connectionId,
      dbName,
      collectionName,
      filter,
      update
    )
  }

  async deleteDocument(
    connectionId: string,
    dbName: string,
    collectionName: string,
    filter: QueryFilter
  ): Promise<any> {
    return this.callElectronAPI('deleteDocument', connectionId, dbName, collectionName, filter)
  }

  async updateMany(
    connectionId: string,
    dbName: string,
    collectionName: string,
    filter: any,
    update: any
  ): Promise<any> {
    return this.callElectronAPI('updateMany', connectionId, dbName, collectionName, filter, update)
  }

  async deleteMany(
    connectionId: string,
    dbName: string,
    collectionName: string,
    filter: any
  ): Promise<any> {
    return this.callElectronAPI('deleteMany', connectionId, dbName, collectionName, filter)
  }

  async countDocuments(
    connectionId: string,
    dbName: string,
    collectionName: string,
    filter: any
  ): Promise<any> {
    return this.callElectronAPI('countDocuments', connectionId, dbName, collectionName, filter)
  }

  async aggregate(
    connectionId: string,
    dbName: string,
    collectionName: string,
    pipeline: any[]
  ): Promise<any[]> {
    return this.callElectronAPI('aggregate', connectionId, dbName, collectionName, pipeline)
  }

  async getCollectionStats(
    connectionId: string,
    dbName: string,
    collectionName: string
  ): Promise<any> {
    return this.callElectronAPI('getCollectionStats', connectionId, dbName, collectionName)
  }

  // Database management
  async createDatabase(connectionId: string, database: string): Promise<any> {
    return this.callElectronAPI('createDatabase', connectionId, database)
  }

  async dropDatabase(connectionId: string, database: string): Promise<any> {
    return this.callElectronAPI('dropDatabase', connectionId, database)
  }

  async createCollection(connectionId: string, database: string, collection: string, options?: any): Promise<any> {
    return this.callElectronAPI('createCollection', connectionId, database, collection, options)
  }

  async dropCollection(connectionId: string, database: string, collection: string): Promise<any> {
    return this.callElectronAPI('dropCollection', connectionId, database, collection)
  }

  async renameCollection(connectionId: string, database: string, oldName: string, newName: string): Promise<any> {
    return this.callElectronAPI('renameCollection', connectionId, database, oldName, newName)
  }

  async createIndex(
    connectionId: string,
    dbName: string,
    collectionName: string,
    indexSpec: any,
    options?: any
  ): Promise<any> {
    return this.callElectronAPI(
      'createIndex',
      connectionId,
      dbName,
      collectionName,
      indexSpec,
      options
    )
  }

  async dropIndex(
    connectionId: string,
    dbName: string,
    collectionName: string,
    indexName: string
  ): Promise<any> {
    return this.callElectronAPI('dropIndex', connectionId, dbName, collectionName, indexName)
  }

  async listIndexes(
    connectionId: string,
    dbName: string,
    collectionName: string
  ): Promise<any[]> {
    return this.callElectronAPI('listIndexes', connectionId, dbName, collectionName)
  }

  async explainQuery(connectionId: string, database: string, collection: string, filter: any): Promise<any> {
    return this.callElectronAPI('explainQuery', connectionId, database, collection, filter)
  }

  async getServerStatus(connectionId: string): Promise<any> {
    return this.callElectronAPI('getServerStatus', connectionId)
  }
}

export const mongodbService = new MongoDBService()

