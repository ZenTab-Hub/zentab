import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { ConnectionsPage } from '@/features/connections/pages/ConnectionsPage'
import { QueryEditorPage } from '@/features/query-editor/pages/QueryEditorPage'
import { DataViewerPage } from '@/features/data-viewer/pages/DataViewerPage'
import { AggregationPage } from '@/features/aggregation/pages/AggregationPage'
import { SchemaAnalyzerPage } from '@/features/schema-analyzer/pages/SchemaAnalyzerPage'
import { ImportExportPage } from '@/features/import-export/pages/ImportExportPage'

function App() {
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

