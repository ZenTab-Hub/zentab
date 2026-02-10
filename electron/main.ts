import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { initStorage, migrateSecrets, saveConnection, getConnections, deleteConnection, saveQuery, getSavedQueries, deleteSavedQuery, addQueryHistory, getQueryHistory, getAppSetting, setAppSetting, deleteAppSetting, getQueryTemplates, saveQueryTemplate, deleteQueryTemplate, seedBuiltInTemplates } from './storage'
import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import { connectToMongoDB, disconnectFromMongoDB, pingMongoDB, listDatabases, listCollections, executeQuery, insertDocument, updateDocument, deleteDocument, updateMany, deleteMany, countDocuments, aggregate, getCollectionStats, mongoCreateDatabase, mongoDropDatabase, mongoCreateCollection, mongoDropCollection, mongoRenameCollection, mongoListIndexes, mongoCreateIndex, mongoDropIndex, explainQuery, getServerStatus, disconnectAll as disconnectAllMongo } from './mongodb'
import { connectToPostgreSQL, disconnectFromPostgreSQL, pingPostgreSQL, pgListDatabases, pgListTables, pgExecuteQuery, pgFindQuery, pgInsertDocument, pgUpdateDocument, pgDeleteDocument, pgUpdateMany, pgDeleteMany, pgCountRows, pgAggregate, pgGetTableSchema, pgCreateDatabase, pgDropDatabase, pgCreateTable, pgDropTable, pgRenameTable, pgListIndexes, pgCreateIndex, pgDropIndex, pgExplainQuery, pgGetServerStats, disconnectAll as disconnectAllPg } from './postgresql'
import { connectToRedis, disconnectFromRedis, pingRedis, redisListDatabases, redisListKeys, redisGetKeyValue, redisSetKey, redisDeleteKey, redisExecuteCommand, redisGetInfo, redisFlushDatabase, redisRenameKey, redisGetServerStats, redisGetSlowLog, redisGetClients, redisMemoryUsage, redisBulkDelete, redisBulkTTL, redisAddItem, redisRemoveItem, redisSubscribe, redisUnsubscribe, redisUnsubscribeAll, redisPublish, redisGetPubSubChannels, setPubSubMessageCallback, redisStreamAdd, redisStreamRange, redisStreamLen, redisStreamDel, redisStreamTrim, redisStreamInfo, redisGetKeyEncoding, redisSetKeyTTL, redisCopyKey, disconnectAll as disconnectAllRedis } from './redis'
import { connectToKafka, disconnectFromKafka, pingKafka, kafkaListTopics, kafkaGetTopicMetadata, kafkaConsumeMessages, kafkaProduceMessage, kafkaCreateTopic, kafkaDeleteTopic, kafkaGetClusterInfo, kafkaListConsumerGroups, kafkaDescribeConsumerGroup, kafkaGetConsumerGroupOffsets, kafkaResetConsumerGroupOffsets, kafkaDeleteConsumerGroup, kafkaGetTopicConfig, kafkaAlterTopicConfig, kafkaGetStats, disconnectAll as disconnectAllKafka } from './kafka'
import { createSSHTunnel, closeSSHTunnel, closeAllSSHTunnels, type SSHTunnelConfig } from './ssh-tunnel'
import { initUpdater, setupUpdaterIPC, checkForUpdatesQuietly } from './updater'

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
    title: 'Zentab',
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
  app.setName('Zentab')

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

  // Initialize storage & migrate plaintext secrets to safeStorage
  initStorage()
  migrateSecrets()
  seedBuiltInTemplates()

  createWindow()

  // Initialize auto-updater
  if (mainWindow) {
    initUpdater(mainWindow)
  }
  setupUpdaterIPC()

  // Auto-check for updates if enabled (after a short delay)
  setTimeout(() => {
    try {
      const autoUpdate = getAppSetting('autoUpdate')
      if (autoUpdate !== 'false') {
        checkForUpdatesQuietly()
      }
    } catch (_e) {
      // ignore
    }
  }, 5000)

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

