import { useState, useCallback } from 'react'
import {
  X, Sun, Moon, Monitor, Plus, Trash2, ExternalLink,
  Palette, Bot, Code2, Settings2, Info,
} from 'lucide-react'
import { useSettingsStore, type ThemeMode, type FontSize } from '@/store/settingsStore'
import { useAISettingsStore, type AIProvider } from '@/store/aiSettingsStore'
import { useToast } from '@/components/common/Toast'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type Tab = 'appearance' | 'ai' | 'editor' | 'general' | 'about'

const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'ai', label: 'AI Models', icon: Bot },
  { id: 'editor', label: 'Editor', icon: Code2 },
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'about', label: 'About', icon: Info },
]

const INPUT_CLS = 'w-full h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const SELECT_CLS = 'h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const LABEL_CLS = 'text-xs font-medium text-foreground'
const DESC_CLS = 'text-[11px] text-muted-foreground mt-0.5'
const ROW_CLS = 'flex items-center justify-between py-3 border-b border-border/50 last:border-0'
const SECTION_CLS = 'mb-5'
const SECTION_TITLE_CLS = 'text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3'

/* ─── Appearance Tab ─── */
function AppearanceTab() {
  const { theme, uiFontSize, setTheme, setUIFontSize } = useSettingsStore()
  const themes: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'system', label: 'System', icon: Monitor },
  ]
  const fontSizes: { value: FontSize; label: string }[] = [
    { value: 'small', label: 'Small (12px)' },
    { value: 'default', label: 'Default (13px)' },
    { value: 'large', label: 'Large (14px)' },
  ]
  return (
    <div>
      <div className={SECTION_CLS}>
        <h3 className={SECTION_TITLE_CLS}>Theme</h3>
        <div className="flex gap-2">
          {themes.map((t) => {
            const Icon = t.icon
            const active = theme === t.value
            return (
              <button key={t.value} onClick={() => setTheme(t.value)}
                className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-muted-foreground/30 text-muted-foreground hover:text-foreground'}`}>
                <Icon className="h-5 w-5" />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className={SECTION_CLS}>
        <h3 className={SECTION_TITLE_CLS}>Interface</h3>
        <div className={ROW_CLS}>
          <div>
            <p className={LABEL_CLS}>UI Font Size</p>
            <p className={DESC_CLS}>Controls the base font size of the interface</p>
          </div>
          <select value={uiFontSize} onChange={(e) => setUIFontSize(e.target.value as FontSize)} className={SELECT_CLS}>
            {fontSizes.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

/* ─── Editor Tab ─── */
function EditorTab() {
  const { editor, setEditorSetting } = useSettingsStore()
  return (
    <div>
      <div className={SECTION_CLS}>
        <h3 className={SECTION_TITLE_CLS}>Font & Display</h3>
        <div className={ROW_CLS}>
          <div><p className={LABEL_CLS}>Font Size</p><p className={DESC_CLS}>Editor font size in pixels</p></div>
          <input type="number" min={10} max={24} value={editor.fontSize}
            onChange={(e) => setEditorSetting('fontSize', Number(e.target.value))}
            className={`${SELECT_CLS} w-20 text-center`} />
        </div>
        <div className={ROW_CLS}>
          <div><p className={LABEL_CLS}>Tab Size</p><p className={DESC_CLS}>Number of spaces per tab</p></div>
          <select value={editor.tabSize} onChange={(e) => setEditorSetting('tabSize', Number(e.target.value))} className={SELECT_CLS}>
            <option value={2}>2 spaces</option><option value={4}>4 spaces</option>
          </select>
        </div>
      </div>
      <div className={SECTION_CLS}>
        <h3 className={SECTION_TITLE_CLS}>Features</h3>
        {([
          ['wordWrap', 'Word Wrap', 'Wrap long lines in the editor'],
          ['minimap', 'Minimap', 'Show code minimap on the right side'],
          ['lineNumbers', 'Line Numbers', 'Show line numbers in the gutter'],
          ['bracketPairColorization', 'Bracket Colorization', 'Colorize matching bracket pairs'],
        ] as const).map(([key, label, desc]) => (
          <div key={key} className={ROW_CLS}>
            <div><p className={LABEL_CLS}>{label}</p><p className={DESC_CLS}>{desc}</p></div>
            <button onClick={() => setEditorSetting(key, !editor[key])}
              className={`relative w-9 h-5 rounded-full transition-colors ${editor[key] ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
              <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${editor[key] ? 'translate-x-4' : ''}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── General Tab ─── */
function GeneralTab() {
  const { general, setGeneralSetting } = useSettingsStore()
  return (
    <div>
      <div className={SECTION_CLS}>
        <h3 className={SECTION_TITLE_CLS}>Query</h3>
        <div className={ROW_CLS}>
          <div><p className={LABEL_CLS}>Default Query Limit</p><p className={DESC_CLS}>Max documents returned per query</p></div>
          <input type="number" min={1} max={10000} value={general.defaultQueryLimit}
            onChange={(e) => setGeneralSetting('defaultQueryLimit', Number(e.target.value))}
            className={`${SELECT_CLS} w-24 text-center`} />
        </div>
        <div className={ROW_CLS}>
          <div><p className={LABEL_CLS}>Date Format</p><p className={DESC_CLS}>Format for displaying dates</p></div>
          <select value={general.dateFormat} onChange={(e) => setGeneralSetting('dateFormat', e.target.value)} className={SELECT_CLS}>
            <option value="YYYY-MM-DD HH:mm:ss">YYYY-MM-DD HH:mm:ss</option>
            <option value="DD/MM/YYYY HH:mm">DD/MM/YYYY HH:mm</option>
            <option value="MM/DD/YYYY hh:mm A">MM/DD/YYYY hh:mm A</option>
            <option value="relative">Relative (e.g. 2 hours ago)</option>
          </select>
        </div>
      </div>
      <div className={SECTION_CLS}>
        <h3 className={SECTION_TITLE_CLS}>Behavior</h3>
        {([
          ['confirmBeforeDelete', 'Confirm Before Delete', 'Show confirmation dialog before deleting items'],
          ['autoExpandSidebar', 'Auto Expand Sidebar', 'Automatically expand sidebar on hover'],
          ['showWelcomePage', 'Show Welcome Page', 'Show welcome page on startup'],
        ] as const).map(([key, label, desc]) => (
          <div key={key} className={ROW_CLS}>
            <div><p className={LABEL_CLS}>{label}</p><p className={DESC_CLS}>{desc}</p></div>
            <button onClick={() => setGeneralSetting(key, !general[key])}
              className={`relative w-9 h-5 rounded-full transition-colors ${general[key] ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
              <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${general[key] ? 'translate-x-4' : ''}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── AI Models Tab ─── */
function AIModelsTab() {
  const { models, selectedModelId, addModel, deleteModel, selectModel } = useAISettingsStore()
  const tt = useToast()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', provider: 'deepseek' as AIProvider, apiKey: '', apiUrl: '', modelName: '' })

  const providers: { value: AIProvider; label: string; url: string }[] = [
    { value: 'deepseek', label: 'DeepSeek', url: 'https://platform.deepseek.com' },
    { value: 'openai', label: 'OpenAI GPT', url: 'https://platform.openai.com/api-keys' },
    { value: 'gemini', label: 'Google Gemini', url: 'https://aistudio.google.com/app/apikey' },
    { value: 'custom', label: 'Custom Provider', url: '' },
  ]

  const handleAdd = useCallback(() => {
    if (!form.name || !form.apiKey) return
    addModel({ ...form, apiUrl: form.provider === 'custom' ? form.apiUrl : undefined, modelName: form.provider === 'custom' ? form.modelName : undefined })
    setForm({ name: '', provider: 'deepseek', apiKey: '', apiUrl: '', modelName: '' })
    setShowAdd(false)
  }, [form, addModel])

  return (
    <div>
      <div className={SECTION_CLS}>
        <h3 className={SECTION_TITLE_CLS}>Configured Models</h3>
        {models.length === 0 ? (
          <p className="text-xs text-muted-foreground">No AI models configured yet.</p>
        ) : (
          <div className="space-y-1.5">
            {models.map((m) => (
              <div key={m.id} className={`flex items-center justify-between p-2.5 rounded-md border text-xs ${selectedModelId === m.id ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground">{providers.find((p) => p.value === m.provider)?.label} · {m.apiKey.slice(0, 6)}...{m.apiKey.slice(-4)}</p>
                </div>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => selectModel(m.id)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${selectedModelId === m.id ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent text-foreground'}`}>
                    {selectedModelId === m.id ? 'Active' : 'Select'}
                  </button>
                  <button onClick={() => { tt.confirm('Delete this model?', () => deleteModel(m.id)) }}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add AI Model
        </button>
      ) : (
        <div className="border border-border rounded-lg p-3 space-y-2.5">
          <p className="text-xs font-semibold">New AI Model</p>
          <div><label className={LABEL_CLS}>Name</label><input className={INPUT_CLS} placeholder="My Model" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className={LABEL_CLS}>Provider</label>
            <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value as AIProvider })} className={`${SELECT_CLS} w-full`}>
              {providers.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>API Key</label>
            <input type="password" className={INPUT_CLS} placeholder="Enter API key" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
            {providers.find((p) => p.value === form.provider)?.url && (
              <a href={providers.find((p) => p.value === form.provider)!.url} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-primary hover:underline flex items-center gap-0.5 mt-1">
                Get API key <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
          {form.provider === 'custom' && (
            <>
              <div><label className={LABEL_CLS}>API URL</label><input className={INPUT_CLS} placeholder="https://api.example.com/v1/chat/completions" value={form.apiUrl} onChange={(e) => setForm({ ...form, apiUrl: e.target.value })} /></div>
              <div><label className={LABEL_CLS}>Model Name</label><input className={INPUT_CLS} placeholder="e.g., gpt-4" value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value })} /></div>
            </>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Add</button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-md text-xs font-medium border border-input hover:bg-accent transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── About Tab ─── */
function AboutTab() {
  const { resetSettings } = useSettingsStore()
  const tt = useToast()
  return (
    <div>
      <div className={SECTION_CLS}>
        <h3 className={SECTION_TITLE_CLS}>Application</h3>
        <div className="space-y-2">
          <div className={ROW_CLS}><p className={LABEL_CLS}>App Name</p><p className="text-xs text-muted-foreground">QueryAI</p></div>
          <div className={ROW_CLS}><p className={LABEL_CLS}>Version</p><p className="text-xs text-muted-foreground">1.0.0</p></div>
          <div className={ROW_CLS}><p className={LABEL_CLS}>Framework</p><p className="text-xs text-muted-foreground">Electron + React + TypeScript</p></div>
        </div>
      </div>
      <div className={SECTION_CLS}>
        <h3 className={SECTION_TITLE_CLS}>Danger Zone</h3>
        <button onClick={() => { tt.confirm('Reset all settings to defaults?', () => resetSettings()) }}
          className="px-3 py-1.5 rounded-md text-xs font-medium border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors">
          Reset All Settings
        </button>
      </div>
    </div>
  )
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('appearance')
  if (!isOpen) return null
  const TabContent = { appearance: AppearanceTab, ai: AIModelsTab, editor: EditorTab, general: GeneralTab, about: AboutTab }[activeTab]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-lg shadow-2xl w-full max-w-[680px] h-[520px] flex overflow-hidden border border-border" onClick={(e) => e.stopPropagation()}>
        {/* Sidebar */}
        <div className="w-[180px] border-r border-border bg-sidebar flex flex-col py-2">
          <h2 className="px-4 py-2 text-sm font-semibold">Settings</h2>
          {TABS.map((tab) => {
            const Icon = tab.icon; const active = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 mx-2 px-2 py-1.5 rounded text-xs font-medium transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}>
                <Icon className="h-3.5 w-3.5" />{tab.label}
              </button>
            )
          })}
        </div>
        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">{TABS.find((t) => t.id === activeTab)?.label}</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4"><TabContent /></div>
        </div>
      </div>
    </div>
  )
}

