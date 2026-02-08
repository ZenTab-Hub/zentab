import { Play, Save, History } from 'lucide-react'
import { Button } from '@/components/common/Button'

export const QueryEditorPage = () => {
  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Query Editor</h1>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <History className="mr-2 h-4 w-4" />
            History
          </Button>
          <Button variant="outline" size="sm">
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
          <Button size="sm">
            <Play className="mr-2 h-4 w-4" />
            Execute
          </Button>
        </div>
      </div>

      <div className="flex-1 rounded-lg border bg-card p-4">
        <div className="h-full rounded bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            Monaco Editor will be integrated here
          </p>
        </div>
      </div>

      <div className="h-64 rounded-lg border bg-card p-4">
        <h3 className="mb-2 font-semibold">Results</h3>
        <div className="h-full rounded bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">Query results will appear here</p>
        </div>
      </div>
    </div>
  )
}

