/**
 * Unified Database Service
 * Routes to the correct service (MongoDB, PostgreSQL, Redis, or Kafka) based on connection type
 */

import { mongodbService } from './mongodb.service'
import { postgresqlService } from './postgresql.service'
import { redisService } from './redis.service'
import { kafkaService } from './kafka.service'
import { useConnectionStore } from '@/store/connectionStore'
import type { DatabaseType } from '@/types'

class DatabaseService {
  /** Get the active connection's database type */
  private getActiveType(): DatabaseType {
    const state = useConnectionStore.getState()
    const conn = state.connections.find(c => c.id === state.activeConnectionId)
    return conn?.type || 'mongodb'
  }

  async connect(connectionId: string, connectionString: string, type: DatabaseType): Promise<any> {
    if (type === 'postgresql') return postgresqlService.connect(connectionId, connectionString)
    if (type === 'redis') return redisService.connect(connectionId, connectionString)
    if (type === 'kafka') return kafkaService.connect(connectionId, connectionString)
    return mongodbService.connect(connectionId, connectionString)
  }

  async disconnect(connectionId: string, type?: DatabaseType): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.disconnect(connectionId)
    if (dbType === 'redis') return redisService.disconnect(connectionId)
    if (dbType === 'kafka') return kafkaService.disconnect(connectionId)
    return mongodbService.disconnect(connectionId)
  }

  async listDatabases(connectionId: string, type?: DatabaseType): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.listDatabases(connectionId)
    if (dbType === 'redis') return redisService.listDatabases(connectionId)
    if (dbType === 'kafka') return kafkaService.listTopics(connectionId)
    return mongodbService.listDatabases(connectionId)
  }

  /** List collections (MongoDB), tables (PostgreSQL), keys (Redis), or topics (Kafka) */
  async listCollections(connectionId: string, database: string, type?: DatabaseType): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.listTables(connectionId, database)
    if (dbType === 'redis') return redisService.listKeys(connectionId, database)
    if (dbType === 'kafka') return kafkaService.listTopics(connectionId)
    return mongodbService.listCollections(connectionId, database)
  }

  async executeQuery(
    connectionId: string,
    database: string,
    collection: string,
    query: any,
    options?: any,
    type?: DatabaseType
  ): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') {
      if (typeof query === 'string') {
        return postgresqlService.executeQuery(connectionId, database, collection, query, options)
      }
      return postgresqlService.findQuery(connectionId, database, collection, query, options)
    }
    if (dbType === 'redis') {
      // For Redis: if query is a string, execute as raw command
      if (typeof query === 'string') {
        return redisService.executeCommand(connectionId, database, query)
      }
      // Otherwise get key value
      return redisService.getKeyValue(connectionId, database, collection)
    }
    if (dbType === 'kafka') {
      // For Kafka: consume messages from topic
      return kafkaService.consumeMessages(connectionId, collection, options?.limit || 50, options?.fromBeginning !== false)
    }
    return mongodbService.executeQuery(connectionId, database, collection, query, options)
  }

  async insertDocument(
    connectionId: string,
    database: string,
    collection: string,
    document: any,
    type?: DatabaseType
  ): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.insertDocument(connectionId, database, collection, document)
    if (dbType === 'redis') {
      // For Redis: document should have { key, value, type?, ttl? }
      return redisService.setKey(connectionId, database, document.key || collection, document.value, document.type, document.ttl)
    }
    if (dbType === 'kafka') {
      // For Kafka: produce message to topic
      const messages = Array.isArray(document) ? document : [{ key: document.key, value: typeof document.value === 'string' ? document.value : JSON.stringify(document.value || document) }]
      return kafkaService.produceMessage(connectionId, collection, messages)
    }
    return mongodbService.insertDocument(connectionId, database, collection, document)
  }

  async updateDocument(
    connectionId: string,
    database: string,
    collection: string,
    filter: any,
    update: any,
    type?: DatabaseType
  ): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.updateDocument(connectionId, database, collection, filter, update)
    if (dbType === 'redis') {
      // For Redis: update a key's value
      return redisService.setKey(connectionId, database, collection, update.value, update.type, update.ttl)
    }
    if (dbType === 'kafka') return { success: false, error: 'Kafka messages are immutable' }
    return mongodbService.updateDocument(connectionId, database, collection, filter, update)
  }

  async deleteDocument(
    connectionId: string,
    database: string,
    collection: string,
    filter: any,
    type?: DatabaseType
  ): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.deleteDocument(connectionId, database, collection, filter)
    if (dbType === 'redis') return redisService.deleteKey(connectionId, database, collection)
    if (dbType === 'kafka') return kafkaService.deleteTopic(connectionId, collection)
    return mongodbService.deleteDocument(connectionId, database, collection, filter)
  }

  async aggregate(
    connectionId: string,
    database: string,
    collection: string,
    pipeline: any,
    type?: DatabaseType
  ): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.aggregate(connectionId, database, collection, pipeline)
    if (dbType === 'redis') {
      // For Redis, execute as raw command
      if (typeof pipeline === 'string') {
        return redisService.executeCommand(connectionId, database, pipeline)
      }
      return { success: false, error: 'Redis does not support aggregation pipelines' }
    }
    if (dbType === 'kafka') return { success: false, error: 'Kafka does not support aggregation pipelines' }
    return mongodbService.aggregate(connectionId, database, collection, pipeline)
  }

  async getCollectionStats(
    connectionId: string,
    database: string,
    collection: string,
    type?: DatabaseType
  ): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.getTableSchema(connectionId, database, collection)
    if (dbType === 'redis') return redisService.getKeyValue(connectionId, database, collection)
    if (dbType === 'kafka') return kafkaService.getTopicMetadata(connectionId, collection)
    return mongodbService.getCollectionStats(connectionId, database, collection)
  }

  /* ── Redis-specific methods ── */
  async redisGetKeyValue(connectionId: string, database: string, key: string): Promise<any> {
    return redisService.getKeyValue(connectionId, database, key)
  }

  async redisSetKey(connectionId: string, database: string, key: string, value: any, keyType?: string, ttl?: number): Promise<any> {
    return redisService.setKey(connectionId, database, key, value, keyType, ttl)
  }

  async redisDeleteKey(connectionId: string, database: string, key: string): Promise<any> {
    return redisService.deleteKey(connectionId, database, key)
  }

  async redisExecuteCommand(connectionId: string, database: string, command: string): Promise<any> {
    return redisService.executeCommand(connectionId, database, command)
  }

  async redisGetInfo(connectionId: string): Promise<any> {
    return redisService.getInfo(connectionId)
  }

  /* ── Kafka-specific methods ── */
  async kafkaConsumeMessages(connectionId: string, topic: string, limit?: number, fromBeginning?: boolean): Promise<any> {
    return kafkaService.consumeMessages(connectionId, topic, limit, fromBeginning)
  }

  async kafkaProduceMessage(connectionId: string, topic: string, messages: Array<{ key?: string; value: string }>): Promise<any> {
    return kafkaService.produceMessage(connectionId, topic, messages)
  }

  async kafkaCreateTopic(connectionId: string, topic: string, numPartitions?: number, replicationFactor?: number): Promise<any> {
    return kafkaService.createTopic(connectionId, topic, numPartitions, replicationFactor)
  }

  async kafkaDeleteTopic(connectionId: string, topic: string): Promise<any> {
    return kafkaService.deleteTopic(connectionId, topic)
  }

  async kafkaGetClusterInfo(connectionId: string): Promise<any> {
    return kafkaService.getClusterInfo(connectionId)
  }

  /* ── Database Management ── */
  async createDatabase(connectionId: string, database: string, type?: DatabaseType): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.createDatabase(connectionId, database)
    if (dbType === 'mongodb') return mongodbService.createDatabase(connectionId, database)
    return { success: false, error: `Create database not supported for ${dbType}` }
  }

  async dropDatabase(connectionId: string, database: string, type?: DatabaseType): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.dropDatabase(connectionId, database)
    if (dbType === 'mongodb') return mongodbService.dropDatabase(connectionId, database)
    if (dbType === 'redis') return redisService.flushDatabase(connectionId, database)
    return { success: false, error: `Drop database not supported for ${dbType}` }
  }

  async createCollection(connectionId: string, database: string, name: string, options?: any, type?: DatabaseType): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.createTable(connectionId, database, name, options?.columns || [])
    if (dbType === 'mongodb') return mongodbService.createCollection(connectionId, database, name, options)
    if (dbType === 'kafka') return kafkaService.createTopic(connectionId, name, options?.numPartitions, options?.replicationFactor)
    return { success: false, error: `Create collection not supported for ${dbType}` }
  }

  async dropCollection(connectionId: string, database: string, name: string, type?: DatabaseType): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.dropTable(connectionId, database, name)
    if (dbType === 'mongodb') return mongodbService.dropCollection(connectionId, database, name)
    if (dbType === 'kafka') return kafkaService.deleteTopic(connectionId, name)
    if (dbType === 'redis') return redisService.deleteKey(connectionId, database, name)
    return { success: false, error: `Drop collection not supported for ${dbType}` }
  }

  async renameCollection(connectionId: string, database: string, oldName: string, newName: string, type?: DatabaseType): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.renameTable(connectionId, database, oldName, newName)
    if (dbType === 'mongodb') return mongodbService.renameCollection(connectionId, database, oldName, newName)
    if (dbType === 'redis') return redisService.renameKey(connectionId, database, oldName, newName)
    return { success: false, error: `Rename not supported for ${dbType}` }
  }

  /* ── Index Management ── */
  async listIndexes(connectionId: string, database: string, collection: string, type?: DatabaseType): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.listIndexes(connectionId, database, collection)
    if (dbType === 'mongodb') return mongodbService.listIndexes(connectionId, database, collection)
    return { success: false, error: `Index management not supported for ${dbType}` }
  }

  async createIndex(connectionId: string, database: string, collection: string, keys: any, options?: any, type?: DatabaseType): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.createIndex(connectionId, database, collection, options?.name || `idx_${collection}_${Date.now()}`, Array.isArray(keys) ? keys : Object.keys(keys), options)
    if (dbType === 'mongodb') return mongodbService.createIndex(connectionId, database, collection, keys, options)
    return { success: false, error: `Index management not supported for ${dbType}` }
  }

  async dropIndex(connectionId: string, database: string, collection: string, indexName: string, type?: DatabaseType): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.dropIndex(connectionId, database, indexName)
    if (dbType === 'mongodb') return mongodbService.dropIndex(connectionId, database, collection, indexName)
    return { success: false, error: `Index management not supported for ${dbType}` }
  }

  async explainQuery(connectionId: string, database: string, collection: string, queryOrFilter: any, type?: string): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.explainQuery(connectionId, database, collection, queryOrFilter)
    if (dbType === 'mongodb') return mongodbService.explainQuery(connectionId, database, collection, queryOrFilter)
    return { success: false, error: 'Explain not supported for this database type' }
  }

  async getServerStats(connectionId: string, type?: string): Promise<any> {
    const dbType = type || this.getActiveType()
    if (dbType === 'postgresql') return postgresqlService.getServerStats(connectionId)
    if (dbType === 'mongodb') return mongodbService.getServerStatus(connectionId)
    return { success: false, error: 'Server monitoring not supported for this database type' }
  }
}

export const databaseService = new DatabaseService()

