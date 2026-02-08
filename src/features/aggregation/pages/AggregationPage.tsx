import { Plus, Play } from 'lucide-react'
import { Button } from '@/components/common/Button'

export const AggregationPage = () => {
  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Aggregation Pipeline Builder</h1>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Stage
          </Button>
          <Button size="sm">
            <Play className="mr-2 h-4 w-4" />
            Run Pipeline
          </Button>
        </div>
      </div>

      <div className="flex flex-1 space-x-4">
        <div className="w-1/2 rounded-lg border bg-card p-4">
          <h3 className="mb-4 font-semibold">Pipeline Stages</h3>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Add stages to build your aggregation pipeline
            </p>
          </div>
        </div>

        <div className="w-1/2 rounded-lg border bg-card p-4">
          <h3 className="mb-4 font-semibold">Preview</h3>
          <div className="rounded bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              Stage results will be previewed here
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

