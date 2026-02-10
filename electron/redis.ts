import Redis from 'ioredis'

interface RedisConnectionInfo {
  client: Redis
}

const connections = new Map<string, RedisConnectionInfo>()

// Pub/Sub: separate subscriber connections (subscribing puts client in subscriber mode)
interface PubSubInfo {
  subscriber: Redis
  channels: Set<string>
}
const pubsubConnections = new Map<string, PubSubInfo>()
let pubsubMessageCallback: ((connectionId: string, channel: string, message: string) => void) | null = null

/** Set callback for pub/sub messages (called from main.ts) */
export const setPubSubMessageCallback = (cb: (connectionId: string, channel: string, message: string) => void) => {
  pubsubMessageCallback = cb
}

export const connectToRedis = async (connectionId: string, connectionString: string) => {
  try {
    if (connections.has(connectionId)) {
      await disconnectFromRedis(connectionId)
    }

    const client = new Redis(connectionString, {
      connectTimeout: 10000,
      lazyConnect: true,
    })

    await client.connect()
    // Test connection
    await client.ping()

    connections.set(connectionId, { client })
    console.log(`Connected to Redis: ${connectionId}`)
    return { success: true, connectionId }
  } catch (error: any) {
    console.error('Redis connection error:', error)
    return { success: false, error: error.message }
  }
}

export const disconnectFromRedis = async (connectionId: string) => {
  try {
    // Clean up pub/sub subscriber
    const psInfo = pubsubConnections.get(connectionId)
    if (psInfo) {
      try { 
        await psInfo.subscriber.quit() 
      } catch (error) {
        // Ignore quit errors during cleanup
        console.debug('Redis subscriber quit error during cleanup:', error)
      }
      pubsubConnections.delete(connectionId)
    }

    const connection = connections.get(connectionId)
    if (connection) {
      await connection.client.quit()
      connections.delete(connectionId)
      console.log(`Disconnected from Redis: ${connectionId}`)
    }
    return { success: true }
  } catch (error: any) {
    console.error('Redis disconnect error:', error)
    return { success: false, error: error.message }
  }
}

export const pingRedis = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) return { success: false, error: 'Not connected' }
    const result = await connection.client.ping()
    return { success: result === 'PONG' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/** List databases (Redis db indices 0-15) */
export const redisListDatabases = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    // Get number of databases from config
    const configResult = await connection.client.config('GET', 'databases')
    const dbCount = configResult && configResult.length >= 2 ? parseInt(configResult[1]) : 16

    // Get keyspace info to show which DBs have keys
    const info = await connection.client.info('keyspace')
    const keyspaceMap: Record<number, number> = {}
    const lines = info.split('\n')
    for (const line of lines) {
      const match = line.match(/^db(\d+):keys=(\d+)/)
      if (match) {
        keyspaceMap[parseInt(match[1])] = parseInt(match[2])
      }
    }

    const databases = []
    for (let i = 0; i < Math.min(dbCount, 16); i++) {
      databases.push({ name: `db${i}`, keys: keyspaceMap[i] || 0 })
    }

    return { success: true, databases }
  } catch (error: any) {
    console.error('Redis list databases error:', error)
    return { success: false, error: error.message }
  }
}

/** List keys matching a pattern (acts like "collections") */
export const redisListKeys = async (connectionId: string, database: string, pattern: string = '*', count: number = 200) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    // Select the database index
    const dbIndex = parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)

    // Use SCAN to get keys
    const keys: string[] = []
    let cursor = '0'
    do {
      const [nextCursor, batch] = await connection.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = nextCursor
      keys.push(...batch)
      if (keys.length >= count) break
    } while (cursor !== '0')

    // Get types for each key (limit to avoid overload)
    const limitedKeys = keys.slice(0, count)
    const pipeline = connection.client.pipeline()
    for (const key of limitedKeys) {
      pipeline.type(key)
    }
    const types = await pipeline.exec()

    const collections = limitedKeys.map((key, i) => ({
      name: key,
      type: types?.[i]?.[1] || 'unknown',
    }))

    collections.sort((a, b) => a.name.localeCompare(b.name))

    return { success: true, collections }
  } catch (error: any) {
    console.error('Redis list keys error:', error)
    return { success: false, error: error.message }
  }
}

