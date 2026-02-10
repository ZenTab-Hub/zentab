import { type IpcMain } from 'electron'
import { saveAIModel, getAIModels, deleteAIModel, migrateAIModelsFromLocalStorage } from '../storage'

export function setupAIHandlers(ipcMain: IpcMain) {
  ipcMain.handle('aiModels:save', async (_event, model) => {
    try {
      saveAIModel(model)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('aiModels:getAll', async () => {
    try {
      const models = getAIModels()
      return { success: true, models }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('aiModels:delete', async (_event, id: string) => {
    try {
      deleteAIModel(id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('aiModels:migrateFromLocalStorage', async (_event, json: string) => {
    try {
      const count = migrateAIModelsFromLocalStorage(json)
      return { success: true, migrated: count }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}

