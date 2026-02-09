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

  async connect(connectionId: string, connectionString: string, sshTunnel?: any): Promise<any> {
    return this.callElectronAPI('connect', connectionId, connectionString, sshTunnel)
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

  // Advanced
  async getServerStats(connectionId: string): Promise<any> {
    return this.callElectronAPI('getServerStats', connectionId)
  }

  async getSlowLog(connectionId: string, count?: number): Promise<any> {
    return this.callElectronAPI('getSlowLog', connectionId, count || 50)
  }

  async getClients(connectionId: string): Promise<any> {
    return this.callElectronAPI('getClients', connectionId)
  }

  async memoryUsage(connectionId: string, database: string, key: string): Promise<any> {
    return this.callElectronAPI('memoryUsage', connectionId, database, key)
  }

  async bulkDelete(connectionId: string, database: string, pattern: string): Promise<any> {
    return this.callElectronAPI('bulkDelete', connectionId, database, pattern)
  }

  async bulkTTL(connectionId: string, database: string, pattern: string, ttl: number): Promise<any> {
    return this.callElectronAPI('bulkTTL', connectionId, database, pattern, ttl)
  }

  async addItem(connectionId: string, database: string, key: string, keyType: string, field: string, value: string, score?: number): Promise<any> {
    return this.callElectronAPI('addItem', connectionId, database, key, keyType, field, value, score)
  }

  async removeItem(connectionId: string, database: string, key: string, keyType: string, field: string, index?: number): Promise<any> {
    return this.callElectronAPI('removeItem', connectionId, database, key, keyType, field, index)
  }

  // Pub/Sub
  async subscribe(connectionId: string, channels: string[]): Promise<any> {
    return this.callElectronAPI('subscribe', connectionId, channels)
  }

  async unsubscribe(connectionId: string, channels: string[]): Promise<any> {
    return this.callElectronAPI('unsubscribe', connectionId, channels)
  }

  async unsubscribeAll(connectionId: string): Promise<any> {
    return this.callElectronAPI('unsubscribeAll', connectionId)
  }

  async publish(connectionId: string, channel: string, message: string): Promise<any> {
    return this.callElectronAPI('publish', connectionId, channel, message)
  }

  async getPubSubChannels(connectionId: string): Promise<any> {
    return this.callElectronAPI('getPubSubChannels', connectionId)
  }

  onPubSubMessage(callback: (data: { connectionId: string; channel: string; message: string; timestamp: number }) => void): () => void {
    if (!window.electronAPI) return () => {}
    return (window.electronAPI as any).redis.onPubSubMessage(callback)
  }
}

export const redisService = new RedisService()

