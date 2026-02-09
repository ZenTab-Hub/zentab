import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import { BrowserWindow, ipcMain } from 'electron'

let mainWin: BrowserWindow | null = null

// Update state
let updateAvailable = false
let updateDownloaded = false
let updateInfo: UpdateInfo | null = null
let downloadProgress: ProgressInfo | null = null
let updateError: string | null = null
let checking = false

function sendToRenderer(channel: string, data?: any) {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send(channel, data)
  }
}

export function initUpdater(win: BrowserWindow) {
  mainWin = win

  // Configure auto-updater
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false

  // Events
  autoUpdater.on('checking-for-update', () => {
    checking = true
    updateError = null
    sendToRenderer('updater:status', { event: 'checking' })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    checking = false
    updateAvailable = true
    updateInfo = info
    sendToRenderer('updater:status', {
      event: 'update-available',
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
    })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    checking = false
    updateAvailable = false
    updateInfo = info
    sendToRenderer('updater:status', { event: 'update-not-available', version: info.version })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    downloadProgress = progress
    sendToRenderer('updater:status', {
      event: 'download-progress',
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    updateDownloaded = true
    updateInfo = info
    sendToRenderer('updater:status', {
      event: 'update-downloaded',
      version: info.version,
    })
  })

  autoUpdater.on('error', (err: Error) => {
    checking = false
    updateError = err.message
    sendToRenderer('updater:status', { event: 'error', error: err.message })
  })
}

export function setupUpdaterIPC() {
  // Check for updates
  ipcMain.handle('updater:checkForUpdates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, updateInfo: result?.updateInfo }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Download update
  ipcMain.handle('updater:downloadUpdate', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Quit and install
  ipcMain.handle('updater:quitAndInstall', () => {
    autoUpdater.quitAndInstall(false, true)
    return { success: true }
  })

  // Get current update state
  ipcMain.handle('updater:getState', () => {
    return {
      checking,
      updateAvailable,
      updateDownloaded,
      updateInfo: updateInfo ? {
        version: updateInfo.version,
        releaseDate: updateInfo.releaseDate,
        releaseNotes: typeof updateInfo.releaseNotes === 'string' ? updateInfo.releaseNotes : '',
      } : null,
      downloadProgress: downloadProgress ? {
        percent: downloadProgress.percent,
        transferred: downloadProgress.transferred,
        total: downloadProgress.total,
      } : null,
      error: updateError,
    }
  })

  // Set auto-download preference
  ipcMain.handle('updater:setAutoDownload', (_event, enabled: boolean) => {
    autoUpdater.autoDownload = enabled
    return { success: true }
  })
}

// Called from main when auto-update is enabled
export function checkForUpdatesQuietly() {
  autoUpdater.checkForUpdates().catch(() => {
    // Silently ignore errors on auto-check
  })
}

