import { useState, useRef } from 'react'
import { Upload, Download, FileJson, FileSpreadsheet, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { useConnectionStore } from '@/store/connectionStore'
import { databaseService } from '@/services/database.service'
import { useToast } from '@/components/common/Toast'

type Format = 'json' | 'csv'

function csvToObjects(csv: string): Record<string, any>[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+)/g) || []
    const obj: Record<string, any> = {}
    headers.forEach((h, i) => {
      const v = (vals[i] || '').trim().replace(/^"|"$/g, '')
      const n = Number(v)
      if (v === 'true') obj[h] = true
      else if (v === 'false') obj[h] = false
      else if (v === 'null' || v === '') obj[h] = null
      else if (!isNaN(n) && v !== '') obj[h] = n
      else obj[h] = v
    })
    return obj
  })
}

function objectsToCsv(data: Record<string, any>[]): string {
  if (!data.length) return ''
  const keys = [...new Set(data.flatMap(d => Object.keys(d)))]
  const escape = (v: any) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [keys.join(','), ...data.map(row => keys.map(k => escape(row[k])).join(','))].join('\n')
}

export const ImportExportPage = () => {
  const { activeConnectionId, selectedDatabase, selectedCollection, getActiveConnection } = useConnectionStore()
  const tt = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [importFormat, setImportFormat] = useState<Format>('json')
  const [exportFormat, setExportFormat] = useState<Format>('json')
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [preview, setPreview] = useState<{ data: any[]; fileName: string } | null>(null)

  const conn = getActiveConnection()
  const dbType = conn?.type || 'mongodb'
  const ready = activeConnectionId && selectedDatabase && selectedCollection

  const handleFileSelect = async () => {
    if (!ready) { tt.warning('Please select a database and collection first'); return }
    try {
      const result = await window.electronAPI.dialog.showOpenDialog({
        properties: ['openFile'],
        filters: importFormat === 'json'
          ? [{ name: 'JSON', extensions: ['json'] }]
          : [{ name: 'CSV', extensions: ['csv'] }],
      })
      if (result.canceled || !result.filePaths.length) return
      const content = await window.electronAPI.fs.readFile(result.filePaths[0])
      let parsed: any[]
      if (importFormat === 'json') {
        const raw = JSON.parse(content)
        parsed = Array.isArray(raw) ? raw : [raw]
      } else {
        parsed = csvToObjects(content)
      }
      if (!parsed.length) { tt.warning('File contains no data'); return }
      setPreview({ data: parsed, fileName: result.filePaths[0].split('/').pop() || 'file' })
    } catch (e: any) {
      tt.error('Failed to read file: ' + (e.message || e))
    }
  }

  const handleImport = async () => {
    if (!ready || !preview) return
    setImporting(true)
    setImportProgress({ current: 0, total: preview.data.length })
    let success = 0; let failed = 0
    const BATCH = 100
    try {
      for (let i = 0; i < preview.data.length; i += BATCH) {
        const batch = preview.data.slice(i, i + BATCH)
        for (const doc of batch) {
          try {
            await databaseService.insertDocument(activeConnectionId!, selectedDatabase!, selectedCollection!, doc, dbType)
            success++
          } catch { failed++ }
        }
        setImportProgress({ current: Math.min(i + BATCH, preview.data.length), total: preview.data.length })
      }
      tt.success(`Imported ${success} documents${failed ? `, ${failed} failed` : ''}`)
      setPreview(null)
    } catch (e: any) {
      tt.error('Import failed: ' + (e.message || e))
    } finally {
      setImporting(false)
      setImportProgress({ current: 0, total: 0 })
    }
  }

  const handleExport = async () => {
    if (!ready) { tt.warning('Please select a database and collection first'); return }
    setExporting(true)
    try {
      const result = await databaseService.executeQuery(
        activeConnectionId!, selectedDatabase!, selectedCollection!, {}, { limit: 50000 }, dbType
      )
      const data = Array.isArray(result) ? result : result?.documents || result?.data || [result]
      if (!data.length) { tt.warning('No data to export'); setExporting(false); return }

      const content = exportFormat === 'json' ? JSON.stringify(data, null, 2) : objectsToCsv(data)
      const ext = exportFormat === 'json' ? 'json' : 'csv'
      const saveResult = await window.electronAPI.dialog.showSaveDialog({
        defaultPath: `${selectedCollection}.${ext}`,
        filters: exportFormat === 'json'
          ? [{ name: 'JSON', extensions: ['json'] }]
          : [{ name: 'CSV', extensions: ['csv'] }],
      })
      if (saveResult.canceled || !saveResult.filePath) { setExporting(false); return }
      await window.electronAPI.fs.writeFile(saveResult.filePath, content)
      tt.success(`Exported ${data.length} documents to ${saveResult.filePath.split('/').pop()}`)
    } catch (e: any) {
      tt.error('Export failed: ' + (e.message || e))
    } finally {
      setExporting(false)
    }
  }

  const FmtBtn = ({ fmt, active, onClick }: { fmt: Format; active: boolean; onClick: () => void }) => (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md border transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent'}`}>
      {fmt === 'json' ? <FileJson className="h-3.5 w-3.5" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
      {fmt.toUpperCase()}
    </button>
  )

  return (
    <div className="h-full flex flex-col gap-4 p-1">
      <div>
        <h1 className="text-lg font-semibold">Import / Export</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {ready ? <><span className="text-primary">{selectedDatabase}</span> → <span className="text-primary">{selectedCollection}</span></> : 'Select a database and collection from the sidebar'}
        </p>
      </div>

      {!ready && (
        <div className="flex items-center gap-2 p-3 rounded-md border border-yellow-500/30 bg-yellow-500/5">
          <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
          <p className="text-xs text-yellow-500">Connect to a database and select a collection to import/export data.</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {/* Import Card */}
        <div className="rounded-md border bg-card p-4 flex flex-col">
          <div className="mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Import Data</span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Import documents from a file into the selected collection</p>
          <div className="flex gap-2 mb-3">
            <FmtBtn fmt="json" active={importFormat === 'json'} onClick={() => setImportFormat('json')} />
            <FmtBtn fmt="csv" active={importFormat === 'csv'} onClick={() => setImportFormat('csv')} />
          </div>
          <input ref={fileRef} type="file" className="hidden" accept={importFormat === 'json' ? '.json' : '.csv'} />
          <button onClick={handleFileSelect} disabled={!ready || importing}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Upload className="h-3.5 w-3.5" />
            Choose File to Import
          </button>

          {/* Preview */}
          {preview && (
            <div className="mt-3 border rounded-md overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
                <span className="text-[11px] font-medium">{preview.fileName} — {preview.data.length} documents</span>
                <button onClick={() => setPreview(null)} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
              </div>
              <div className="max-h-[200px] overflow-auto p-2">
                <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                  {JSON.stringify(preview.data.slice(0, 5), null, 2)}
                  {preview.data.length > 5 && `\n... and ${preview.data.length - 5} more`}
                </pre>
              </div>
              <div className="px-3 py-2 border-t flex items-center justify-between">
                {importing ? (
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      <span className="text-[10px]">Importing {importProgress.current}/{importProgress.total}...</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${importProgress.total ? (importProgress.current / importProgress.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                ) : (
                  <button onClick={handleImport}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Import {preview.data.length} Documents
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Export Card */}
        <div className="rounded-md border bg-card p-4 flex flex-col">
          <div className="mb-3 flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Export Data</span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Export all documents from the selected collection to a file</p>
          <div className="flex gap-2 mb-3">
            <FmtBtn fmt="json" active={exportFormat === 'json'} onClick={() => setExportFormat('json')} />
            <FmtBtn fmt="csv" active={exportFormat === 'csv'} onClick={() => setExportFormat('csv')} />
          </div>
          <button onClick={handleExport} disabled={!ready || exporting}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-md border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exporting ? 'Exporting...' : 'Export Data'}
          </button>
        </div>
      </div>
    </div>
  )
}
