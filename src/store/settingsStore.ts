import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'dark' | 'light' | 'system'
export type FontSize = 'small' | 'default' | 'large'

export interface EditorSettings {
  fontSize: number
  tabSize: number
  wordWrap: boolean
  minimap: boolean
  lineNumbers: boolean
  bracketPairColorization: boolean
}

export interface GeneralSettings {
  defaultQueryLimit: number
  confirmBeforeDelete: boolean
  autoExpandSidebar: boolean
  dateFormat: string
  showWelcomePage: boolean
}

export interface AppSettings {
  // Appearance
  theme: ThemeMode
  uiFontSize: FontSize
  // Editor
  editor: EditorSettings
  // General
  general: GeneralSettings
}

interface SettingsState extends AppSettings {
  setTheme: (theme: ThemeMode) => void
  setUIFontSize: (size: FontSize) => void
  setEditorSetting: <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => void
  setGeneralSetting: <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => void
  resetSettings: () => void
}

const DEFAULT_EDITOR: EditorSettings = {
  fontSize: 13,
  tabSize: 2,
  wordWrap: true,
  minimap: false,
  lineNumbers: true,
  bracketPairColorization: true,
}

const DEFAULT_GENERAL: GeneralSettings = {
  defaultQueryLimit: 50,
  confirmBeforeDelete: true,
  autoExpandSidebar: true,
  dateFormat: 'YYYY-MM-DD HH:mm:ss',
  showWelcomePage: true,
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  uiFontSize: 'default',
  editor: DEFAULT_EDITOR,
  general: DEFAULT_GENERAL,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setTheme: (theme) => set({ theme }),

      setUIFontSize: (uiFontSize) => set({ uiFontSize }),

      setEditorSetting: (key, value) =>
        set((state) => ({ editor: { ...state.editor, [key]: value } })),

      setGeneralSetting: (key, value) =>
        set((state) => ({ general: { ...state.general, [key]: value } })),

      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    { name: 'app-settings' }
  )
)

/** Resolve effective theme (handles 'system') */
export function resolveTheme(theme: ThemeMode): 'dark' | 'light' {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Map uiFontSize to CSS body font-size */
export function uiFontSizePx(size: FontSize): string {
  switch (size) {
    case 'small': return '12px'
    case 'default': return '13px'
    case 'large': return '14px'
  }
}

