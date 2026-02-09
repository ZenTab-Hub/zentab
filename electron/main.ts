import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { initStorage, saveConnection, getConnections, deleteConnection, saveQuery, getSavedQueries, deleteSavedQuery, addQueryHistory, getQueryHistory } from './storage'
import { connectToMongoDB, disconnectFromMongoDB, listDatabases, listCollections, executeQuery, insertDocument, updateDocument, deleteDocument, aggregate, getCollectionStats, mongoCreateDatabase, mongoDropDatabase, mongoCreateCollection, mongoDropCollection, mongoRenameCollection, mongoListIndexes, mongoCreateIndex, mongoDropIndex, explainQuery, getServerStatus } from './mongodb'
import { connectToPostgreSQL, disconnectFromPostgreSQL, pgListDatabases, pgListTables, pgExecuteQuery, pgFindQuery, pgInsertDocument, pgUpdateDocument, pgDeleteDocument, pgAggregate, pgGetTableSchema, pgCreateDatabase, pgDropDatabase, pgCreateTable, pgDropTable, pgRenameTable, pgListIndexes, pgCreateIndex, pgDropIndex, pgExplainQuery, pgGetServerStats } from './postgresql'
import { connectToRedis, disconnectFromRedis, redisListDatabases, redisListKeys, redisGetKeyValue, redisSetKey, redisDeleteKey, redisExecuteCommand, redisGetInfo, redisFlushDatabase, redisRenameKey } from './redis'
import { connectToKafka, disconnectFromKafka, kafkaListTopics, kafkaGetTopicMetadata, kafkaConsumeMessages, kafkaProduceMessage, kafkaCreateTopic, kafkaDeleteTopic, kafkaGetClusterInfo } from './kafka'

// Disable GPU acceleration for better compatibility
app.disableHardwareAcceleration()

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

let mainWindow: BrowserWindow | null = null

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'QueryAI',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for MongoDB driver
    },
    titleBarStyle: 'default',
    show: false, // Don't show until ready
    // Disable window restoration on macOS
    skipTaskbar: false,
  })

  // Show window when ready to avoid flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Load the app
  const isDev = !app.isPackaged
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // Open DevTools in development
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Disable macOS window restoration prompt
app.on('will-finish-launching', () => {
  app.setActivationPolicy('regular')
})

