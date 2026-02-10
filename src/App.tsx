import { useEffect, useCallback } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { ConnectionsPage } from '@/features/connections/pages/ConnectionsPage'
import { QueryEditorPage } from '@/features/query-editor/pages/QueryEditorPage'
import { DataViewerPage } from '@/features/data-viewer/pages/DataViewerPage'
import { AggregationPage } from '@/features/aggregation/pages/AggregationPage'
import { SchemaAnalyzerPage } from '@/features/schema-analyzer/pages/SchemaAnalyzerPage'
import { ImportExportPage } from '@/features/import-export/pages/ImportExportPage'
import { MonitoringPage } from '@/features/monitoring/pages/MonitoringPage'
import { RedisToolsPage } from '@/features/redis-tools/pages/RedisToolsPage'
import { useSettingsStore, resolveTheme, uiFontSizePx } from '@/store/settingsStore'
import { useSecurityStore } from '@/store/securityStore'
import { useAISettingsStore } from '@/store/aiSettingsStore'
import { LockScreen } from '@/components/security/LockScreen'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ToastProvider } from '@/components/common/Toast'

function App() {
  const theme = useSettingsStore((s) => s.theme)
  const uiFontSize = useSettingsStore((s) => s.uiFontSize)
  const { twoFAEnabled, isLocked, updateActivity, checkIdle, lock, setTwoFAEnabled } = useSecurityStore()
  const { loadModels, loadSettings, initialized } = useAISettingsStore()

  // Load 2FA status from backend on mount
  useEffect(() => {
    window.electronAPI.security.get2FAStatus().then((res) => {
      if (res.success) setTwoFAEnabled(!!res.enabled)
    })
  }, [setTwoFAEnabled])

  // Load AI models and settings from secure storage on mount
  useEffect(() => {
    if (!initialized) {
      loadModels()
        .then(() => loadSettings())
        .catch(err => console.error('Failed to initialize AI settings:', err))
    }
  }, [initialized, loadModels, loadSettings])

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
          <Routes>
            <Route path="/" element={<ErrorBoundary featureName="Connections"><ConnectionsPage /></ErrorBoundary>} />
            <Route path="/query-editor" element={<ErrorBoundary featureName="Query Editor"><QueryEditorPage /></ErrorBoundary>} />
            <Route path="/data-viewer" element={<ErrorBoundary featureName="Data Viewer"><DataViewerPage /></ErrorBoundary>} />
            <Route path="/aggregation" element={<ErrorBoundary featureName="Aggregation"><AggregationPage /></ErrorBoundary>} />
            <Route path="/schema-analyzer" element={<ErrorBoundary featureName="Schema Analyzer"><SchemaAnalyzerPage /></ErrorBoundary>} />
            <Route path="/import-export" element={<ErrorBoundary featureName="Import/Export"><ImportExportPage /></ErrorBoundary>} />
            <Route path="/monitoring" element={<ErrorBoundary featureName="Monitoring"><MonitoringPage /></ErrorBoundary>} />
            <Route path="/redis-tools" element={<ErrorBoundary featureName="Redis Tools"><RedisToolsPage /></ErrorBoundary>} />
          </Routes>
        </MainLayout>
      </Router>
    </ToastProvider>
  )
}

export default App

