import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { initStorage, migrateSecrets, getAppSetting, seedBuiltInTemplates } from './storage'
import { pingMongoDB, disconnectAll as disconnectAllMongo } from './mongodb'
import { pingPostgreSQL, disconnectAll as disconnectAllPg } from './postgresql'
import { pingRedis, disconnectAll as disconnectAllRedis } from './redis'
import { pingKafka, disconnectAll as disconnectAllKafka } from './kafka'
import { closeAllSSHTunnels } from './ssh-tunnel'
import { initUpdater, setupUpdaterIPC, checkForUpdatesQuietly } from './updater'
// IPC handler modules
import { setupStorageHandlers } from './ipc/storage-handlers'
import { setupMongoDBHandlers } from './ipc/mongodb-handlers'
import { setupPostgreSQLHandlers } from './ipc/postgresql-handlers'
import { setupRedisHandlers } from './ipc/redis-handlers'
import { setupKafkaHandlers } from './ipc/kafka-handlers'
import { setupSecurityHandlers } from './ipc/security-handlers'
import { setupAIHandlers } from './ipc/ai-handlers'

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

// ── Register IPC handler modules ──
setupStorageHandlers(ipcMain)
setupMongoDBHandlers(ipcMain)
setupPostgreSQLHandlers(ipcMain)
setupRedisHandlers(ipcMain, () => mainWindow)
setupKafkaHandlers(ipcMain)
setupSecurityHandlers(ipcMain)
setupAIHandlers(ipcMain)

// App IPC Handlers
ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

ipcMain.handle('app:getPath', (_event, name: string) => {
  return app.getPath(name as any)
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error)
})

