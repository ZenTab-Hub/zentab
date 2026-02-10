import { type IpcMain } from 'electron'
import { closeSSHTunnel } from '../ssh-tunnel'
import { applySSHTunnel } from './ssh-helper'
import {
  connectToMongoDB, disconnectFromMongoDB, listDatabases, listCollections,
  executeQuery, insertDocument, updateDocument, deleteDocument,
  updateMany, deleteMany, countDocuments, aggregate, getCollectionStats,
  mongoCreateDatabase, mongoDropDatabase, mongoCreateCollection, mongoDropCollection,
  mongoRenameCollection, mongoListIndexes, mongoCreateIndex, mongoDropIndex,
  explainQuery, getServerStatus,
} from '../mongodb'

export function setupMongoDBHandlers(ipcMain: IpcMain) {
  ipcMain.handle('mongodb:connect', async (_event, connectionId, connectionString, sshTunnel) => {
    const finalConnStr = await applySSHTunnel(connectionId, connectionString, sshTunnel)
    return await connectToMongoDB(connectionId, finalConnStr)
  })

  ipcMain.handle('mongodb:disconnect', async (_event, connectionId) => {
    await closeSSHTunnel(connectionId)
    return await disconnectFromMongoDB(connectionId)
  })

  ipcMain.handle('mongodb:listDatabases', async (_event, connectionId) => {
    return await listDatabases(connectionId)
  })

  ipcMain.handle('mongodb:listCollections', async (_event, connectionId, database) => {
    return await listCollections(connectionId, database)
  })

  ipcMain.handle('mongodb:executeQuery', async (_event, connectionId, database, collection, filter, options) => {
    return await executeQuery(connectionId, database, collection, filter, options)
  })

  ipcMain.handle('mongodb:insertDocument', async (_event, connectionId, database, collection, document) => {
    return await insertDocument(connectionId, database, collection, document)
  })

  ipcMain.handle('mongodb:updateDocument', async (_event, connectionId, database, collection, filter, update) => {
    return await updateDocument(connectionId, database, collection, filter, update)
  })

  ipcMain.handle('mongodb:deleteDocument', async (_event, connectionId, database, collection, filter) => {
    return await deleteDocument(connectionId, database, collection, filter)
  })

  ipcMain.handle('mongodb:updateMany', async (_event, connectionId, database, collection, filter, update) => {
    return await updateMany(connectionId, database, collection, filter, update)
  })

  ipcMain.handle('mongodb:deleteMany', async (_event, connectionId, database, collection, filter) => {
    return await deleteMany(connectionId, database, collection, filter)
  })

  ipcMain.handle('mongodb:countDocuments', async (_event, connectionId, database, collection, filter) => {
    return await countDocuments(connectionId, database, collection, filter)
  })

  ipcMain.handle('mongodb:aggregate', async (_event, connectionId, database, collection, pipeline) => {
    return await aggregate(connectionId, database, collection, pipeline)
  })

  ipcMain.handle('mongodb:getCollectionStats', async (_event, connectionId, database, collection) => {
    return await getCollectionStats(connectionId, database, collection)
  })

  // MongoDB Management
  ipcMain.handle('mongodb:createDatabase', async (_event, connectionId, database) => {
    return await mongoCreateDatabase(connectionId, database)
  })

  ipcMain.handle('mongodb:dropDatabase', async (_event, connectionId, database) => {
    return await mongoDropDatabase(connectionId, database)
  })

  ipcMain.handle('mongodb:createCollection', async (_event, connectionId, database, collection, options) => {
    return await mongoCreateCollection(connectionId, database, collection, options)
  })

  ipcMain.handle('mongodb:dropCollection', async (_event, connectionId, database, collection) => {
    return await mongoDropCollection(connectionId, database, collection)
  })

  ipcMain.handle('mongodb:renameCollection', async (_event, connectionId, database, oldName, newName) => {
    return await mongoRenameCollection(connectionId, database, oldName, newName)
  })

  ipcMain.handle('mongodb:listIndexes', async (_event, connectionId, database, collection) => {
    return await mongoListIndexes(connectionId, database, collection)
  })

  ipcMain.handle('mongodb:createIndex', async (_event, connectionId, database, collection, keys, options) => {
    return await mongoCreateIndex(connectionId, database, collection, keys, options)
  })

  ipcMain.handle('mongodb:dropIndex', async (_event, connectionId, database, collection, indexName) => {
    return await mongoDropIndex(connectionId, database, collection, indexName)
  })

  ipcMain.handle('mongodb:explainQuery', async (_event, connectionId, database, collection, filter) => {
    return await explainQuery(connectionId, database, collection, filter)
  })

  ipcMain.handle('mongodb:getServerStatus', async (_event, connectionId) => {
    return await getServerStatus(connectionId)
  })
}

