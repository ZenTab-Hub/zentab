import { create } from 'zustand'

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
  _initialized: boolean
  loadModels: () => Promise<void>
  addModel: (model: Omit<AIModel, 'id'>) => void
  updateModel: (id: string, model: Partial<AIModel>) => void
  deleteModel: (id: string) => void
  selectModel: (id: string) => void
  getSelectedModel: () => AIModel | null
  setAutoApply: <K extends keyof AIAutoApplySettings>(key: K, value: AIAutoApplySettings[K]) => void
}

/** Helper: persist selectedModelId & autoApply in localStorage (non-sensitive) */
const PREFS_KEY = 'ai-settings-prefs'
const loadPrefs = () => {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return {}
}
const savePrefs = (selectedModelId: string | null, autoApply: AIAutoApplySettings) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ selectedModelId, autoApply }))
  } catch { /* ignore */ }
}

export const useAISettingsStore = create<AISettingsState>()(
  (set, get) => {
    const prefs = loadPrefs()
    return {
      models: [],
      selectedModelId: prefs.selectedModelId ?? null,
      autoApply: prefs.autoApply ?? DEFAULT_AUTO_APPLY,
      _initialized: false,

      loadModels: async () => {
        if (get()._initialized) return
        try {
          // 1. Migrate from old localStorage if exists
          const oldData = localStorage.getItem('ai-settings-storage')
          if (oldData) {
            await window.electronAPI.aiModels.migrateFromLocalStorage(oldData)
            localStorage.removeItem('ai-settings-storage')
            console.log('[AI Store] Migrated models from localStorage → encrypted SQLite')
          }

          // 2. Load from backend (decrypted)
          const result = await window.electronAPI.aiModels.getAll()
          if (result.success && result.models) {
            set({ models: result.models as AIModel[], _initialized: true })
          } else {
            set({ _initialized: true })
          }
        } catch (e) {
          console.warn('[AI Store] Failed to load models from backend:', e)
          set({ _initialized: true })
        }
      },

      addModel: (model) => {
        const newModel: AIModel = {
          ...model,
          id: Date.now().toString(),
        }
        set((state) => ({
          models: [...state.models, newModel],
          selectedModelId: state.models.length === 0 ? newModel.id : state.selectedModelId,
        }))
        // Persist to backend (encrypted)
        window.electronAPI.aiModels.save(newModel).catch(console.warn)
        // Persist prefs
        const s = get()
        savePrefs(s.selectedModelId, s.autoApply)
      },

      updateModel: (id, updates) => {
        set((state) => ({
          models: state.models.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        }))
        // Persist updated model to backend
        const updated = get().models.find((m) => m.id === id)
        if (updated) {
          window.electronAPI.aiModels.save(updated).catch(console.warn)
        }
      },

      deleteModel: (id) => {
        set((state) => ({
          models: state.models.filter((m) => m.id !== id),
          selectedModelId: state.selectedModelId === id ? null : state.selectedModelId,
        }))
        window.electronAPI.aiModels.delete(id).catch(console.warn)
        const s = get()
        savePrefs(s.selectedModelId, s.autoApply)
      },

      selectModel: (id) => {
        set({ selectedModelId: id })
        const s = get()
        savePrefs(s.selectedModelId, s.autoApply)
      },

      getSelectedModel: () => {
        const state = get()
        return state.models.find((m) => m.id === state.selectedModelId) || null
      },

      setAutoApply: (key, value) => {
        set((state) => ({
          autoApply: { ...state.autoApply, [key]: value },
        }))
        const s = get()
        savePrefs(s.selectedModelId, s.autoApply)
      },
    }
  }
)

// Auto-load models when store is created (in Electron environment)
if (typeof window !== 'undefined' && window.electronAPI) {
  useAISettingsStore.getState().loadModels()
}
