import { useState, useCallback } from 'react'
import { Plus, Trash2, ExternalLink, Zap, AlertTriangle } from 'lucide-react'
import { useAISettingsStore, type AIProvider } from '@/store/aiSettingsStore'
import { useToast } from '@/components/common/Toast'
import { INPUT_CLS, SELECT_CLS, LABEL_CLS, DESC_CLS, ROW_CLS, SECTION_CLS, SECTION_TITLE_CLS } from '../settingsConstants'

export function AIModelsTab() {
  const { models, selectedModelId, addModel, deleteModel, selectModel, autoApply, setAutoApply } = useAISettingsStore()
  const tt = useToast()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', provider: 'deepseek' as AIProvider, apiKey: '', apiUrl: '', modelName: '' })

  const providers: { value: AIProvider; label: string; url: string }[] = [
    { value: 'deepseek', label: 'DeepSeek', url: 'https://platform.deepseek.com' },
    { value: 'openai', label: 'OpenAI GPT', url: 'https://platform.openai.com/api-keys' },
    { value: 'anthropic', label: 'Anthropic Claude', url: 'https://console.anthropic.com/settings/keys' },
    { value: 'gemini', label: 'Google Gemini', url: 'https://aistudio.google.com/app/apikey' },
    { value: 'groq', label: 'Groq', url: 'https://console.groq.com/keys' },
    { value: 'mistral', label: 'Mistral AI', url: 'https://console.mistral.ai/api-keys' },
    { value: 'xai', label: 'xAI Grok', url: 'https://console.x.ai' },
    { value: 'openrouter', label: 'OpenRouter', url: 'https://openrouter.ai/keys' },
    { value: 'ollama', label: 'Ollama (Local)', url: 'https://ollama.com' },
    { value: 'custom', label: 'Custom Provider', url: '' },
  ]

  const needsApiKey = form.provider !== 'ollama'
  const needsCustomFields = form.provider === 'custom' || form.provider === 'ollama'

  const handleAdd = useCallback(() => {
    if (!form.name || (needsApiKey && !form.apiKey)) return
    addModel({
      ...form,
      apiKey: form.apiKey || 'ollama',
      apiUrl: needsCustomFields ? form.apiUrl : undefined,
      modelName: needsCustomFields ? form.modelName : undefined,
    })
    setForm({ name: '', provider: 'deepseek', apiKey: '', apiUrl: '', modelName: '' })
    setShowAdd(false)
  }, [form, addModel, needsApiKey, needsCustomFields])

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
          {needsApiKey && (
            <div>
              <label className={LABEL_CLS}>API Key</label>
              <input type="password" className={INPUT_CLS} placeholder="Enter API key" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
              {providers.find((p) => p.value === form.provider)?.url && (
                <a href={providers.find((p) => p.value === form.provider)?.url} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline flex items-center gap-0.5 mt-1">
                  Get API key <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          )}
          {!needsApiKey && (
            <p className="text-[11px] text-muted-foreground">Ollama runs locally — no API key needed. Make sure Ollama is running on your machine.</p>
          )}
          {needsCustomFields && (
            <>
              <div><label className={LABEL_CLS}>API URL</label><input className={INPUT_CLS} placeholder={form.provider === 'ollama' ? 'http://localhost:11434/v1/chat/completions' : 'https://api.example.com/v1/chat/completions'} value={form.apiUrl} onChange={(e) => setForm({ ...form, apiUrl: e.target.value })} /></div>
              <div><label className={LABEL_CLS}>Model Name</label><input className={INPUT_CLS} placeholder={form.provider === 'ollama' ? 'e.g., llama3.2, mistral, codellama' : 'e.g., gpt-4'} value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value })} /></div>
            </>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Add</button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-md text-xs font-medium border border-input hover:bg-accent transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* ─── Auto Apply Query ─── */}
      <div className={`${SECTION_CLS} mt-5`}>
        <h3 className={SECTION_TITLE_CLS}>
          <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> Auto Apply Query</span>
        </h3>
        <p className="text-[11px] text-muted-foreground mb-3">
          When enabled, AI-generated queries will be automatically applied to the editor. Control which operation types are allowed.
        </p>

        {/* Master toggle */}
        <div className={ROW_CLS}>
          <div>
            <p className={LABEL_CLS}>Enable Auto Apply</p>
            <p className={DESC_CLS}>Automatically apply AI-generated queries</p>
          </div>
          <button onClick={() => setAutoApply('enabled', !autoApply.enabled)}
            className={`relative w-9 h-5 rounded-full transition-colors ${autoApply.enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
            <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${autoApply.enabled ? 'translate-x-4' : ''}`} />
          </button>
        </div>

        {/* Granular toggles */}
        {autoApply.enabled && (
          <div className="mt-1">
            {([
              ['allowRead', 'Read Operations', 'find, aggregate, count, explain', false],
              ['allowCreate', 'Create Operations', 'insert, insertMany', false],
              ['allowUpdate', 'Update Operations', 'update, updateMany, replaceOne', true],
              ['allowDelete', 'Delete Operations', 'delete, deleteMany, drop', true],
            ] as const).map(([key, label, desc, isDangerous]) => (
              <div key={key} className={ROW_CLS}>
                <div className="flex items-center gap-2">
                  {isDangerous && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                  <div>
                    <p className={LABEL_CLS}>{label}</p>
                    <p className={DESC_CLS}>{desc}</p>
                  </div>
                </div>
                <button onClick={() => setAutoApply(key, !autoApply[key])}
                  className={`relative w-9 h-5 rounded-full transition-colors ${autoApply[key] ? (isDangerous ? 'bg-amber-500' : 'bg-primary') : 'bg-muted-foreground/30'}`}>
                  <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${autoApply[key] ? 'translate-x-4' : ''}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

