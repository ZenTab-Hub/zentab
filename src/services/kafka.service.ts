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

  async connect(connectionId: string, connectionString: string, sshTunnel?: any): Promise<any> {
    return this.callElectronAPI('connect', connectionId, connectionString, sshTunnel)
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

  /* ── Consumer Groups ── */
  async listConsumerGroups(connectionId: string): Promise<any> {
    return this.callElectronAPI('listConsumerGroups', connectionId)
  }

  async describeConsumerGroup(connectionId: string, groupId: string): Promise<any> {
    return this.callElectronAPI('describeConsumerGroup', connectionId, groupId)
  }

  async getConsumerGroupOffsets(connectionId: string, groupId: string, topic?: string): Promise<any> {
    return this.callElectronAPI('getConsumerGroupOffsets', connectionId, groupId, topic)
  }

  async resetConsumerGroupOffsets(connectionId: string, groupId: string, topic: string, earliest: boolean = true): Promise<any> {
    return this.callElectronAPI('resetConsumerGroupOffsets', connectionId, groupId, topic, earliest)
  }

  async deleteConsumerGroup(connectionId: string, groupId: string): Promise<any> {
    return this.callElectronAPI('deleteConsumerGroup', connectionId, groupId)
  }

  /* ── Topic Configuration ── */
  async getTopicConfig(connectionId: string, topic: string): Promise<any> {
    return this.callElectronAPI('getTopicConfig', connectionId, topic)
  }

  async alterTopicConfig(connectionId: string, topic: string, configEntries: Array<{ name: string; value: string }>): Promise<any> {
    return this.callElectronAPI('alterTopicConfig', connectionId, topic, configEntries)
  }

  /* ── Stats ── */
  async getStats(connectionId: string): Promise<any> {
    return this.callElectronAPI('getStats', connectionId)
  }
}

export const kafkaService = new KafkaService()

