import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { ConnectionsPage } from '@/features/connections/pages/ConnectionsPage'
import { QueryEditorPage } from '@/features/query-editor/pages/QueryEditorPage'
import { DataViewerPage } from '@/features/data-viewer/pages/DataViewerPage'
import { AggregationPage } from '@/features/aggregation/pages/AggregationPage'
import { SchemaAnalyzerPage } from '@/features/schema-analyzer/pages/SchemaAnalyzerPage'
import { ImportExportPage } from '@/features/import-export/pages/ImportExportPage'
import { useSettingsStore, resolveTheme, uiFontSizePx } from '@/store/settingsStore'

function App() {
  const theme = useSettingsStore((s) => s.theme)
  const uiFontSize = useSettingsStore((s) => s.uiFontSize)

  // Sync theme class on <html> element
  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(theme)
      document.documentElement.classList.toggle('light', resolved === 'light')
    }
    apply()
    // Listen for system theme changes when mode is 'system'
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [theme])

  // Sync UI font size
  useEffect(() => {
    document.body.style.fontSize = uiFontSizePx(uiFontSize)
  }, [uiFontSize])

  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<ConnectionsPage />} />
          <Route path="/query-editor" element={<QueryEditorPage />} />
          <Route path="/data-viewer" element={<DataViewerPage />} />
          <Route path="/aggregation" element={<AggregationPage />} />
          <Route path="/schema-analyzer" element={<SchemaAnalyzerPage />} />
          <Route path="/import-export" element={<ImportExportPage />} />
        </Routes>
      </MainLayout>
    </Router>
  )
}

export default App

