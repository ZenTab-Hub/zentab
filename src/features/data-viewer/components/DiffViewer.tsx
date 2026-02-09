import { useState, useMemo } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'

interface DiffViewerProps {
  left: any
  right: any
  onClose: () => void
}

type DiffType = 'added' | 'removed' | 'changed' | 'unchanged'

interface DiffLine {
  key: string
  path: string
  leftValue?: string
  rightValue?: string
  type: DiffType
  depth: number
}

function computeDiff(left: any, right: any): DiffLine[] {
  const results: DiffLine[] = []

  function compare(l: any, r: any, prefix: string, depth: number) {
    const lKeys = l && typeof l === 'object' ? Object.keys(l) : []
    const rKeys = r && typeof r === 'object' ? Object.keys(r) : []
    const keys = Array.from(new Set([...lKeys, ...rKeys]))

    for (const key of keys) {
      const fullPath = prefix ? `${prefix}.${key}` : key
      const lVal = l?.[key]
      const rVal = r?.[key]
      const lHas = l && key in l
      const rHas = r && key in r

      if (!lHas) {
        results.push({ key, path: fullPath, leftValue: undefined, rightValue: formatVal(rVal), type: 'added', depth })
      } else if (!rHas) {
        results.push({ key, path: fullPath, leftValue: formatVal(lVal), rightValue: undefined, type: 'removed', depth })
      } else if (typeof lVal === 'object' && lVal !== null && typeof rVal === 'object' && rVal !== null && !Array.isArray(lVal) && !Array.isArray(rVal)) {
        results.push({ key, path: fullPath, leftValue: '{...}', rightValue: '{...}', type: 'unchanged', depth })
        compare(lVal, rVal, fullPath, depth + 1)
      } else {
        const lStr = JSON.stringify(lVal)
        const rStr = JSON.stringify(rVal)
        results.push({ key, path: fullPath, leftValue: formatVal(lVal), rightValue: formatVal(rVal), type: lStr === rStr ? 'unchanged' : 'changed', depth })
      }
    }
  }

  function formatVal(v: any): string {
    if (v === null) return 'null'
    if (v === undefined) return ''
    if (typeof v === 'string') return `"${v.length > 80 ? v.slice(0, 77) + '...' : v}"`
    if (typeof v === 'object') return JSON.stringify(v).length > 80 ? JSON.stringify(v).slice(0, 77) + '...' : JSON.stringify(v)
    return String(v)
  }

  compare(left, right, '', 0)
  return results
}

const diffColors: Record<DiffType, { bg: string; border: string; icon: string }> = {
  added: { bg: 'bg-green-500/10', border: 'border-l-green-500', icon: '+' },
  removed: { bg: 'bg-red-500/10', border: 'border-l-red-500', icon: '−' },
  changed: { bg: 'bg-yellow-500/10', border: 'border-l-yellow-500', icon: '~' },
  unchanged: { bg: '', border: 'border-l-transparent', icon: ' ' },
}

export const DiffViewer = ({ left, right, onClose }: DiffViewerProps) => {
  const [showOnlyDiffs, setShowOnlyDiffs] = useState(false)
  const diffLines = useMemo(() => computeDiff(left, right), [left, right])
  const filtered = showOnlyDiffs ? diffLines.filter(d => d.type !== 'unchanged') : diffLines
  const stats = useMemo(() => ({
    added: diffLines.filter(d => d.type === 'added').length,
    removed: diffLines.filter(d => d.type === 'removed').length,
    changed: diffLines.filter(d => d.type === 'changed').length,
    unchanged: diffLines.filter(d => d.type === 'unchanged').length,
  }), [diffLines])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-background border rounded-lg w-[900px] max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">Document Diff</h3>
            <div className="flex gap-2 text-[10px]">
              <span className="text-green-400">+{stats.added} added</span>
              <span className="text-red-400">−{stats.removed} removed</span>
              <span className="text-yellow-400">~{stats.changed} changed</span>
              <span className="text-muted-foreground">{stats.unchanged} same</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowOnlyDiffs(!showOnlyDiffs)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border hover:bg-accent transition-colors">
              {showOnlyDiffs ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {showOnlyDiffs ? 'Show All' : 'Only Diffs'}
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-accent"><X className="h-4 w-4" /></button>
          </div>
        </div>
        {/* Diff Content */}
        <div className="flex-1 overflow-auto">
          {/* Column headers */}
          <div className="grid grid-cols-[32px_1fr_1fr_1fr] gap-0 sticky top-0 bg-muted/80 border-b text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            <div className="px-1 py-2 text-center"></div>
            <div className="px-3 py-2">Field</div>
            <div className="px-3 py-2 border-l">Left (Doc A)</div>
            <div className="px-3 py-2 border-l">Right (Doc B)</div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Documents are identical</div>
          ) : filtered.map((line, i) => (
            <div key={i} className={`grid grid-cols-[32px_1fr_1fr_1fr] gap-0 border-b border-border/30 ${diffColors[line.type].bg} border-l-2 ${diffColors[line.type].border}`}>
              <div className="px-1 py-1 text-center text-[10px] font-mono text-muted-foreground">{diffColors[line.type].icon}</div>
              <div className="px-3 py-1 text-[11px] font-mono truncate" style={{ paddingLeft: 12 + line.depth * 16 }} title={line.path}>{line.key}</div>
              <div className={`px-3 py-1 text-[11px] font-mono truncate border-l ${line.type === 'removed' || line.type === 'changed' ? 'font-medium' : 'text-muted-foreground'}`} title={line.leftValue}>{line.leftValue ?? '—'}</div>
              <div className={`px-3 py-1 text-[11px] font-mono truncate border-l ${line.type === 'added' || line.type === 'changed' ? 'font-medium' : 'text-muted-foreground'}`} title={line.rightValue}>{line.rightValue ?? '—'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

