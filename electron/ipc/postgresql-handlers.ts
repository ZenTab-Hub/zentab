import { type IpcMain } from 'electron'
import { closeSSHTunnel } from '../ssh-tunnel'
import { applySSHTunnel } from './ssh-helper'
import { validated, pgSchemas as s, connectionId as cId, databaseName as db, collectionName as tbl, indexName as idx } from './validation'
import { z } from 'zod'
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
  ipcMain.handle('postgresql:connect', validated(s.connect, async (_event, connectionId, connectionString, sshTunnel) => {
    const finalConnStr = await applySSHTunnel(connectionId, connectionString, sshTunnel)
    return await connectToPostgreSQL(connectionId, finalConnStr)
  }))

  ipcMain.handle('postgresql:disconnect', validated(s.disconnect, async (_event, connectionId) => {
    await closeSSHTunnel(connectionId)
    return await disconnectFromPostgreSQL(connectionId)
  }))

  ipcMain.handle('postgresql:listDatabases', validated(s.listDatabases, async (_event, connectionId) => {
    return await pgListDatabases(connectionId)
  }))

  ipcMain.handle('postgresql:listTables', validated(s.listTables, async (_event, connectionId, database) => {
    return await pgListTables(connectionId, database)
  }))

  ipcMain.handle('postgresql:executeQuery', validated(s.executeQuery, async (_event, connectionId, database, table, query, options) => {
    return await pgExecuteQuery(connectionId, database, table, query, options)
  }))

  ipcMain.handle('postgresql:findQuery', validated(s.findQuery, async (_event, connectionId, database, table, filter, options) => {
    return await pgFindQuery(connectionId, database, table, filter, options)
  }))

  ipcMain.handle('postgresql:insertDocument', validated(s.insertRow, async (_event, connectionId, database, table, document) => {
    return await pgInsertDocument(connectionId, database, table, document)
  }))

  ipcMain.handle('postgresql:updateDocument', validated(s.updateRow, async (_event, connectionId, database, table, filter, update) => {
    return await pgUpdateDocument(connectionId, database, table, filter, update)
  }))

  ipcMain.handle('postgresql:deleteDocument', validated(s.deleteRow, async (_event, connectionId, database, table, filter) => {
    return await pgDeleteDocument(connectionId, database, table, filter)
  }))

  ipcMain.handle('postgresql:updateMany', validated(
    z.tuple([cId, db, tbl, z.record(z.unknown()), z.record(z.unknown())]),
    async (_event, connectionId, database, table, filter, update) => {
      return await pgUpdateMany(connectionId, database, table, filter, update)
    }
  ))

  ipcMain.handle('postgresql:deleteMany', validated(
    z.tuple([cId, db, tbl, z.record(z.unknown())]),
    async (_event, connectionId, database, table, filter) => {
      return await pgDeleteMany(connectionId, database, table, filter)
    }
  ))

  ipcMain.handle('postgresql:countRows', validated(
    z.tuple([cId, db, tbl, z.record(z.unknown())]),
    async (_event, connectionId, database, table, filter) => {
      return await pgCountRows(connectionId, database, table, filter)
    }
  ))

  ipcMain.handle('postgresql:aggregate', validated(
    z.tuple([cId, db, tbl, z.string()]),
    async (_event, connectionId, database, table, query) => {
      return await pgAggregate(connectionId, database, table, query)
    }
  ))

  ipcMain.handle('postgresql:getTableSchema', validated(s.getTableSchema, async (_event, connectionId, database, table) => {
    return await pgGetTableSchema(connectionId, database, table)
  }))

  // PostgreSQL Management
  ipcMain.handle('postgresql:createDatabase', validated(z.tuple([cId, db]), async (_event, connectionId, database) => {
    return await pgCreateDatabase(connectionId, database)
  }))

  ipcMain.handle('postgresql:dropDatabase', validated(z.tuple([cId, db]), async (_event, connectionId, database) => {
    return await pgDropDatabase(connectionId, database)
  }))

  ipcMain.handle('postgresql:createTable', validated(
    z.tuple([cId, db, tbl, z.array(z.record(z.unknown()))]),
    async (_event, connectionId, database, table, columns) => {
      return await pgCreateTable(connectionId, database, table, columns)
    }
  ))

  ipcMain.handle('postgresql:dropTable', validated(z.tuple([cId, db, tbl]), async (_event, connectionId, database, table) => {
    return await pgDropTable(connectionId, database, table)
  }))

  ipcMain.handle('postgresql:renameTable', validated(
    z.tuple([cId, db, z.string().min(1), z.string().min(1)]),
    async (_event, connectionId, database, oldName, newName) => {
      return await pgRenameTable(connectionId, database, oldName, newName)
    }
  ))

  ipcMain.handle('postgresql:listIndexes', validated(z.tuple([cId, db, tbl]), async (_event, connectionId, database, table) => {
    return await pgListIndexes(connectionId, database, table)
  }))

  ipcMain.handle('postgresql:createIndex', validated(
    z.tuple([cId, db, tbl, idx, z.array(z.string()), z.record(z.unknown()).optional()]),
    async (_event, connectionId, database, table, indexName, columns, options) => {
      return await pgCreateIndex(connectionId, database, table, indexName, columns, options)
    }
  ))

  ipcMain.handle('postgresql:dropIndex', validated(z.tuple([cId, db, idx]), async (_event, connectionId, database, indexName) => {
    return await pgDropIndex(connectionId, database, indexName)
  }))

  ipcMain.handle('postgresql:explainQuery', validated(
    z.tuple([cId, db, tbl, z.string()]),
    async (_event, connectionId, database, table, query) => {
      return await pgExplainQuery(connectionId, database, table, query)
    }
  ))

  ipcMain.handle('postgresql:getServerStats', validated(z.tuple([cId]), async (_event, connectionId) => {
    return await pgGetServerStats(connectionId)
  }))

  // PostgreSQL Tools
  ipcMain.handle('postgresql:getActiveQueries', validated(z.tuple([cId]), async (_event, connectionId) => {
    return await pgGetActiveQueries(connectionId)
  }))

  ipcMain.handle('postgresql:cancelQuery', validated(z.tuple([cId, z.number()]), async (_event, connectionId, pid) => {
    return await pgCancelQuery(connectionId, pid)
  }))

  ipcMain.handle('postgresql:terminateBackend', validated(z.tuple([cId, z.number()]), async (_event, connectionId, pid) => {
    return await pgTerminateBackend(connectionId, pid)
  }))

  ipcMain.handle('postgresql:getTableDetails', validated(z.tuple([cId, db, tbl]), async (_event, connectionId, database, table) => {
    return await pgGetTableDetails(connectionId, database, table)
  }))

  ipcMain.handle('postgresql:listRoles', validated(z.tuple([cId]), async (_event, connectionId) => {
    return await pgListRoles(connectionId)
  }))

  ipcMain.handle('postgresql:listExtensions', validated(z.tuple([cId]), async (_event, connectionId) => {
    return await pgListExtensions(connectionId)
  }))

  ipcMain.handle('postgresql:runMaintenance', validated(
    z.tuple([cId, db, tbl, z.enum(['VACUUM', 'ANALYZE', 'REINDEX', 'VACUUM ANALYZE'])]),
    async (_event, connectionId, database, table, action) => {
      return await pgRunMaintenance(connectionId, database, table, action)
    }
  ))

  ipcMain.handle('postgresql:getTableSizes', validated(z.tuple([cId]), async (_event, connectionId) => {
    return await pgGetTableSizes(connectionId)
  }))
}
