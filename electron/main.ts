import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { initStorage, saveConnection, getConnections, deleteConnection, saveQuery, getSavedQueries, deleteSavedQuery, addQueryHistory, getQueryHistory } from './storage'
import { connectToMongoDB, disconnectFromMongoDB, listDatabases, listCollections, executeQuery, insertDocument, updateDocument, deleteDocument, getCollectionStats } from './mongodb'

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
    title: 'MongoStudio',
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

ipcMain.handle('mongodb:getCollectionStats', async (_event, connectionId, database, collection) => {
  return await getCollectionStats(connectionId, database, collection)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error)
})

