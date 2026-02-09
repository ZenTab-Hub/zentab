import { useState, useEffect } from 'react'
import { Search, Trash2, Plus, FileCode2, Lock } from 'lucide-react'
import { storageService } from '@/services/storage.service'
import { useToast } from '@/components/common/Toast'

interface QueryTemplate {
  id: string
  name: string
  query: string
  category: string
  description?: string
  variables?: string
  isBuiltIn: number
}

interface QueryTemplatesProps {
  onSelectTemplate: (query: string, variables?: string[]) => void
  dbType: string
  currentQuery?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  mongodb: 'MongoDB',
  postgresql: 'PostgreSQL',
  redis: 'Redis',
  kafka: 'Kafka',
}

export const QueryTemplates = ({ onSelectTemplate, dbType, currentQuery }: QueryTemplatesProps) => {
  const [templates, setTemplates] = useState<QueryTemplate[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>(dbType || 'all')
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const tt = useToast()

  const loadTemplates = async () => {
    try {
      const data = await storageService.getQueryTemplates()
      setTemplates(data)
    } catch { /* ignore */ }
  }

  useEffect(() => { loadTemplates() }, [])
  useEffect(() => { setActiveCategory(dbType || 'all') }, [dbType])

  const filtered = templates.filter(t => {
    if (activeCategory !== 'all' && t.category !== activeCategory) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.description?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleUseTemplate = (t: QueryTemplate) => {
    const vars = t.variables ? JSON.parse(t.variables) as string[] : []
    onSelectTemplate(t.query, vars.length > 0 ? vars : undefined)
  }

  const handleDelete = async (id: string) => {
    try {
      await storageService.deleteQueryTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
      tt.success('Template deleted')
    } catch { tt.error('Failed to delete template') }
  }

  const handleSave = async () => {
    if (!newName.trim() || !currentQuery?.trim()) { tt.warning('Name and query are required'); return }
    // Extract {{variables}} from query
    const varMatches = currentQuery.match(/\{\{(\w+)\}\}/g) || []
    const vars = [...new Set(varMatches.map(m => m.replace(/\{\{|\}\}/g, '')))]
    const template: QueryTemplate = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      query: currentQuery,
      category: dbType || 'mongodb',
      description: newDesc.trim() || undefined,
      variables: vars.length > 0 ? JSON.stringify(vars) : undefined,
      isBuiltIn: 0,
    }
    try {
      await storageService.saveQueryTemplate(template)
      setTemplates(prev => [...prev, template])
      setShowSaveForm(false); setNewName(''); setNewDesc('')
      tt.success('Template saved!')
    } catch { tt.error('Failed to save template') }
  }

  const categories = ['all', ...Object.keys(CATEGORY_LABELS).filter(k => k !== 'all')]

  return (
    <div className="flex flex-col gap-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..."
          className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-md border bg-muted/50 outline-none focus:ring-1 focus:ring-primary" />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 flex-wrap">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors ${activeCategory === cat ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent border-border'}`}>
            {CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Save Current Query as Template */}
      <button onClick={() => setShowSaveForm(!showSaveForm)}
        className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-medium rounded-md border border-dashed hover:bg-accent transition-colors w-full justify-center">
        <Plus className="h-3 w-3" /> Save Current Query as Template
      </button>

      {showSaveForm && (
        <div className="p-2 rounded-md border bg-muted/30 space-y-1.5">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Template name"
            className="w-full px-2 py-1 text-[11px] rounded border bg-background outline-none focus:ring-1 focus:ring-primary" />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)"
            className="w-full px-2 py-1 text-[11px] rounded border bg-background outline-none focus:ring-1 focus:ring-primary" />
          <p className="text-[9px] text-muted-foreground">Tip: Use {'{{variable}}'} syntax for placeholders</p>
          <div className="flex gap-1 justify-end">
            <button onClick={() => setShowSaveForm(false)} className="px-2 py-1 text-[10px] rounded border hover:bg-accent">Cancel</button>
            <button onClick={handleSave} className="px-2 py-1 text-[10px] rounded bg-primary text-primary-foreground hover:bg-primary/90">Save</button>
          </div>
        </div>
      )}

      {/* Template List */}
      <div className="space-y-1">
        {filtered.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-4">No templates found</p>}
        {filtered.map(t => (
          <div key={t.id} onClick={() => handleUseTemplate(t)}
            className="group p-2 rounded-md border hover:bg-accent/50 cursor-pointer transition-colors">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileCode2 className="h-3 w-3 text-primary shrink-0" />
                <span className="text-[11px] font-medium truncate">{t.name}</span>
                {t.isBuiltIn === 1 && <Lock className="h-2.5 w-2.5 text-muted-foreground shrink-0" title="Built-in" />}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{CATEGORY_LABELS[t.category] || t.category}</span>
                {t.isBuiltIn === 0 && (
                  <button onClick={e => { e.stopPropagation(); handleDelete(t.id) }}
                    className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            {t.description && <p className="text-[9px] text-muted-foreground mt-0.5 ml-4.5">{t.description}</p>}
            <pre className="text-[9px] text-muted-foreground/70 mt-1 ml-4.5 truncate max-w-full">{t.query.slice(0, 80)}{t.query.length > 80 ? '...' : ''}</pre>
          </div>
        ))}
      </div>
    </div>
  )
}

