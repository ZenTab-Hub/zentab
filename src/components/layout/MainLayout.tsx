import { ReactNode, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { StatusBar } from './StatusBar'
import { AIAssistant } from '@/components/ai/AIAssistant'
import { KeyboardShortcutsDialog } from '@/components/common/KeyboardShortcutsDialog'
import { useConnectionStore } from '@/store/connectionStore'

// All navigation routes in order (must match Sidebar navigation)
const allRoutes = [
  { href: '/' },
  { href: '/query-editor' },
  { href: '/data-viewer' },
  { href: '/aggregation', dbType: 'mongodb' },
  { href: '/schema-analyzer' },
  { href: '/import-export' },
  { href: '/monitoring' },
  { href: '/pg-tools', dbType: 'postgresql' },
  { href: '/redis-tools', dbType: 'redis' },
  { href: '/kafka-tools', dbType: 'kafka' },
]

interface MainLayoutProps {
  children: ReactNode
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  const [showShortcuts, setShowShortcuts] = useState(false)
  const navigate = useNavigate()
  const activeConnection = useConnectionStore((s) => s.getActiveConnection())

  // Global keyboard shortcuts
  const handleGlobalShortcuts = useCallback((e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey

    // Cmd/Ctrl + / — Show keyboard shortcuts
    if (mod && e.key === '/') {
      e.preventDefault()
      setShowShortcuts((prev) => !prev)
      return
    }

    // Cmd/Ctrl + , — Open settings
    if (mod && e.key === ',') {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('zentab:openSettings'))
      return
    }

    // Cmd/Ctrl + 1-9 — Navigate to page by index
    if (mod && e.key >= '1' && e.key <= '9') {
      const idx = parseInt(e.key) - 1
      const dbType = activeConnection?.type
      const visibleRoutes = allRoutes.filter(
        (r) => !r.dbType || r.dbType === dbType
      )
      if (idx < visibleRoutes.length) {
        e.preventDefault()
        navigate(visibleRoutes[idx].href)
      }
      return
    }
  }, [navigate, activeConnection])

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalShortcuts)
    return () => window.removeEventListener('keydown', handleGlobalShortcuts)
  }, [handleGlobalShortcuts])

  // Listen for sidebar button click to open shortcuts
  useEffect(() => {
    const openShortcuts = () => setShowShortcuts(true)
    window.addEventListener('zentab:openShortcuts', openShortcuts)
    return () => window.removeEventListener('zentab:openShortcuts', openShortcuts)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4">{children}</main>
        <StatusBar />
      </div>
      <AIAssistant />
      <KeyboardShortcutsDialog isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  )
}

