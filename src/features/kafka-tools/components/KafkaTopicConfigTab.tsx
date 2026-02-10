import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Save, X } from 'lucide-react'
import { databaseService } from '@/services/database.service'

export const KafkaTopicConfigTab = ({ connectionId, tt, initialTopic }: { connectionId: string; tt: any; initialTopic?: string }) => {
  const [topics, setTopics] = useState<string[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic || '')
  const [configs, setConfigs] = useState<any[]>([])
  const [editedConfigs, setEditedConfigs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadTopics = useCallback(async () => {
    try {
      const result = await databaseService.listDatabases(connectionId, 'kafka')
      if (result.success) {
        const topicList = (result.databases || []).map((t: any) => typeof t === 'string' ? t : t.name).sort()
        setTopics(topicList)
        if (topicList.length > 0 && !selectedTopic) {
          setSelectedTopic(initialTopic && topicList.includes(initialTopic) ? initialTopic : topicList[0])
        }
      }
    } catch (err: any) { tt.error(err.message) }
  }, [connectionId])

  useEffect(() => { loadTopics() }, [loadTopics])

  const loadConfig = useCallback(async () => {
    if (!selectedTopic) return
    setLoading(true)
    try {
      const result = await databaseService.kafkaGetTopicConfig(connectionId, selectedTopic)
      if (result.success) {
        setConfigs(result.configs || [])
        setEditedConfigs({})
      }
    } catch (err: any) { tt.error(err.message) }
    finally { setLoading(false) }
  }, [connectionId, selectedTopic])

  useEffect(() => { loadConfig() }, [loadConfig])

  const handleEdit = (name: string, value: string) => {
    setEditedConfigs(prev => ({ ...prev, [name]: value }))
  }

  const handleCancelEdit = (name: string) => {
    setEditedConfigs(prev => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const handleSave = async () => {
    const entries = Object.entries(editedConfigs).map(([name, value]) => ({ name, value }))
    if (entries.length === 0) return
    setSaving(true)
    try {
      await databaseService.kafkaAlterTopicConfig(connectionId, selectedTopic, entries)
      tt.success(`Updated ${entries.length} config(s) for ${selectedTopic}`)
      setEditedConfigs({})
      loadConfig()
    } catch (err: any) { tt.error(err.message) }
    finally { setSaving(false) }
  }

  const hasChanges = Object.keys(editedConfigs).length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Topic Configuration</h3>
        <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)}
          className="px-2 py-1 text-[11px] rounded-md border bg-background font-mono min-w-[200px]">
          {topics.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={loadConfig} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border hover:bg-accent disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        {hasChanges && (
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> Save {Object.keys(editedConfigs).length} change(s)
          </button>
        )}
      </div>

      {loading && configs.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground">Loading configuration...</div>
      )}

      {configs.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-[11px]">
            <thead><tr className="bg-muted/30 border-b">
              <th className="text-left px-3 py-1.5 font-medium w-[280px]">Config Key</th>
              <th className="text-left px-3 py-1.5 font-medium">Value</th>
              <th className="text-left px-3 py-1.5 font-medium w-[100px]">Source</th>
              <th className="text-center px-3 py-1.5 font-medium w-[60px]">Actions</th>
            </tr></thead>
            <tbody>
              {configs.map((c: any) => {
                const isEdited = c.configName in editedConfigs
                const isReadOnly = c.readOnly
                const displayValue = isEdited ? editedConfigs[c.configName] : (c.configValue ?? '')
                return (
                  <tr key={c.configName} className={`border-b last:border-0 hover:bg-muted/20 ${isEdited ? 'bg-amber-500/5' : ''}`}>
                    <td className="px-3 py-1.5 font-mono truncate" title={c.configName}>{c.configName}</td>
                    <td className="px-3 py-1.5">
                      {isReadOnly ? (
                        <span className="font-mono text-muted-foreground">{displayValue || '—'}</span>
                      ) : (
                        <input type="text" value={displayValue}
                          onChange={e => handleEdit(c.configName, e.target.value)}
                          className="w-full px-1.5 py-0.5 text-[11px] font-mono rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${String(c.configSource || '') === 'DYNAMIC_TOPIC_CONFIG' || c.configSource === 6 ? 'bg-blue-500/15 text-blue-500' : 'bg-muted text-muted-foreground'}`}>
                        {String(c.configSource || '').replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {isEdited && (
                        <button onClick={() => handleCancelEdit(c.configName)} className="p-0.5 rounded hover:bg-accent" title="Revert">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                      {isReadOnly && <span className="text-[9px] text-muted-foreground">read-only</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

