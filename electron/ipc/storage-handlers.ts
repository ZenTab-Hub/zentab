import { type IpcMain } from 'electron'
import {
  saveConnection, getConnections, deleteConnection,
  saveQuery, getSavedQueries, deleteSavedQuery,
  addQueryHistory, getQueryHistory,
  getQueryTemplates, saveQueryTemplate, deleteQueryTemplate,
} from '../storage'

export function setupStorageHandlers(ipcMain: IpcMain) {
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
}

