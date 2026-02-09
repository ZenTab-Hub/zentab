import { Upload, Download } from 'lucide-react'

export const ImportExportPage = () => {
  return (
    <div className="h-full flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Import / Export</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Import and export data in various formats</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Import Card */}
        <div className="rounded-md border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Import Data</span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Import data from JSON, CSV, Excel, or SQL files
          </p>
          <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors">
            <Upload className="h-3.5 w-3.5" />
            Choose File to Import
          </button>
        </div>

        {/* Export Card */}
        <div className="rounded-md border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Export Data</span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Export data to JSON, CSV, Excel, or SQL format
          </p>
          <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors">
            <Download className="h-3.5 w-3.5" />
            Export Data
          </button>
        </div>
      </div>
    </div>
  )
}

