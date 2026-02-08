import { Search, Download } from 'lucide-react'
import { Button } from '@/components/common/Button'

export const SchemaAnalyzerPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schema Analyzer</h1>
          <p className="text-muted-foreground">Analyze collection schema and data types</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export Schema
          </Button>
          <Button size="sm">
            <Search className="mr-2 h-4 w-4" />
            Analyze
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-8 text-center">
        <div className="mx-auto max-w-md">
          <h3 className="mb-2 text-lg font-semibold">No schema analysis yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Select a collection and click Analyze to view schema information
          </p>
        </div>
      </div>
    </div>
  )
}

