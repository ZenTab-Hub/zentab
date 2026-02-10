import { type IpcMain, type BrowserWindow } from 'electron'
import { closeSSHTunnel } from '../ssh-tunnel'
import { applySSHTunnel } from './ssh-helper'
import {
  connectToRedis, disconnectFromRedis, redisListDatabases, redisListKeys,
  redisGetKeyValue, redisSetKey, redisDeleteKey, redisExecuteCommand, redisGetInfo,
  redisFlushDatabase, redisRenameKey, redisGetServerStats, redisGetSlowLog,
  redisGetClients, redisMemoryUsage, redisBulkDelete, redisBulkTTL,
  redisAddItem, redisRemoveItem,
  redisSubscribe, redisUnsubscribe, redisUnsubscribeAll, redisPublish, redisGetPubSubChannels,
  setPubSubMessageCallback,
  redisStreamAdd, redisStreamRange, redisStreamLen, redisStreamDel, redisStreamTrim, redisStreamInfo,
  redisGetKeyEncoding, redisSetKeyTTL, redisCopyKey,
} from '../redis'

export function setupRedisHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null) {
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

  // Redis Management
  ipcMain.handle('redis:flushDatabase', async (_event, connectionId, database) => {
    return await redisFlushDatabase(connectionId, database)
  })

  ipcMain.handle('redis:renameKey', async (_event, connectionId, database, oldKey, newKey) => {
    return await redisRenameKey(connectionId, database, oldKey, newKey)
  })

  // Redis Advanced
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

  // Redis Pub/Sub
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

  // Redis Streams
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

  // Redis Key Encoding, Quick TTL, Copy Key
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
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('redis:pubsubMessage', { connectionId, channel, message, timestamp: Date.now() })
    }
  })
}

