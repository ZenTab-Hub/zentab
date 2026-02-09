import { MongoClient, Db, ObjectId } from 'mongodb'

interface ConnectionInfo {
  client: MongoClient
  db?: Db
}

const connections = new Map<string, ConnectionInfo>()

export const connectToMongoDB = async (connectionId: string, connectionString: string) => {
  try {
    // Close existing connection if any
    if (connections.has(connectionId)) {
      await disconnectFromMongoDB(connectionId)
    }

    const client = new MongoClient(connectionString, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    })

    await client.connect()

    // Test connection
    await client.db('admin').command({ ping: 1 })

    connections.set(connectionId, { client })

    console.log(`Connected to MongoDB: ${connectionId}`)
    return { success: true, connectionId }
  } catch (error: any) {
    console.error('MongoDB connection error:', error)
    return { success: false, error: error.message }
  }
}

export const disconnectFromMongoDB = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (connection) {
      await connection.client.close()
      connections.delete(connectionId)
      console.log(`Disconnected from MongoDB: ${connectionId}`)
    }
    return { success: true }
  } catch (error: any) {
    console.error('MongoDB disconnect error:', error)
    return { success: false, error: error.message }
  }
}

export const listDatabases = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) {
      throw new Error('Not connected')
    }

    const result = await connection.client.db('admin').admin().listDatabases()
    return { success: true, databases: result.databases }
  } catch (error: any) {
    console.error('List databases error:', error)
    return { success: false, error: error.message }
  }
}

export const listCollections = async (connectionId: string, database: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) {
      throw new Error('Not connected')
    }

    const db = connection.client.db(database)
    const collections = await db.listCollections().toArray()

    return { success: true, collections }
  } catch (error: any) {
    console.error('List collections error:', error)
    return { success: false, error: error.message }
  }
}

export const executeQuery = async (
  connectionId: string,
  database: string,
  collection: string,
  filter: any = {},
  options: any = {}
) => {
  try {
    console.log('executeQuery called:', { connectionId, database, collection, filter, options })

    const connection = connections.get(connectionId)
    if (!connection) {
      throw new Error('Not connected')
    }

    const db = connection.client.db(database)
    const coll = db.collection(collection)

    const limit = options.limit || 100
    const skip = options.skip || 0
    const sort = options.sort || {}

    console.log('Executing find query with:', { filter, sort, skip, limit })
    const documents = await coll.find(filter).sort(sort).skip(skip).limit(limit).toArray()
    const totalCount = await coll.countDocuments(filter)

    console.log('Query result:', { totalCount, returnedCount: documents.length })

    return {
      success: true,
      documents,
      totalCount,
      returnedCount: documents.length,
    }
  } catch (error: any) {
    console.error('Execute query error:', error)
    return { success: false, error: error.message }
  }
}

export const insertDocument = async (
  connectionId: string,
  database: string,
  collection: string,
  document: any
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) {
      throw new Error('Not connected')
    }

    const db = connection.client.db(database)
    const coll = db.collection(collection)

    const result = await coll.insertOne(document)

    return {
      success: true,
      insertedId: result.insertedId,
    }
  } catch (error: any) {
    console.error('Insert document error:', error)
    return { success: false, error: error.message }
  }
}

export const updateDocument = async (
  connectionId: string,
  database: string,
  collection: string,
  filter: any,
  update: any
) => {
  try {
    console.log('updateDocument called:', { connectionId, database, collection, filter, update })

    const connection = connections.get(connectionId)
    if (!connection) {
      throw new Error('Not connected')
    }

    const db = connection.client.db(database)
    const coll = db.collection(collection)

    // Remove _id from update to avoid "Performing an update on the path '_id' would modify the immutable field '_id'"
    const { _id, ...updateFields } = update

    console.log('Executing updateOne with filter:', filter, 'update:', updateFields)
    const result = await coll.updateOne(filter, { $set: updateFields })

    console.log('Update result:', { modifiedCount: result.modifiedCount, matchedCount: result.matchedCount })

    return {
      success: true,
      modifiedCount: result.modifiedCount,
    }
  } catch (error: any) {
    console.error('Update document error:', error)
    return { success: false, error: error.message }
  }
}

export const deleteDocument = async (
  connectionId: string,
  database: string,
  collection: string,
  filter: any
) => {
  try {
    console.log('deleteDocument called:', { connectionId, database, collection, filter })

    const connection = connections.get(connectionId)
    if (!connection) {
      throw new Error('Not connected')
    }

    const db = connection.client.db(database)
    const coll = db.collection(collection)

    console.log('Executing deleteOne with filter:', filter)
    const result = await coll.deleteOne(filter)

    console.log('Delete result:', { deletedCount: result.deletedCount })

    return {
      success: true,
      deletedCount: result.deletedCount,
    }
  } catch (error: any) {
    console.error('Delete document error:', error)
    return { success: false, error: error.message }
  }
}

