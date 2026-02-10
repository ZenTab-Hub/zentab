import { useEffect, useCallback, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { useSettingsStore, resolveTheme, uiFontSizePx } from '@/store/settingsStore'
import { useSecurityStore } from '@/store/securityStore'
import { LockScreen } from '@/components/security/LockScreen'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ToastProvider } from '@/components/common/Toast'

// Lazy-loaded route pages (code splitting)
const ConnectionsPage = lazy(() => import('@/features/connections/pages/ConnectionsPage').then(m => ({ default: m.ConnectionsPage })))
const QueryEditorPage = lazy(() => import('@/features/query-editor/pages/QueryEditorPage').then(m => ({ default: m.QueryEditorPage })))
const DataViewerPage = lazy(() => import('@/features/data-viewer/pages/DataViewerPage').then(m => ({ default: m.DataViewerPage })))
const AggregationPage = lazy(() => import('@/features/aggregation/pages/AggregationPage').then(m => ({ default: m.AggregationPage })))
const SchemaAnalyzerPage = lazy(() => import('@/features/schema-analyzer/pages/SchemaAnalyzerPage').then(m => ({ default: m.SchemaAnalyzerPage })))
const ImportExportPage = lazy(() => import('@/features/import-export/pages/ImportExportPage').then(m => ({ default: m.ImportExportPage })))
const MonitoringPage = lazy(() => import('@/features/monitoring/pages/MonitoringPage').then(m => ({ default: m.MonitoringPage })))
const RedisToolsPage = lazy(() => import('@/features/redis-tools/pages/RedisToolsPage').then(m => ({ default: m.RedisToolsPage })))
const KafkaToolsPage = lazy(() => import('@/features/kafka-tools/pages/KafkaToolsPage').then(m => ({ default: m.KafkaToolsPage })))
const PgToolsPage = lazy(() => import('@/features/pg-tools/pages/PgToolsPage').then(m => ({ default: m.PgToolsPage })))

const PageLoader = () => (
  <div className="flex items-center justify-center h-full">
    <div className="flex flex-col items-center gap-2">
      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-muted-foreground">Loading...</p>
    </div>
  </div>
)

function App() {
  const theme = useSettingsStore((s) => s.theme)
  const uiFontSize = useSettingsStore((s) => s.uiFontSize)
  const { twoFAEnabled, isLocked, updateActivity, checkIdle, lock, setTwoFAEnabled } = useSecurityStore()

  // Load 2FA status from backend on mount
  useEffect(() => {
    window.electronAPI.security.get2FAStatus().then((res) => {
      if (res.success) setTwoFAEnabled(!!res.enabled)
    })
  }, [setTwoFAEnabled])

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

  // Track user activity for idle lock
  const handleActivity = useCallback(() => {
    if (twoFAEnabled && !isLocked) {
      updateActivity()
    }
  }, [twoFAEnabled, isLocked, updateActivity])

  useEffect(() => {
    if (!twoFAEnabled) return
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }))
    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity))
    }
  }, [twoFAEnabled, handleActivity])

  // Check idle every 10 seconds
  useEffect(() => {
    if (!twoFAEnabled) return
    const interval = setInterval(() => {
      if (checkIdle()) lock()
    }, 10_000)
    return () => clearInterval(interval)
  }, [twoFAEnabled, checkIdle, lock])

  return (
    <ToastProvider>
      {twoFAEnabled && isLocked && <LockScreen />}
      <Router>
        <MainLayout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<ErrorBoundary featureName="Connections"><ConnectionsPage /></ErrorBoundary>} />
              <Route path="/query-editor" element={<ErrorBoundary featureName="Query Editor"><QueryEditorPage /></ErrorBoundary>} />
              <Route path="/data-viewer" element={<ErrorBoundary featureName="Data Viewer"><DataViewerPage /></ErrorBoundary>} />
              <Route path="/aggregation" element={<ErrorBoundary featureName="Aggregation"><AggregationPage /></ErrorBoundary>} />
              <Route path="/schema-analyzer" element={<ErrorBoundary featureName="Schema Analyzer"><SchemaAnalyzerPage /></ErrorBoundary>} />
              <Route path="/import-export" element={<ErrorBoundary featureName="Import/Export"><ImportExportPage /></ErrorBoundary>} />
              <Route path="/monitoring" element={<ErrorBoundary featureName="Monitoring"><MonitoringPage /></ErrorBoundary>} />
              <Route path="/redis-tools" element={<ErrorBoundary featureName="Redis Tools"><RedisToolsPage /></ErrorBoundary>} />
              <Route path="/kafka-tools" element={<ErrorBoundary featureName="Kafka Tools"><KafkaToolsPage /></ErrorBoundary>} />
              <Route path="/pg-tools" element={<ErrorBoundary featureName="PG Tools"><PgToolsPage /></ErrorBoundary>} />
            </Routes>
          </Suspense>
        </MainLayout>
      </Router>
    </ToastProvider>
  )
}

export default App

