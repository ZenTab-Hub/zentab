import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'

interface JSONTreeViewProps {
  data: any
  label?: string
  depth?: number
  defaultExpanded?: boolean
}

const getTypeColor = (value: any): string => {
  if (value === null) return 'text-orange-400'
  if (value === undefined) return 'text-gray-500'
  if (typeof value === 'string') return 'text-green-400'
  if (typeof value === 'number') return 'text-blue-400'
  if (typeof value === 'boolean') return 'text-purple-400'
  return 'text-foreground'
}

const getTypeLabel = (value: any): string => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `Array(${value.length})`
  if (typeof value === 'object') return `Object{${Object.keys(value).length}}`
  return typeof value
}

const TreeNode = ({ label, value, depth = 0, defaultExpanded = false }: { label: string; value: any; depth?: number; defaultExpanded?: boolean }) => {
  const [expanded, setExpanded] = useState(defaultExpanded || depth < 1)
  const isExpandable = value !== null && typeof value === 'object'
  const indent = depth * 16

  if (!isExpandable) {
    return (
      <div className="flex items-center py-0.5 hover:bg-muted/30 rounded px-1" style={{ paddingLeft: indent + 20 }}>
        <span className="text-[11px] text-muted-foreground mr-1.5">{label}:</span>
        <span className={`text-[11px] font-mono ${getTypeColor(value)}`}>
          {value === null ? 'null' : typeof value === 'string' ? `"${value.length > 100 ? value.slice(0, 97) + '...' : value}"` : String(value)}
        </span>
      </div>
    )
  }

  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as [string, any]) : Object.entries(value)

  return (
    <div>
      <div
        className="flex items-center py-0.5 hover:bg-muted/30 rounded px-1 cursor-pointer select-none"
        style={{ paddingLeft: indent }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
        <span className="text-[11px] font-medium ml-0.5 mr-1.5">{label}</span>
        <span className="text-[10px] text-muted-foreground">{getTypeLabel(value)}</span>
      </div>
      {expanded && entries.map(([key, val]) => (
        <TreeNode key={key} label={key} value={val} depth={depth + 1} />
      ))}
    </div>
  )
}

export const JSONTreeView = ({ data, label, depth = 0, defaultExpanded = true }: JSONTreeViewProps) => {
  if (Array.isArray(data)) {
    return (
      <div className="font-mono text-[11px]">
        {data.map((item, index) => (
          <div key={index} className="mb-1">
            <TreeNode label={label ? `${label}[${index}]` : `[${index}]`} value={item} depth={depth} defaultExpanded={index < 5} />
            {index < data.length - 1 && <div className="border-b border-border/30 my-1" />}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="font-mono text-[11px]">
      <TreeNode label={label || 'root'} value={data} depth={depth} defaultExpanded={defaultExpanded} />
    </div>
  )
}