/** Get value of a key based on its type */
export const redisGetKeyValue = async (connectionId: string, database: string, key: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const dbIndex = parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)

    const keyType = await connection.client.type(key)
    const ttl = await connection.client.ttl(key)
    let value: any

    switch (keyType) {
      case 'string':
        value = await connection.client.get(key)
        break
      case 'hash':
        value = await connection.client.hgetall(key)
        break
      case 'list': {
        const len = await connection.client.llen(key)
        value = await connection.client.lrange(key, 0, Math.min(len - 1, 999))
        break
      }
      case 'set':
        value = await connection.client.smembers(key)
        break
      case 'zset':
        value = await connection.client.zrange(key, 0, -1, 'WITHSCORES')
        break
      case 'stream': {
        // Get stream info + recent entries
        const len = await (connection.client as any).call('XLEN', key)
        const entries = await (connection.client as any).call('XRANGE', key, '-', '+', 'COUNT', '200')
        value = { length: len, entries: parseStreamEntries(entries) }
        break
      }
      default:
        value = null
    }

    return { success: true, key, type: keyType, ttl, value }
  } catch (error: any) {
    console.error('Redis get key value error:', error)
    return { success: false, error: error.message }
  }
}

/** Parse stream entries from raw Redis response */
function parseStreamEntries(raw: any[]): Array<{ id: string; fields: Record<string, string> }> {
  if (!Array.isArray(raw)) return []
  return raw.map((entry: any) => {
    const id = String(entry[0])
    const fieldValues = entry[1] || []
    const fields: Record<string, string> = {}
    for (let i = 0; i < fieldValues.length; i += 2) {
      fields[String(fieldValues[i])] = String(fieldValues[i + 1])
    }
    return { id, fields }
  })
}

/** Set a key value */
export const redisSetKey = async (
  connectionId: string,
  database: string,
  key: string,
  value: any,
  type: string = 'string',
  ttl?: number
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const dbIndex = parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)

    switch (type) {
      case 'string':
        await connection.client.set(key, value)
        break
      case 'hash':
        await connection.client.del(key)
        if (typeof value === 'object' && value !== null) {
          const entries = Object.entries(value).flat() as string[]
          if (entries.length > 0) await connection.client.hmset(key, ...entries)
        }
        break
      case 'list':
        await connection.client.del(key)
        if (Array.isArray(value) && value.length > 0) {
          await connection.client.rpush(key, ...value)
        }
        break
      case 'set':
        await connection.client.del(key)
        if (Array.isArray(value) && value.length > 0) {
          await connection.client.sadd(key, ...value)
        }
        break
      default:
        await connection.client.set(key, typeof value === 'string' ? value : JSON.stringify(value))
    }

    if (ttl && ttl > 0) {
      await connection.client.expire(key, ttl)
    }

    return { success: true }
  } catch (error: any) {
    console.error('Redis set key error:', error)
    return { success: false, error: error.message }
  }
}

/** Delete a key */
export const redisDeleteKey = async (connectionId: string, database: string, key: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const dbIndex = parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)

    const result = await connection.client.del(key)
    return { success: true, deletedCount: result }
  } catch (error: any) {
    console.error('Redis delete key error:', error)
    return { success: false, error: error.message }
  }
}

/** Execute a raw Redis command */
export const redisExecuteCommand = async (connectionId: string, database: string, command: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const dbIndex = parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)

    // Parse command string into parts
    const parts = parseRedisCommand(command)
    if (parts.length === 0) throw new Error('Empty command')

    const cmd = parts[0].toUpperCase()
    const args = parts.slice(1)

    const result = await (connection.client as any).call(cmd, ...args)
    return { success: true, result }
  } catch (error: any) {
    console.error('Redis execute command error:', error)
    return { success: false, error: error.message }
  }
}

/** Get Redis server info */
export const redisGetInfo = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const info = await connection.client.info()
    return { success: true, info }
  } catch (error: any) {
    console.error('Redis get info error:', error)
    return { success: false, error: error.message }
  }
}

