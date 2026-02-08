import { Upload, Download } from 'lucide-react'
import { Button } from '@/components/common/Button'

export const ImportExportPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import / Export</h1>
        <p className="text-muted-foreground">Import and export data in various formats</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Import Card */}
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-4 flex items-center">
            <Upload className="mr-2 h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">Import Data</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Import data from JSON, CSV, Excel, or SQL files
          </p>
          <Button className="w-full">
            <Upload className="mr-2 h-4 w-4" />
            Choose File to Import
          </Button>
        </div>

        {/* Export Card */}
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-4 flex items-center">
            <Download className="mr-2 h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">Export Data</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Export data to JSON, CSV, Excel, or SQL format
          </p>
          <Button className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Export Collection
          </Button>
        </div>
      </div>
    </div>
  )
}

