/**
 * Redis Service
 * This service handles all Redis operations through Electron IPC
 */

class RedisService {
  private async callElectronAPI<T>(method: string, ...args: any[]): Promise<T> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available')
    }
    return (window.electronAPI as any).redis[method](...args)
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

  async listKeys(connectionId: string, database: string, pattern?: string, count?: number): Promise<any> {
    return this.callElectronAPI('listKeys', connectionId, database, pattern || '*', count || 200)
  }

  async getKeyValue(connectionId: string, database: string, key: string): Promise<any> {
    return this.callElectronAPI('getKeyValue', connectionId, database, key)
  }

  async setKey(
    connectionId: string,
    database: string,
    key: string,
    value: any,
    type?: string,
    ttl?: number
  ): Promise<any> {
    return this.callElectronAPI('setKey', connectionId, database, key, value, type || 'string', ttl)
  }

  async deleteKey(connectionId: string, database: string, key: string): Promise<any> {
    return this.callElectronAPI('deleteKey', connectionId, database, key)
  }

  async executeCommand(connectionId: string, database: string, command: string): Promise<any> {
    return this.callElectronAPI('executeCommand', connectionId, database, command)
  }

  async getInfo(connectionId: string): Promise<any> {
    return this.callElectronAPI('getInfo', connectionId)
  }

  // Management
  async flushDatabase(connectionId: string, database: string): Promise<any> {
    return this.callElectronAPI('flushDatabase', connectionId, database)
  }

  async renameKey(connectionId: string, database: string, oldKey: string, newKey: string): Promise<any> {
    return this.callElectronAPI('renameKey', connectionId, database, oldKey, newKey)
  }
}

export const redisService = new RedisService()

