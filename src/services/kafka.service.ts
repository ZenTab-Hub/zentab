/**
 * Kafka Frontend Service
 * Calls Electron IPC for Kafka operations
 */

class KafkaService {
  private async callElectronAPI<T>(method: string, ...args: any[]): Promise<T> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available')
    }
    return (window.electronAPI as any).kafka[method](...args)
  }

  async connect(connectionId: string, connectionString: string): Promise<any> {
    return this.callElectronAPI('connect', connectionId, connectionString)
  }

  async disconnect(connectionId: string): Promise<any> {
    return this.callElectronAPI('disconnect', connectionId)
  }

  async listTopics(connectionId: string): Promise<any> {
    return this.callElectronAPI('listTopics', connectionId)
  }

  async getTopicMetadata(connectionId: string, topic: string): Promise<any> {
    return this.callElectronAPI('getTopicMetadata', connectionId, topic)
  }

  async consumeMessages(connectionId: string, topic: string, limit?: number, fromBeginning?: boolean): Promise<any> {
    return this.callElectronAPI('consumeMessages', connectionId, topic, limit || 50, fromBeginning !== false)
  }

  async produceMessage(connectionId: string, topic: string, messages: Array<{ key?: string; value: string; headers?: Record<string, string> }>): Promise<any> {
    return this.callElectronAPI('produceMessage', connectionId, topic, messages)
  }

  async createTopic(connectionId: string, topic: string, numPartitions?: number, replicationFactor?: number): Promise<any> {
    return this.callElectronAPI('createTopic', connectionId, topic, numPartitions || 1, replicationFactor || 1)
  }

  async deleteTopic(connectionId: string, topic: string): Promise<any> {
    return this.callElectronAPI('deleteTopic', connectionId, topic)
  }

  async getClusterInfo(connectionId: string): Promise<any> {
    return this.callElectronAPI('getClusterInfo', connectionId)
  }
}

export const kafkaService = new KafkaService()

