import Redis from 'ioredis'

interface RedisConnectionInfo {
  client: Redis
}

const connections = new Map<string, RedisConnectionInfo>()

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
      default:
        value = null
    }

    return { success: true, key, type: keyType, ttl, value }
  } catch (error: any) {
    console.error('Redis get key value error:', error)
    return { success: false, error: error.message }
  }
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