// App lifecycle
app.whenReady().then(() => {
  // Set app name for macOS menu bar & dock
  app.setName('QueryAI')

  // Set dock icon on macOS (needed for dev mode)
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.join(__dirname, '../build/icon.png')
    try {
      const { nativeImage } = require('electron')
      const icon = nativeImage.createFromPath(iconPath)
      if (!icon.isEmpty()) {
        app.dock.setIcon(icon)
      }
    } catch (_e) {
      // ignore if icon not found
    }
  }

  // Initialize storage
  initStorage()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers
ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

ipcMain.handle('app:getPath', (_event, name: string) => {
  return app.getPath(name as any)
})

// Storage IPC Handlers
ipcMain.handle('storage:saveConnection', (_event, connection) => {
  return saveConnection(connection)
})

ipcMain.handle('storage:getConnections', () => {
  return getConnections()
})

ipcMain.handle('storage:deleteConnection', (_event, id) => {
  deleteConnection(id)
  return { success: true }
})

ipcMain.handle('storage:saveQuery', (_event, query) => {
  return saveQuery(query)
})

ipcMain.handle('storage:getSavedQueries', () => {
  return getSavedQueries()
})

ipcMain.handle('storage:deleteSavedQuery', (_event, id) => {
  deleteSavedQuery(id)
  return { success: true }
})

ipcMain.handle('storage:addQueryHistory', (_event, history) => {
  addQueryHistory(history)
  return { success: true }
})

ipcMain.handle('storage:getQueryHistory', (_event, limit) => {
  return getQueryHistory(limit)
})

// MongoDB IPC Handlers
ipcMain.handle('mongodb:connect', async (_event, connectionId, connectionString) => {
  return await connectToMongoDB(connectionId, connectionString)
})

ipcMain.handle('mongodb:disconnect', async (_event, connectionId) => {
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

ipcMain.handle('mongodb:aggregate', async (_event, connectionId, database, collection, pipeline) => {
  return await aggregate(connectionId, database, collection, pipeline)
})

ipcMain.handle('mongodb:getCollectionStats', async (_event, connectionId, database, collection) => {
  return await getCollectionStats(connectionId, database, collection)
})

// MongoDB Management IPC Handlers
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

// PostgreSQL IPC Handlers
ipcMain.handle('postgresql:connect', async (_event, connectionId, connectionString) => {
  return await connectToPostgreSQL(connectionId, connectionString)
})

ipcMain.handle('postgresql:disconnect', async (_event, connectionId) => {
  return await disconnectFromPostgreSQL(connectionId)
})

ipcMain.handle('postgresql:listDatabases', async (_event, connectionId) => {
  return await pgListDatabases(connectionId)
})

ipcMain.handle('postgresql:listTables', async (_event, connectionId, database) => {
  return await pgListTables(connectionId, database)
})

ipcMain.handle('postgresql:executeQuery', async (_event, connectionId, database, table, query, options) => {
  return await pgExecuteQuery(connectionId, database, table, query, options)
})

ipcMain.handle('postgresql:findQuery', async (_event, connectionId, database, table, filter, options) => {
  return await pgFindQuery(connectionId, database, table, filter, options)
})

ipcMain.handle('postgresql:insertDocument', async (_event, connectionId, database, table, document) => {
  return await pgInsertDocument(connectionId, database, table, document)
})

ipcMain.handle('postgresql:updateDocument', async (_event, connectionId, database, table, filter, update) => {
  return await pgUpdateDocument(connectionId, database, table, filter, update)
})

ipcMain.handle('postgresql:deleteDocument', async (_event, connectionId, database, table, filter) => {
  return await pgDeleteDocument(connectionId, database, table, filter)
})

ipcMain.handle('postgresql:aggregate', async (_event, connectionId, database, table, query) => {
  return await pgAggregate(connectionId, database, table, query)
})

ipcMain.handle('postgresql:getTableSchema', async (_event, connectionId, database, table) => {
  return await pgGetTableSchema(connectionId, database, table)
})

// PostgreSQL Management IPC Handlers
ipcMain.handle('postgresql:createDatabase', async (_event, connectionId, database) => {
  return await pgCreateDatabase(connectionId, database)
})

ipcMain.handle('postgresql:dropDatabase', async (_event, connectionId, database) => {
  return await pgDropDatabase(connectionId, database)
})

ipcMain.handle('postgresql:createTable', async (_event, connectionId, database, table, columns) => {
  return await pgCreateTable(connectionId, database, table, columns)
})

ipcMain.handle('postgresql:dropTable', async (_event, connectionId, database, table) => {
  return await pgDropTable(connectionId, database, table)
})

ipcMain.handle('postgresql:renameTable', async (_event, connectionId, database, oldName, newName) => {
  return await pgRenameTable(connectionId, database, oldName, newName)
})

ipcMain.handle('postgresql:listIndexes', async (_event, connectionId, database, table) => {
  return await pgListIndexes(connectionId, database, table)
})

ipcMain.handle('postgresql:createIndex', async (_event, connectionId, database, table, indexName, columns, options) => {
  return await pgCreateIndex(connectionId, database, table, indexName, columns, options)
})

ipcMain.handle('postgresql:dropIndex', async (_event, connectionId, database, indexName) => {
  return await pgDropIndex(connectionId, database, indexName)
})
ipcMain.handle('postgresql:explainQuery', async (_event, connectionId, database, table, query) => {
  return await pgExplainQuery(connectionId, database, table, query)
})
ipcMain.handle('postgresql:getServerStats', async (_event, connectionId) => {
  return await pgGetServerStats(connectionId)
})

// Redis IPC Handlers
ipcMain.handle('redis:connect', async (_event, connectionId, connectionString) => {
  return await connectToRedis(connectionId, connectionString)
})

ipcMain.handle('redis:disconnect', async (_event, connectionId) => {
  return await disconnectFromRedis(connectionId)
})

ipcMain.handle('redis:listDatabases', async (_event, connectionId) => {
  return await redisListDatabases(connectionId)
})

ipcMain.handle('redis:listKeys', async (_event, connectionId, database, pattern, count) => {
  return await redisListKeys(connectionId, database, pattern, count)
})

ipcMain.handle('redis:getKeyValue', async (_event, connectionId, database, key) => {
  return await redisGetKeyValue(connectionId, database, key)
})

ipcMain.handle('redis:setKey', async (_event, connectionId, database, key, value, type, ttl) => {
  return await redisSetKey(connectionId, database, key, value, type, ttl)
})

ipcMain.handle('redis:deleteKey', async (_event, connectionId, database, key) => {
  return await redisDeleteKey(connectionId, database, key)
})

ipcMain.handle('redis:executeCommand', async (_event, connectionId, database, command) => {
  return await redisExecuteCommand(connectionId, database, command)
})

ipcMain.handle('redis:getInfo', async (_event, connectionId) => {
  return await redisGetInfo(connectionId)
})

// Redis Management IPC Handlers
ipcMain.handle('redis:flushDatabase', async (_event, connectionId, database) => {
  return await redisFlushDatabase(connectionId, database)
})

ipcMain.handle('redis:renameKey', async (_event, connectionId, database, oldKey, newKey) => {
  return await redisRenameKey(connectionId, database, oldKey, newKey)
})

// Kafka IPC Handlers
ipcMain.handle('kafka:connect', async (_event, connectionId, connectionString) => {
  return await connectToKafka(connectionId, connectionString)
})

ipcMain.handle('kafka:disconnect', async (_event, connectionId) => {
  return await disconnectFromKafka(connectionId)
})

ipcMain.handle('kafka:listTopics', async (_event, connectionId) => {
  return await kafkaListTopics(connectionId)
})

ipcMain.handle('kafka:getTopicMetadata', async (_event, connectionId, topic) => {
  return await kafkaGetTopicMetadata(connectionId, topic)
})

ipcMain.handle('kafka:consumeMessages', async (_event, connectionId, topic, limit, fromBeginning) => {
  return await kafkaConsumeMessages(connectionId, topic, limit, fromBeginning)
})

ipcMain.handle('kafka:produceMessage', async (_event, connectionId, topic, messages) => {
  return await kafkaProduceMessage(connectionId, topic, messages)
})

ipcMain.handle('kafka:createTopic', async (_event, connectionId, topic, numPartitions, replicationFactor) => {
  return await kafkaCreateTopic(connectionId, topic, numPartitions, replicationFactor)
})

ipcMain.handle('kafka:deleteTopic', async (_event, connectionId, topic) => {
  return await kafkaDeleteTopic(connectionId, topic)
})

ipcMain.handle('kafka:getClusterInfo', async (_event, connectionId) => {
  return await kafkaGetClusterInfo(connectionId)
})

// File dialog IPC Handlers
ipcMain.handle('dialog:showOpenDialog', async (_event, options) => {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return { canceled: true, filePaths: [] }
  return await dialog.showOpenDialog(win, options)
})

ipcMain.handle('dialog:showSaveDialog', async (_event, options) => {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return { canceled: true, filePath: '' }
  return await dialog.showSaveDialog(win, options)
})

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  return fs.readFileSync(filePath, 'utf-8')
})

ipcMain.handle('fs:writeFile', async (_event, filePath: string, data: string) => {
  fs.writeFileSync(filePath, data, 'utf-8')
  return { success: true }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error)
})