// Graceful disconnect all database connections before quitting
app.on('before-quit', async () => {
  console.log('[App] Gracefully disconnecting all database connections...')
  await Promise.allSettled([
    disconnectAllMongo().catch(() => {}),
    disconnectAllPg().catch(() => {}),
    disconnectAllRedis().catch(() => {}),
    disconnectAllKafka().catch(() => {}),
    closeAllSSHTunnels().catch(() => {}),
  ])
  console.log('[App] All connections closed.')
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

// Query Templates
ipcMain.handle('storage:getQueryTemplates', () => {
  return getQueryTemplates()
})

ipcMain.handle('storage:saveQueryTemplate', (_event, template) => {
  return saveQueryTemplate(template)
})

ipcMain.handle('storage:deleteQueryTemplate', (_event, id) => {
  deleteQueryTemplate(id)
  return { success: true }
})

/**
 * Helper: if SSH tunnel is enabled, create a tunnel and rewrite the connection string
 * to route through localhost:<localPort> instead of the original host:port.
 */
async function applySSHTunnel(
  connectionId: string,
  connectionString: string,
  sshTunnel?: { enabled: boolean; host: string; port: number; username: string; password?: string; privateKey?: string }
): Promise<string> {
  if (!sshTunnel?.enabled) return connectionString

  // Parse host:port from the connection string
  let targetHost = '127.0.0.1'
  let targetPort = 27017
  try {
    const url = new URL(connectionString)
    targetHost = url.hostname || '127.0.0.1'
    targetPort = Number(url.port) || targetPort
  } catch {
    // For non-standard schemes (kafka://), do basic parsing
    const m = connectionString.match(/:\/\/(?:[^@]+@)?([^/:]+)(?::(\d+))?/)
    if (m) {
      targetHost = m[1]
      targetPort = m[2] ? Number(m[2]) : targetPort
    }
  }

  const localPort = await createSSHTunnel(connectionId, sshTunnel, targetHost, targetPort)

  // Replace host:port in the connection string with 127.0.0.1:localPort
  return connectionString.replace(
    /(:\/\/(?:[^@]+@)?)([^/:]+)(:\d+)?/,
    `$1127.0.0.1:${localPort}`
  )
}

// MongoDB IPC Handlers
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
ipcMain.handle('postgresql:connect', async (_event, connectionId, connectionString, sshTunnel) => {
  const finalConnStr = await applySSHTunnel(connectionId, connectionString, sshTunnel)
  return await connectToPostgreSQL(connectionId, finalConnStr)
})

ipcMain.handle('postgresql:disconnect', async (_event, connectionId) => {
  await closeSSHTunnel(connectionId)
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

ipcMain.handle('postgresql:updateMany', async (_event, connectionId, database, table, filter, update) => {
  return await pgUpdateMany(connectionId, database, table, filter, update)
})

ipcMain.handle('postgresql:deleteMany', async (_event, connectionId, database, table, filter) => {
  return await pgDeleteMany(connectionId, database, table, filter)
})

ipcMain.handle('postgresql:countRows', async (_event, connectionId, database, table, filter) => {
  return await pgCountRows(connectionId, database, table, filter)
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
ipcMain.handle('redis:connect', async (_event, connectionId, connectionString, sshTunnel) => {
  const finalConnStr = await applySSHTunnel(connectionId, connectionString, sshTunnel)
  return await connectToRedis(connectionId, finalConnStr)
})

ipcMain.handle('redis:disconnect', async (_event, connectionId) => {
  await closeSSHTunnel(connectionId)
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

// Redis Advanced IPC Handlers
ipcMain.handle('redis:getServerStats', async (_event, connectionId) => {
  return await redisGetServerStats(connectionId)
})
ipcMain.handle('redis:getSlowLog', async (_event, connectionId, count) => {
  return await redisGetSlowLog(connectionId, count)
})
ipcMain.handle('redis:getClients', async (_event, connectionId) => {
  return await redisGetClients(connectionId)
})
ipcMain.handle('redis:memoryUsage', async (_event, connectionId, database, key) => {
  return await redisMemoryUsage(connectionId, database, key)
})
ipcMain.handle('redis:bulkDelete', async (_event, connectionId, database, pattern) => {
  return await redisBulkDelete(connectionId, database, pattern)
})
ipcMain.handle('redis:bulkTTL', async (_event, connectionId, database, pattern, ttl) => {
  return await redisBulkTTL(connectionId, database, pattern, ttl)
})
ipcMain.handle('redis:addItem', async (_event, connectionId, database, key, keyType, field, value, score) => {
  return await redisAddItem(connectionId, database, key, keyType, field, value, score)
})
ipcMain.handle('redis:removeItem', async (_event, connectionId, database, key, keyType, field, index) => {
  return await redisRemoveItem(connectionId, database, key, keyType, field, index)
})

// Redis Pub/Sub IPC Handlers
ipcMain.handle('redis:subscribe', async (_event, connectionId, channels) => {
  return await redisSubscribe(connectionId, channels)
})
ipcMain.handle('redis:unsubscribe', async (_event, connectionId, channels) => {
  return await redisUnsubscribe(connectionId, channels)
})
ipcMain.handle('redis:unsubscribeAll', async (_event, connectionId) => {
  return await redisUnsubscribeAll(connectionId)
})
ipcMain.handle('redis:publish', async (_event, connectionId, channel, message) => {
  return await redisPublish(connectionId, channel, message)
})
ipcMain.handle('redis:getPubSubChannels', async (_event, connectionId) => {
  return await redisGetPubSubChannels(connectionId)
})

// Redis Stream IPC Handlers
ipcMain.handle('redis:streamAdd', async (_event, connectionId, database, key, fields, id) => {
  return await redisStreamAdd(connectionId, database, key, fields, id)
})
ipcMain.handle('redis:streamRange', async (_event, connectionId, database, key, start, end, count) => {
  return await redisStreamRange(connectionId, database, key, start, end, count)
})
ipcMain.handle('redis:streamLen', async (_event, connectionId, database, key) => {
  return await redisStreamLen(connectionId, database, key)
})
ipcMain.handle('redis:streamDel', async (_event, connectionId, database, key, ids) => {
  return await redisStreamDel(connectionId, database, key, ids)
})
ipcMain.handle('redis:streamTrim', async (_event, connectionId, database, key, maxLen) => {
  return await redisStreamTrim(connectionId, database, key, maxLen)
})
ipcMain.handle('redis:streamInfo', async (_event, connectionId, database, key) => {
  return await redisStreamInfo(connectionId, database, key)
})

// Redis Key Encoding, Quick TTL, Copy Key IPC Handlers
ipcMain.handle('redis:getKeyEncoding', async (_event, connectionId, database, key) => {
  return await redisGetKeyEncoding(connectionId, database, key)
})
ipcMain.handle('redis:setKeyTTL', async (_event, connectionId, database, key, ttl) => {
  return await redisSetKeyTTL(connectionId, database, key, ttl)
})
ipcMain.handle('redis:copyKey', async (_event, connectionId, database, sourceKey, destKey) => {
  return await redisCopyKey(connectionId, database, sourceKey, destKey)
})

// Set up pub/sub message forwarding to renderer
setPubSubMessageCallback((connectionId, channel, message) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('redis:pubsubMessage', { connectionId, channel, message, timestamp: Date.now() })
  }
})

// Kafka IPC Handlers
ipcMain.handle('kafka:connect', async (_event, connectionId, connectionString, sshTunnel) => {
  const finalConnStr = await applySSHTunnel(connectionId, connectionString, sshTunnel)
  return await connectToKafka(connectionId, finalConnStr)
})

ipcMain.handle('kafka:disconnect', async (_event, connectionId) => {
  await closeSSHTunnel(connectionId)
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

ipcMain.handle('kafka:listConsumerGroups', async (_event, connectionId) => {
  return await kafkaListConsumerGroups(connectionId)
})

ipcMain.handle('kafka:describeConsumerGroup', async (_event, connectionId, groupId) => {
  return await kafkaDescribeConsumerGroup(connectionId, groupId)
})

ipcMain.handle('kafka:getConsumerGroupOffsets', async (_event, connectionId, groupId, topic) => {
  return await kafkaGetConsumerGroupOffsets(connectionId, groupId, topic)
})

ipcMain.handle('kafka:resetConsumerGroupOffsets', async (_event, connectionId, groupId, topic, earliest) => {
  return await kafkaResetConsumerGroupOffsets(connectionId, groupId, topic, earliest)
})

ipcMain.handle('kafka:deleteConsumerGroup', async (_event, connectionId, groupId) => {
  return await kafkaDeleteConsumerGroup(connectionId, groupId)
})

ipcMain.handle('kafka:getTopicConfig', async (_event, connectionId, topic) => {
  return await kafkaGetTopicConfig(connectionId, topic)
})

ipcMain.handle('kafka:alterTopicConfig', async (_event, connectionId, topic, configEntries) => {
  return await kafkaAlterTopicConfig(connectionId, topic, configEntries)
})

ipcMain.handle('kafka:getStats', async (_event, connectionId) => {
  return await kafkaGetStats(connectionId)
})

// Ping / Health Check IPC Handlers
ipcMain.handle('db:ping', async (_event, connectionId: string, dbType: string) => {
  switch (dbType) {
    case 'mongodb': return await pingMongoDB(connectionId)
    case 'postgresql': return await pingPostgreSQL(connectionId)
    case 'redis': return await pingRedis(connectionId)
    case 'kafka': return await pingKafka(connectionId)
    default: return { success: false, error: `Unsupported database type: ${dbType}` }
  }
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

// 2FA / Security IPC Handlers
ipcMain.handle('security:setup2FA', async () => {
  try {
    const secret = new OTPAuth.Secret({ size: 20 })
    const totp = new OTPAuth.TOTP({
      issuer: 'Zentab',
      label: 'Zentab App',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    })
    const uri = totp.toString()
    const qrDataUrl = await QRCode.toDataURL(uri, { width: 256, margin: 2 })
    return { success: true, secret: secret.base32, uri, qrDataUrl }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('security:verify2FA', async (_event, secret: string, token: string) => {
  try {
    // If secret is '__stored__', read from storage (used by LockScreen)
    let actualSecret = secret
    if (secret === '__stored__') {
      const stored = getAppSetting('2fa_secret')
      if (!stored) return { success: false, error: '2FA secret not found' }
      actualSecret = stored
    }
    const totp = new OTPAuth.TOTP({
      issuer: 'Zentab',
      label: 'Zentab App',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(actualSecret),
    })
    const delta = totp.validate({ token, window: 1 })
    return { success: true, valid: delta !== null }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('security:enable2FA', async (_event, secret: string) => {
  try {
    setAppSetting('2fa_secret', secret)
    setAppSetting('2fa_enabled', 'true')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('security:disable2FA', async () => {
  try {
    deleteAppSetting('2fa_secret')
    deleteAppSetting('2fa_enabled')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('security:get2FAStatus', async () => {
  try {
    const enabled = getAppSetting('2fa_enabled') === 'true'
    const secret = getAppSetting('2fa_secret')
    return { success: true, enabled, hasSecret: !!secret }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('security:getIdleTimeout', async () => {
  const val = getAppSetting('idle_timeout_minutes')
  return { success: true, minutes: val ? parseInt(val) : 30 }
})

ipcMain.handle('security:setIdleTimeout', async (_event, minutes: number) => {
  setAppSetting('idle_timeout_minutes', String(minutes))
  return { success: true }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error)
})

