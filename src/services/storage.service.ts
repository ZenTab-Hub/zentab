/**
 * Storage Service
 * This service handles local storage operations (SQLite) through Electron IPC
 */

import { MongoDBConnection, SavedQuery } from '@/types'

class StorageService {
  private async callElectronAPI<T>(method: string, ...args: any[]): Promise<T> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available')
    }
    return (window.electronAPI as any).storage[method](...args)
  }

  // Connection management
  async saveConnection(connection: MongoDBConnection): Promise<MongoDBConnection> {
    return this.callElectronAPI('saveConnection', connection)
  }

  async getConnections(): Promise<MongoDBConnection[]> {
    return this.callElectronAPI('getConnections')
  }

  async deleteConnection(id: string): Promise<void> {
    return this.callElectronAPI('deleteConnection', id)
  }

  // Query management
  async saveQuery(query: SavedQuery): Promise<SavedQuery> {
    return this.callElectronAPI('saveQuery', query)
  }

  async getQueryHistory(limit = 100): Promise<any[]> {
    return this.callElectronAPI('getQueryHistory', limit)
  }

  async saveFavorite(favorite: any): Promise<any> {
    return this.callElectronAPI('saveFavorite', favorite)
  }

  async getFavorites(): Promise<any[]> {
    return this.callElectronAPI('getFavorites')
  }
}

export const storageService = new StorageService()

