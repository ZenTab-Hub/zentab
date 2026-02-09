import { useState } from 'react'
import { X, Plus, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { useAISettingsStore, type AIProvider } from '@/store/aiSettingsStore'
import { useToast } from '@/components/common/Toast'

interface AISettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const AISettingsModal = ({ isOpen, onClose }: AISettingsModalProps) => {
  const { models, selectedModelId, addModel, deleteModel, selectModel } = useAISettingsStore()
  const tt = useToast()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newModel, setNewModel] = useState({
    name: '',
    provider: 'deepseek' as AIProvider,
    apiKey: '',
    apiUrl: '',
    modelName: '',
  })

  if (!isOpen) return null

  const handleAddModel = () => {
    if (!newModel.name || !newModel.apiKey) {
      tt.warning('Please fill in name and API key')
      return
    }

    addModel({
      name: newModel.name,
      provider: newModel.provider,
      apiKey: newModel.apiKey,
      apiUrl: newModel.provider === 'custom' ? newModel.apiUrl : undefined,
      modelName: newModel.provider === 'custom' ? newModel.modelName : undefined,
    })

    // Reset form
    setNewModel({
      name: '',
      provider: 'deepseek',
      apiKey: '',
      apiUrl: '',
      modelName: '',
    })
    setShowAddForm(false)
  }

  const providerInfo = {
    deepseek: {
      name: 'DeepSeek',
      url: 'https://platform.deepseek.com',
      defaultModel: 'deepseek-chat',
    },
    openai: {
      name: 'OpenAI GPT',
      url: 'https://platform.openai.com/api-keys',
      defaultModel: 'gpt-4o-mini',
    },
    gemini: {
      name: 'Google Gemini',
      url: 'https://aistudio.google.com/app/apikey',
      defaultModel: 'gemini-1.5-flash',
    },
    custom: {
      name: 'Custom Provider',
      url: '',
      defaultModel: '',
    },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">AI Settings</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Existing Models */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Configured AI Models</h3>
            {models.length === 0 ? (
              <p className="text-muted-foreground text-sm">No AI models configured yet.</p>
            ) : (
              <div className="space-y-2">
                {models.map((model) => (
                  <div
                    key={model.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      selectedModelId === model.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{model.name}</h4>
                        <span className="text-xs px-2 py-1 rounded bg-muted">
                          {providerInfo[model.provider].name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        API Key: {model.apiKey.slice(0, 8)}...{model.apiKey.slice(-4)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={selectedModelId === model.id ? 'default' : 'outline'}
                        onClick={() => selectModel(model.id)}
                      >
                        {selectedModelId === model.id ? 'Selected' : 'Select'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          tt.confirm('Delete this AI model?', () => {
                            deleteModel(model.id)
                          })
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Model */}
          <div>
            {!showAddForm ? (
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add AI Model
              </Button>
            ) : (
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Add New AI Model</h3>

                <div>
                  <label className="text-sm font-medium">Model Name</label>
                  <Input
                    placeholder="e.g., My DeepSeek Model"
                    value={newModel.name}
                    onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Provider</label>
                  <select
                    value={newModel.provider}
                    onChange={(e) => setNewModel({ ...newModel, provider: e.target.value as AIProvider })}
                    className="w-full px-3 py-2 rounded-md border bg-background"
                  >
                    <option value="deepseek">DeepSeek</option>
                    <option value="openai">OpenAI GPT</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="custom">Custom Provider</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">API Key</label>
                  <Input
                    type="password"
                    placeholder="Enter API key"
                    value={newModel.apiKey}
                    onChange={(e) => setNewModel({ ...newModel, apiKey: e.target.value })}
                  />
                  {providerInfo[newModel.provider].url && (
                    <a
                      href={providerInfo[newModel.provider].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1"
                    >
                      Get API key <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {newModel.provider === 'custom' && (
                  <>
                    <div>
                      <label className="text-sm font-medium">API URL</label>
                      <Input
                        placeholder="https://api.example.com/v1/chat/completions"
                        value={newModel.apiUrl}
                        onChange={(e) => setNewModel({ ...newModel, apiUrl: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Model Name</label>
                      <Input
                        placeholder="e.g., gpt-4"
                        value={newModel.modelName}
                        onChange={(e) => setNewModel({ ...newModel, modelName: e.target.value })}
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleAddModel}>Add Model</Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

