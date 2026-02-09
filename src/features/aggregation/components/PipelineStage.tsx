import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2, Copy, GripVertical } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { MonacoQueryEditor } from '@/features/query-editor/components/MonacoQueryEditor'

interface PipelineStageProps {
  stage: {
    id: string
    type: string
    content: string
  }
  index: number
  onUpdate: (id: string, content: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}

const STAGE_TYPES = [
  { value: '$match', label: '$match', description: 'Filter documents' },
  { value: '$group', label: '$group', description: 'Group documents' },
  { value: '$project', label: '$project', description: 'Select/reshape fields' },
  { value: '$sort', label: '$sort', description: 'Sort documents' },
  { value: '$limit', label: '$limit', description: 'Limit results' },
  { value: '$skip', label: '$skip', description: 'Skip documents' },
  { value: '$unwind', label: '$unwind', description: 'Deconstruct array' },
  { value: '$lookup', label: '$lookup', description: 'Join collections' },
  { value: '$addFields', label: '$addFields', description: 'Add new fields' },
  { value: '$count', label: '$count', description: 'Count documents' },
  { value: '$facet', label: '$facet', description: 'Multiple pipelines' },
  { value: '$bucket', label: '$bucket', description: 'Categorize documents' },
]

export const PipelineStage = ({
  stage,
  index,
  onUpdate,
  onDelete,
  onDuplicate,
}: PipelineStageProps) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [stageType, setStageType] = useState(stage.type)

  const handleTypeChange = (newType: string) => {
    setStageType(newType)
    // Update content with new stage type
    const content = stage.content.trim()
    if (content.startsWith('{') && content.endsWith('}')) {
      onUpdate(stage.id, content)
    } else {
      onUpdate(stage.id, '{}')
    }
  }

  const stageInfo = STAGE_TYPES.find((t) => t.value === stageType)

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 p-3 border-b bg-muted/50">
        <Button
          variant="ghost"
          size="sm"
          className="p-0 h-6 w-6"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
        
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
        
        <span className="font-mono text-sm font-semibold">Stage {index + 1}</span>
        
        <select
          value={stageType}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="px-2 py-1 rounded border bg-background text-sm font-mono"
        >
          {STAGE_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        {stageInfo && (
          <span className="text-xs text-muted-foreground">
            {stageInfo.description}
          </span>
        )}

        <div className="ml-auto flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDuplicate(stage.id)}
            title="Duplicate stage"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(stage.id)}
            title="Delete stage"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4">
          <div className="mb-2">
            <label className="text-sm font-medium mb-1 block">
              Stage Content (JSON)
            </label>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <MonacoQueryEditor
              value={stage.content}
              onChange={(value) => onUpdate(stage.id, value)}
              height="200px"
            />
          </div>
        </div>
      )}
    </div>
  )
}