/** Parse Redis INFO output into structured object */
function parseRedisInfo(info: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {}
  let currentSection = 'default'
  for (const line of info.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      if (trimmed.startsWith('# ')) currentSection = trimmed.slice(2).toLowerCase()
      continue
    }
    const idx = trimmed.indexOf(':')
    if (idx > 0) {
      if (!sections[currentSection]) sections[currentSection] = {}
      sections[currentSection][trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
    }
  }
  return sections
}

/** Get Redis server stats (structured) */
export const redisGetServerStats = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const info = await connection.client.info()
    const parsed = parseRedisInfo(info)
    const server = parsed.server || {}
    const clients = parsed.clients || {}
    const memory = parsed.memory || {}
    const stats = parsed.stats || {}
    const persistence = parsed.persistence || {}
    const replication = parsed.replication || {}
    const keyspace = parsed.keyspace || {}
    const cpu = parsed.cpu || {}

    // Parse keyspace info
    const keyspaceInfo: Array<{ db: string; keys: number; expires: number; avgTtl: number }> = []
    for (const [k, v] of Object.entries(keyspace)) {
      const m = v.match(/keys=(\d+),expires=(\d+),avg_ttl=(\d+)/)
      if (m) keyspaceInfo.push({ db: k, keys: +m[1], expires: +m[2], avgTtl: +m[3] })
    }

    return {
      success: true,
      stats: {
        server: {
          version: server.redis_version || 'N/A',
          mode: server.redis_mode || 'standalone',
          os: server.os || 'N/A',
          uptimeInSeconds: +(server.uptime_in_seconds || 0),
          tcpPort: +(server.tcp_port || 6379),
          configFile: server.config_file || '',
        },
        clients: {
          connected: +(clients.connected_clients || 0),
          blocked: +(clients.blocked_clients || 0),
          maxClients: +(clients.maxclients || 0),
          trackingClients: +(clients.tracking_clients || 0),
        },
        memory: {
          used: +(memory.used_memory || 0),
          usedHuman: memory.used_memory_human || '0B',
          usedPeak: +(memory.used_memory_peak || 0),
          usedPeakHuman: memory.used_memory_peak_human || '0B',
          usedRss: +(memory.used_memory_rss || 0),
          usedRssHuman: memory.used_memory_rss_human || '0B',
          maxMemory: +(memory.maxmemory || 0),
          maxMemoryHuman: memory.maxmemory_human || '0B',
          maxMemoryPolicy: memory.maxmemory_policy || 'noeviction',
          fragRatio: +(memory.mem_fragmentation_ratio || 0),
        },
        stats: {
          totalConnectionsReceived: +(stats.total_connections_received || 0),
          totalCommandsProcessed: +(stats.total_commands_processed || 0),
          instantaneousOpsPerSec: +(stats.instantaneous_ops_per_sec || 0),
          totalNetInputBytes: +(stats.total_net_input_bytes || 0),
          totalNetOutputBytes: +(stats.total_net_output_bytes || 0),
          keyspaceHits: +(stats.keyspace_hits || 0),
          keyspaceMisses: +(stats.keyspace_misses || 0),
          expiredKeys: +(stats.expired_keys || 0),
          evictedKeys: +(stats.evicted_keys || 0),
          pubsubChannels: +(stats.pubsub_channels || 0),
          pubsubPatterns: +(stats.pubsub_patterns || 0),
        },
        persistence: {
          rdbEnabled: persistence.rdb_last_save_time !== undefined,
          rdbLastSaveTime: +(persistence.rdb_last_save_time || 0),
          rdbLastSaveStatus: persistence.rdb_last_bgsave_status || 'N/A',
          rdbChangesSinceLastSave: +(persistence.rdb_changes_since_last_save || 0),
          aofEnabled: persistence.aof_enabled === '1',
          aofRewriteInProgress: persistence.aof_rewrite_in_progress === '1',
          aofLastRewriteStatus: persistence.aof_last_bgrewrite_status || 'N/A',
        },
        replication: {
          role: replication.role || 'master',
          connectedSlaves: +(replication.connected_slaves || 0),
          replOffset: +(replication.master_repl_offset || 0),
        },
        cpu: {
          usedCpuSys: +(cpu.used_cpu_sys || 0),
          usedCpuUser: +(cpu.used_cpu_user || 0),
        },
        keyspace: keyspaceInfo,
      },
    }
  } catch (error: any) {
    console.error('Redis get server stats error:', error)
    return { success: false, error: error.message }
  }
}

