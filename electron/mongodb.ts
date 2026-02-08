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

