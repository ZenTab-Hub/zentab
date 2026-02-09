/**
 * PostgreSQL Service
 * This service handles all PostgreSQL operations through Electron IPC
 */

class PostgreSQLService {
  private async callElectronAPI<T>(method: string, ...args: any[]): Promise<T> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available')
    }
    return (window.electronAPI as any).postgresql[method](...args)
  }

  async connect(connectionId: string, connectionString: string): Promise<any> {
    return this.callElectronAPI('connect', connectionId, connectionString)
  }

  async disconnect(connectionId: string): Promise<void> {
    return this.callElectronAPI('disconnect', connectionId)
  }

  async listDatabases(connectionId: string): Promise<any> {
    return this.callElectronAPI('listDatabases', connectionId)
  }

  async listTables(connectionId: string, database: string): Promise<any> {
    return this.callElectronAPI('listTables', connectionId, database)
  }

  async executeQuery(
    connectionId: string,
    database: string,
    table: string,
    query: string,
    options?: any
  ): Promise<any> {
    return this.callElectronAPI('executeQuery', connectionId, database, table, query, options || {})
  }

  async findQuery(
    connectionId: string,
    database: string,
    table: string,
    filter: any,
    options?: any
  ): Promise<any> {
    return this.callElectronAPI('findQuery', connectionId, database, table, filter, options || {})
  }

  async insertDocument(
    connectionId: string,
    database: string,
    table: string,
    document: any
  ): Promise<any> {
    return this.callElectronAPI('insertDocument', connectionId, database, table, document)
  }

  async updateDocument(
    connectionId: string,
    database: string,
    table: string,
    filter: any,
    update: any
  ): Promise<any> {
    return this.callElectronAPI('updateDocument', connectionId, database, table, filter, update)
  }

  async deleteDocument(
    connectionId: string,
    database: string,
    table: string,
    filter: any
  ): Promise<any> {
    return this.callElectronAPI('deleteDocument', connectionId, database, table, filter)
  }

  async aggregate(
    connectionId: string,
    database: string,
    table: string,
    query: string
  ): Promise<any> {
    return this.callElectronAPI('aggregate', connectionId, database, table, query)
  }

  async getTableSchema(
    connectionId: string,
    database: string,
    table: string
  ): Promise<any> {
    return this.callElectronAPI('getTableSchema', connectionId, database, table)
  }

  // Database management
  async createDatabase(connectionId: string, database: string): Promise<any> {
    return this.callElectronAPI('createDatabase', connectionId, database)
  }

  async dropDatabase(connectionId: string, database: string): Promise<any> {
    return this.callElectronAPI('dropDatabase', connectionId, database)
  }

  async createTable(connectionId: string, database: string, table: string, columns: any[]): Promise<any> {
    return this.callElectronAPI('createTable', connectionId, database, table, columns)
  }

  async dropTable(connectionId: string, database: string, table: string): Promise<any> {
    return this.callElectronAPI('dropTable', connectionId, database, table)
  }

  async renameTable(connectionId: string, database: string, oldName: string, newName: string): Promise<any> {
    return this.callElectronAPI('renameTable', connectionId, database, oldName, newName)
  }

  // Index management
  async listIndexes(connectionId: string, database: string, table: string): Promise<any> {
    return this.callElectronAPI('listIndexes', connectionId, database, table)
  }

  async createIndex(connectionId: string, database: string, table: string, indexName: string, columns: string[], options?: any): Promise<any> {
    return this.callElectronAPI('createIndex', connectionId, database, table, indexName, columns, options)
  }

  async dropIndex(connectionId: string, database: string, indexName: string): Promise<any> {
    return this.callElectronAPI('dropIndex', connectionId, database, indexName)
  }

  async explainQuery(connectionId: string, database: string, table: string, query: string): Promise<any> {
    return this.callElectronAPI('explainQuery', connectionId, database, table, query)
  }

  async getServerStats(connectionId: string): Promise<any> {
    return this.callElectronAPI('getServerStats', connectionId)
  }
}

export const postgresqlService = new PostgreSQLService()