/** Get Redis slow log */
export const redisGetSlowLog = async (connectionId: string, count: number = 50) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const result = await (connection.client as any).call('SLOWLOG', 'GET', String(count))
    const entries = (result || []).map((entry: any) => ({
      id: entry[0],
      timestamp: entry[1],
      duration: entry[2], // microseconds
      command: Array.isArray(entry[3]) ? entry[3].join(' ') : String(entry[3]),
      clientAddr: entry[4] || '',
      clientName: entry[5] || '',
    }))

    return { success: true, entries }
  } catch (error: any) {
    console.error('Redis get slow log error:', error)
    return { success: false, error: error.message }
  }
}

/** Get Redis client list */
export const redisGetClients = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const result = await connection.client.client('LIST') as string
    const clients = result.split('\n').filter(l => l.trim()).map(line => {
      const obj: Record<string, string> = {}
      for (const part of line.split(' ')) {
        const idx = part.indexOf('=')
        if (idx > 0) obj[part.slice(0, idx)] = part.slice(idx + 1)
      }
      return obj
    })

    return { success: true, clients }
  } catch (error: any) {
    console.error('Redis get clients error:', error)
    return { success: false, error: error.message }
  }
}

/** Get memory usage for a key */
export const redisMemoryUsage = async (connectionId: string, database: string, key: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const dbIndex = parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)

    const bytes = await (connection.client as any).call('MEMORY', 'USAGE', key)
    return { success: true, bytes: bytes || 0 }
  } catch (error: any) {
    console.error('Redis memory usage error:', error)
    return { success: false, error: error.message }
  }
}

/** Bulk delete keys by pattern */
export const redisBulkDelete = async (connectionId: string, database: string, pattern: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const dbIndex = parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)

    let deleted = 0
    let cursor = '0'
    do {
      const [nextCursor, keys] = await connection.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = nextCursor
      if (keys.length > 0) {
        deleted += await connection.client.del(...keys)
      }
    } while (cursor !== '0')

    return { success: true, deleted }
  } catch (error: any) {
    console.error('Redis bulk delete error:', error)
    return { success: false, error: error.message }
  }
}

/** Set TTL on multiple keys by pattern */
export const redisBulkTTL = async (connectionId: string, database: string, pattern: string, ttl: number) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const dbIndex = parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)

    let updated = 0
    let cursor = '0'
    do {
      const [nextCursor, keys] = await connection.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = nextCursor
      const pipeline = connection.client.pipeline()
      for (const key of keys) {
        if (ttl > 0) pipeline.expire(key, ttl)
        else pipeline.persist(key)
      }
      await pipeline.exec()
      updated += keys.length
    } while (cursor !== '0')

    return { success: true, updated }
  } catch (error: any) {
    console.error('Redis bulk TTL error:', error)
    return { success: false, error: error.message }
  }
}

/** Add/remove individual items from hash/list/set/zset */
export const redisAddItem = async (connectionId: string, database: string, key: string, keyType: string, field: string, value: string, score?: number) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const dbIndex = parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)

    switch (keyType) {
      case 'hash': await connection.client.hset(key, field, value); break
      case 'list': await connection.client.rpush(key, value); break
      case 'set': await connection.client.sadd(key, value); break
      case 'zset': await connection.client.zadd(key, score ?? 0, value); break
      default: throw new Error(`Cannot add item to type: ${keyType}`)
    }

    return { success: true }
  } catch (error: any) {
    console.error('Redis add item error:', error)
    return { success: false, error: error.message }
  }
}

export const redisRemoveItem = async (connectionId: string, database: string, key: string, keyType: string, field: string, index?: number) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const dbIndex = parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)

    switch (keyType) {
      case 'hash': await connection.client.hdel(key, field); break
      case 'list': {
        // Remove by value (first occurrence)
        await connection.client.lrem(key, 1, field)
        break
      }
      case 'set': await connection.client.srem(key, field); break
      case 'zset': await connection.client.zrem(key, field); break
      default: throw new Error(`Cannot remove item from type: ${keyType}`)
    }

    return { success: true }
  } catch (error: any) {
    console.error('Redis remove item error:', error)
    return { success: false, error: error.message }
  }
}