export const aggregate = async (
  connectionId: string,
  database: string,
  collection: string,
  pipeline: any[]
) => {
  try {
    console.log('aggregate called:', { connectionId, database, collection, pipeline })

    const connection = connections.get(connectionId)
    if (!connection) {
      throw new Error('Not connected')
    }

    const db = connection.client.db(database)
    const coll = db.collection(collection)

    console.log('Executing aggregation pipeline:', JSON.stringify(pipeline, null, 2))
    const documents = await coll.aggregate(pipeline).toArray()

    console.log('Aggregation result:', { returnedCount: documents.length })

    return {
      success: true,
      documents,
    }
  } catch (error: any) {
    console.error('Aggregate error:', error)
    return { success: false, error: error.message }
  }
}

export const getCollectionStats = async (
  connectionId: string,
  database: string,
  collection: string
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) {
      throw new Error('Not connected')
    }

    const db = connection.client.db(database)
    const stats = await db.command({ collStats: collection })

    return {
      success: true,
      stats,
    }
  } catch (error: any) {
    console.error('Get collection stats error:', error)
    return { success: false, error: error.message }
  }
}

/* ── Database Management ──────────────────────────────── */

export const mongoCreateDatabase = async (connectionId: string, database: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    // MongoDB creates databases implicitly when you write to them
    // Create a temp collection then drop it to register the database
    const db = connection.client.db(database)
    await db.createCollection('__queryai_init__')
    await db.dropCollection('__queryai_init__')

    return { success: true }
  } catch (error: any) {
    console.error('Create database error:', error)
    return { success: false, error: error.message }
  }
}

export const mongoDropDatabase = async (connectionId: string, database: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    await connection.client.db(database).dropDatabase()
    return { success: true }
  } catch (error: any) {
    console.error('Drop database error:', error)
    return { success: false, error: error.message }
  }
}

export const mongoCreateCollection = async (
  connectionId: string,
  database: string,
  collection: string,
  options?: { capped?: boolean; size?: number; max?: number }
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const db = connection.client.db(database)
    await db.createCollection(collection, options || {})
    return { success: true }
  } catch (error: any) {
    console.error('Create collection error:', error)
    return { success: false, error: error.message }
  }
}

export const mongoDropCollection = async (connectionId: string, database: string, collection: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    await connection.client.db(database).dropCollection(collection)
    return { success: true }
  } catch (error: any) {
    console.error('Drop collection error:', error)
    return { success: false, error: error.message }
  }
}

export const mongoRenameCollection = async (
  connectionId: string,
  database: string,
  oldName: string,
  newName: string
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    await connection.client.db(database).renameCollection(oldName, newName)
    return { success: true }
  } catch (error: any) {
    console.error('Rename collection error:', error)
    return { success: false, error: error.message }
  }
}

/* ── Index Management ─────────────────────────────────── */

export const mongoListIndexes = async (connectionId: string, database: string, collection: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const indexes = await connection.client.db(database).collection(collection).listIndexes().toArray()
    return { success: true, indexes }
  } catch (error: any) {
    console.error('List indexes error:', error)
    return { success: false, error: error.message }
  }
}

export const mongoCreateIndex = async (
  connectionId: string,
  database: string,
  collection: string,
  keys: any,
  options?: { name?: string; unique?: boolean; sparse?: boolean; expireAfterSeconds?: number; background?: boolean }
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const result = await connection.client.db(database).collection(collection).createIndex(keys, options || {})
    return { success: true, indexName: result }
  } catch (error: any) {
    console.error('Create index error:', error)
    return { success: false, error: error.message }
  }
}

export const mongoDropIndex = async (connectionId: string, database: string, collection: string, indexName: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    await connection.client.db(database).collection(collection).dropIndex(indexName)
    return { success: true }
  } catch (error: any) {
    console.error('Drop index error:', error)
    return { success: false, error: error.message }
  }
}

export const explainQuery = async (
  connectionId: string,
  database: string,
  collection: string,
  filter: any = {}
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const db = connection.client.db(database)
    const coll = db.collection(collection)

    const explanation = await coll.find(filter).explain('executionStats')

    return { success: true, explain: explanation }
  } catch (error: any) {
    console.error('Explain query error:', error)
    return { success: false, error: error.message }
  }
}

export const getServerStatus = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const admin = connection.client.db('admin')
    const serverStatus = await admin.command({ serverStatus: 1 })

    return {
      success: true,
      stats: {
        host: serverStatus.host,
        version: serverStatus.version,
        uptime: serverStatus.uptime,
        connections: serverStatus.connections,
        opcounters: serverStatus.opcounters,
        mem: serverStatus.mem,
        network: serverStatus.network,
        storageEngine: serverStatus.storageEngine?.name,
        repl: serverStatus.repl ? { setName: serverStatus.repl.setName, ismaster: serverStatus.repl.ismaster } : null,
      },
    }
  } catch (error: any) {
    console.error('Server status error:', error)
    return { success: false, error: error.message }
  }
}

