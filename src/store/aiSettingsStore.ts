import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AIProvider = 'deepseek' | 'openai' | 'anthropic' | 'groq' | 'mistral' | 'xai' | 'openrouter' | 'ollama' | 'gemini' | 'custom'

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
  addModel: (model: Omit<AIModel, 'id'>) => void
  updateModel: (id: string, model: Partial<AIModel>) => void
  deleteModel: (id: string) => void
  selectModel: (id: string) => void
  getSelectedModel: () => AIModel | null
  setAutoApply: <K extends keyof AIAutoApplySettings>(key: K, value: AIAutoApplySettings[K]) => void
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set, get) => ({
      models: [],
      selectedModelId: null,
      autoApply: DEFAULT_AUTO_APPLY,

      addModel: (model) => {
        const newModel: AIModel = {
          ...model,
          id: Date.now().toString(),
        }
        set((state) => ({
          models: [...state.models, newModel],
          // Auto-select if it's the first model
          selectedModelId: state.models.length === 0 ? newModel.id : state.selectedModelId,
        }))
      },

      updateModel: (id, updates) => {
        set((state) => ({
          models: state.models.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        }))
      },

      deleteModel: (id) => {
        set((state) => ({
          models: state.models.filter((m) => m.id !== id),
          selectedModelId: state.selectedModelId === id ? null : state.selectedModelId,
        }))
      },

      selectModel: (id) => {
        set({ selectedModelId: id })
      },

      getSelectedModel: () => {
        const state = get()
        return state.models.find((m) => m.id === state.selectedModelId) || null
      },

      setAutoApply: (key, value) => {
        set((state) => ({
          autoApply: { ...state.autoApply, [key]: value },
        }))
      },
    }),
    {
      name: 'ai-settings-storage',
    }
  )
)