/** Flush all keys in a database */
export const redisFlushDatabase = async (connectionId: string, database: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const dbIndex = parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)
    await connection.client.flushdb()
    return { success: true }
  } catch (error: any) {
    console.error('Redis flush database error:', error)
    return { success: false, error: error.message }
  }
}

/** Rename a key */
export const redisRenameKey = async (connectionId: string, database: string, oldKey: string, newKey: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const dbIndex = parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)
    await connection.client.rename(oldKey, newKey)
    return { success: true }
  } catch (error: any) {
    console.error('Redis rename key error:', error)
    return { success: false, error: error.message }
  }
}

/* ── Pub/Sub ──────────── */

/** Get the subscriber connection, creating one if needed */
const getOrCreateSubscriber = async (connectionId: string): Promise<PubSubInfo> => {
  const existing = pubsubConnections.get(connectionId)
  if (existing) return existing

  const connection = connections.get(connectionId)
  if (!connection) throw new Error('Not connected')

  // Duplicate the main client for subscribing
  const subscriber = connection.client.duplicate()
  await subscriber.connect()

  const psInfo: PubSubInfo = { subscriber, channels: new Set() }

  subscriber.on('message', (channel: string, message: string) => {
    if (pubsubMessageCallback) pubsubMessageCallback(connectionId, channel, message)
  })

  pubsubConnections.set(connectionId, psInfo)
  return psInfo
}

/** Subscribe to one or more channels */
export const redisSubscribe = async (connectionId: string, channels: string[]) => {
  try {
    const psInfo = await getOrCreateSubscriber(connectionId)
    await psInfo.subscriber.subscribe(...channels)
    channels.forEach(ch => psInfo.channels.add(ch))
    return { success: true, channels: Array.from(psInfo.channels) }
  } catch (error: any) {
    console.error('Redis subscribe error:', error)
    return { success: false, error: error.message }
  }
}

/** Unsubscribe from one or more channels */
export const redisUnsubscribe = async (connectionId: string, channels: string[]) => {
  try {
    const psInfo = pubsubConnections.get(connectionId)
    if (!psInfo) return { success: true, channels: [] }
    await psInfo.subscriber.unsubscribe(...channels)
    channels.forEach(ch => psInfo.channels.delete(ch))
    return { success: true, channels: Array.from(psInfo.channels) }
  } catch (error: any) {
    console.error('Redis unsubscribe error:', error)
    return { success: false, error: error.message }
  }
}

/** Unsubscribe from all and close subscriber */
export const redisUnsubscribeAll = async (connectionId: string) => {
  try {
    const psInfo = pubsubConnections.get(connectionId)
    if (psInfo) {
      await psInfo.subscriber.unsubscribe()
      try { 
        await psInfo.subscriber.quit() 
      } catch (error) {
        // Ignore quit errors during cleanup
        console.debug('Redis subscriber quit error:', error)
      }
      pubsubConnections.delete(connectionId)
    }
    return { success: true }
  } catch (error: any) {
    console.error('Redis unsubscribe all error:', error)
    return { success: false, error: error.message }
  }
}

/** Publish a message to a channel */
export const redisPublish = async (connectionId: string, channel: string, message: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')
    const receivers = await connection.client.publish(channel, message)
    return { success: true, receivers }
  } catch (error: any) {
    console.error('Redis publish error:', error)
    return { success: false, error: error.message }
  }
}

/** List active pub/sub channels on the server */
export const redisGetPubSubChannels = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')
    const channels = await connection.client.pubsub('CHANNELS') as string[]
    // Get subscriber count for the current connection
    const psInfo = pubsubConnections.get(connectionId)
    const subscribedChannels = psInfo ? Array.from(psInfo.channels) : []
    return { success: true, channels, subscribedChannels }
  } catch (error: any) {
    console.error('Redis pubsub channels error:', error)
    return { success: false, error: error.message }
  }
}

/* ── Helper: parse Redis command string ──────────── */
function parseRedisCommand(input: string): string[] {
  const parts: string[] = []
  let current = ''
  let inQuote = false
  let quoteChar = ''

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false
      } else {
        current += ch
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true
      quoteChar = ch
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        parts.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }
  if (current) parts.push(current)
  return parts
}



