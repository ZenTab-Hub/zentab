import { create } from 'zustand'

export type AIProvider = 'deepseek' | 'openai' | 'gemini' | 'custom'

export interface AIModel {
  id: string
  name: string
  provider: AIProvider
  apiKey: string
  apiUrl?: string // For custom providers
  modelName?: string // For custom providers
}

export interface AIAutoApplySettings {
  enabled: boolean       // Master toggle
  allowRead: boolean     // find, aggregate, count, etc.
  allowCreate: boolean   // insert, insertMany
  allowUpdate: boolean   // update, updateMany
  allowDelete: boolean   // delete, deleteMany, drop
}

const DEFAULT_AUTO_APPLY: AIAutoApplySettings = {
  enabled: false,
  allowRead: true,
  allowCreate: false,
  allowUpdate: false,
  allowDelete: false,
}

interface AISettingsState {
  models: AIModel[]
  selectedModelId: string | null
  autoApply: AIAutoApplySettings
  initialized: boolean
  addModel: (model: Omit<AIModel, 'id'>) => Promise<void>
  updateModel: (id: string, model: Partial<AIModel>) => Promise<void>
  deleteModel: (id: string) => Promise<void>
  selectModel: (id: string) => Promise<void>
  getSelectedModel: () => AIModel | null
  setAutoApply: <K extends keyof AIAutoApplySettings>(key: K, value: AIAutoApplySettings[K]) => Promise<void>
  loadModels: () => Promise<void>
  loadSettings: () => Promise<void>
}

export const useAISettingsStore = create<AISettingsState>((set, get) => ({
  models: [],
  selectedModelId: null,
  autoApply: DEFAULT_AUTO_APPLY,
  initialized: false,

  loadModels: async () => {
    try {
      const models = await window.electron.storage.getAIModels()
      set({ models, initialized: true })
    } catch (error) {
      console.error('Failed to load AI models:', error)
      set({ initialized: true })
    }
  },

  loadSettings: async () => {
    try {
      const selectedModelId = await window.electron.storage.getAISetting('selectedModelId')
      const autoApplyStr = await window.electron.storage.getAISetting('autoApply')
      const autoApply = autoApplyStr ? JSON.parse(autoApplyStr) : DEFAULT_AUTO_APPLY
      set({ selectedModelId, autoApply })
    } catch (error) {
      console.error('Failed to load AI settings:', error)
    }
  },

  addModel: async (model) => {
    const newModel: AIModel = {
      ...model,
      id: Date.now().toString(),
    }
    
    try {
      await window.electron.storage.saveAIModel(newModel)
      set((state) => ({
        models: [...state.models, newModel],
        // Auto-select if it's the first model
        selectedModelId: state.models.length === 0 ? newModel.id : state.selectedModelId,
      }))
      
      // Save selected model if it's the first one
      if (get().models.length === 1) {
        await window.electron.storage.setAISetting('selectedModelId', newModel.id)
      }
    } catch (error) {
      console.error('Failed to add AI model:', error)
      throw error
    }
  },

  updateModel: async (id, updates) => {
    const state = get()
    const existingModel = state.models.find(m => m.id === id)
    if (!existingModel) return

    const updatedModel = { ...existingModel, ...updates }
    
    try {
      await window.electron.storage.saveAIModel(updatedModel)
      set((state) => ({
        models: state.models.map((m) => (m.id === id ? updatedModel : m)),
      }))
    } catch (error) {
      console.error('Failed to update AI model:', error)
      throw error
    }
  },

  deleteModel: async (id) => {
    try {
      await window.electron.storage.deleteAIModel(id)
      const state = get()
      const newSelectedId = state.selectedModelId === id ? null : state.selectedModelId
      
      set((state) => ({
        models: state.models.filter((m) => m.id !== id),
        selectedModelId: newSelectedId,
      }))

      if (newSelectedId === null) {
        await window.electron.storage.setAISetting('selectedModelId', '')
      }
    } catch (error) {
      console.error('Failed to delete AI model:', error)
      throw error
    }
  },

  selectModel: async (id) => {
    try {
      await window.electron.storage.setAISetting('selectedModelId', id)
      set({ selectedModelId: id })
    } catch (error) {
      console.error('Failed to select AI model:', error)
      throw error
    }
  },

  getSelectedModel: () => {
    const state = get()
    return state.models.find((m) => m.id === state.selectedModelId) || null
  },

  setAutoApply: async (key, value) => {
    const newAutoApply = { ...get().autoApply, [key]: value }
    try {
      await window.electron.storage.setAISetting('autoApply', JSON.stringify(newAutoApply))
      set({ autoApply: newAutoApply })
    } catch (error) {
      console.error('Failed to set auto-apply settings:', error)
      throw error
    }
  },
}))

