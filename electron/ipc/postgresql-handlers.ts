import { type IpcMain } from 'electron'
import { closeSSHTunnel } from '../ssh-tunnel'
import { applySSHTunnel } from './ssh-helper'
import {
  connectToPostgreSQL, disconnectFromPostgreSQL, pgListDatabases, pgListTables,
  pgExecuteQuery, pgFindQuery, pgInsertDocument, pgUpdateDocument, pgDeleteDocument,
  pgUpdateMany, pgDeleteMany, pgCountRows, pgAggregate, pgGetTableSchema,
  pgCreateDatabase, pgDropDatabase, pgCreateTable, pgDropTable, pgRenameTable,
  pgListIndexes, pgCreateIndex, pgDropIndex, pgExplainQuery, pgGetServerStats,
  pgGetActiveQueries, pgCancelQuery, pgTerminateBackend, pgGetTableDetails,
  pgListRoles, pgListExtensions, pgRunMaintenance, pgGetTableSizes,
} from '../postgresql'

export function setupPostgreSQLHandlers(ipcMain: IpcMain) {
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

  // PostgreSQL Management
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

  // PostgreSQL Tools
  ipcMain.handle('postgresql:getActiveQueries', async (_event, connectionId) => {
    return await pgGetActiveQueries(connectionId)
  })

  ipcMain.handle('postgresql:cancelQuery', async (_event, connectionId, pid) => {
    return await pgCancelQuery(connectionId, pid)
  })

  ipcMain.handle('postgresql:terminateBackend', async (_event, connectionId, pid) => {
    return await pgTerminateBackend(connectionId, pid)
  })

  ipcMain.handle('postgresql:getTableDetails', async (_event, connectionId, database, table) => {
    return await pgGetTableDetails(connectionId, database, table)
  })

  ipcMain.handle('postgresql:listRoles', async (_event, connectionId) => {
    return await pgListRoles(connectionId)
  })

  ipcMain.handle('postgresql:listExtensions', async (_event, connectionId) => {
    return await pgListExtensions(connectionId)
  })

  ipcMain.handle('postgresql:runMaintenance', async (_event, connectionId, database, table, action) => {
    return await pgRunMaintenance(connectionId, database, table, action)
  })

  ipcMain.handle('postgresql:getTableSizes', async (_event, connectionId) => {
    return await pgGetTableSizes(connectionId)
  })
}