/* ── Stream Operations ──────────── */

/** Add entry to a stream (XADD) */
export const redisStreamAdd = async (connectionId: string, database: string, key: string, fields: Record<string, string>, id: string = '*') => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')
    const dbIndex = Number.parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)
    const args: string[] = [key, id]
    for (const [k, v] of Object.entries(fields)) { args.push(k, v) }
    const entryId = await (connection.client as any).call('XADD', ...args)
    return { success: true, entryId }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/** Read stream entries (XRANGE) */
export const redisStreamRange = async (connectionId: string, database: string, key: string, start: string = '-', end: string = '+', count: number = 200) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')
    const dbIndex = Number.parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)
    const raw = await (connection.client as any).call('XRANGE', key, start, end, 'COUNT', String(count))
    return { success: true, entries: parseStreamEntries(raw) }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/** Get stream length (XLEN) */
export const redisStreamLen = async (connectionId: string, database: string, key: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')
    const dbIndex = Number.parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)
    const len = await (connection.client as any).call('XLEN', key)
    return { success: true, length: len }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/** Delete stream entries (XDEL) */
export const redisStreamDel = async (connectionId: string, database: string, key: string, ids: string[]) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')
    const dbIndex = Number.parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)
    const deleted = await (connection.client as any).call('XDEL', key, ...ids)
    return { success: true, deleted }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/** Trim stream (XTRIM) */
export const redisStreamTrim = async (connectionId: string, database: string, key: string, maxLen: number) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')
    const dbIndex = Number.parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)
    const trimmed = await (connection.client as any).call('XTRIM', key, 'MAXLEN', String(maxLen))
    return { success: true, trimmed }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/** Get stream info (XINFO STREAM) */
export const redisStreamInfo = async (connectionId: string, database: string, key: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')
    const dbIndex = Number.parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)
    const raw = await (connection.client as any).call('XINFO', 'STREAM', key)
    // Parse flat array into object
    const info: Record<string, any> = {}
    for (let i = 0; i < raw.length; i += 2) {
      info[String(raw[i])] = raw[i + 1]
    }
    return { success: true, info }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/* ── Key Encoding ──────────── */

/** Get key encoding (OBJECT ENCODING) */
export const redisGetKeyEncoding = async (connectionId: string, database: string, key: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')
    const dbIndex = Number.parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)
    const encoding = await (connection.client as any).call('OBJECT', 'ENCODING', key)
    return { success: true, encoding }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/* ── Quick TTL ──────────── */

/** Set TTL on a key (EXPIRE / PERSIST) */
export const redisSetKeyTTL = async (connectionId: string, database: string, key: string, ttl: number) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')
    const dbIndex = Number.parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)
    if (ttl > 0) {
      await connection.client.expire(key, ttl)
    } else {
      await connection.client.persist(key)
    }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/* ── Key Copy/Duplicate ──────────── */

/** Copy a key to a new name using DUMP/RESTORE */
export const redisCopyKey = async (connectionId: string, database: string, sourceKey: string, destKey: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')
    const dbIndex = Number.parseInt(database.replace('db', '')) || 0
    await connection.client.select(dbIndex)

    // Check if dest key already exists
    const exists = await connection.client.exists(destKey)
    if (exists) throw new Error(`Key "${destKey}" already exists`)

    // Try COPY command first (Redis 6.2+)
    try {
      await (connection.client as any).call('COPY', sourceKey, destKey)
      // Copy TTL
      const ttl = await connection.client.pttl(sourceKey)
      if (ttl > 0) await connection.client.pexpire(destKey, ttl)
      return { success: true }
    } catch {
      // Fallback: DUMP/RESTORE for older Redis
      const dump = await connection.client.dump(sourceKey)
      if (!dump) throw new Error('Key not found or empty')
      const ttl = await connection.client.pttl(sourceKey)
      await (connection.client as any).call('RESTORE', destKey, ttl > 0 ? String(ttl) : '0', dump)
      return { success: true }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/** Disconnect all Redis connections (used on app quit) */
export const disconnectAll = async () => {
  const tasks = Array.from(connections.keys()).map((id) => disconnectFromRedis(id).catch(() => {}))
  await Promise.allSettled(tasks)
}
