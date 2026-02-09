import { useEffect, useRef, useCallback, useState } from 'react'
import { useConnectionStore } from '@/store/connectionStore'

export type HealthStatus = 'healthy' | 'checking' | 'unhealthy' | 'unknown'

export interface HealthInfo {
  status: HealthStatus
  lastCheck: number | null
  error?: string
  failCount: number
}

const PING_INTERVAL = 30_000 // 30 seconds
const MAX_FAIL_BEFORE_RECONNECT = 3

export const useConnectionHealth = () => {
  const { activeConnectionId, getActiveConnection } = useConnectionStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)
  const healthRef = useRef<HealthInfo>({ status: 'unknown', lastCheck: null, failCount: 0 })
  const [health, setHealthState] = useState<HealthInfo>(healthRef.current)

  const updateHealth = useCallback((info: Partial<HealthInfo>) => {
    healthRef.current = { ...healthRef.current, ...info }
    setHealthState({ ...healthRef.current })
  }, [])

  const doPing = useCallback(async () => {
    if (!activeConnectionId) return
    const conn = getActiveConnection()
    if (!conn) return

    const dbType = conn.type || 'mongodb'
    updateHealth({ status: 'checking' })

    try {
      const result = await window.electronAPI.ping(activeConnectionId, dbType)
      if (!mountedRef.current) return

      if (result.success) {
        updateHealth({ status: 'healthy', lastCheck: Date.now(), error: undefined, failCount: 0 })
      } else {
        const failCount = healthRef.current.failCount + 1
        updateHealth({ status: 'unhealthy', lastCheck: Date.now(), error: result.error, failCount })

        // Auto-reconnect after MAX_FAIL_BEFORE_RECONNECT consecutive failures
        if (failCount >= MAX_FAIL_BEFORE_RECONNECT) {
          console.log(`[HealthCheck] ${failCount} consecutive failures, attempting reconnect...`)
          try {
            const api = (window.electronAPI as any)[dbType]
            if (api?.connect) {
              await api.connect(activeConnectionId, conn.connectionString)
              updateHealth({ status: 'healthy', lastCheck: Date.now(), error: undefined, failCount: 0 })
              console.log('[HealthCheck] Reconnect successful')
            }
          } catch (reconnectErr: any) {
            console.error('[HealthCheck] Reconnect failed:', reconnectErr.message)
          }
        }
      }
    } catch (err: any) {
      if (!mountedRef.current) return
      updateHealth({ status: 'unhealthy', lastCheck: Date.now(), error: err.message, failCount: healthRef.current.failCount + 1 })
    }
  }, [activeConnectionId, getActiveConnection, updateHealth])

  useEffect(() => {
    mountedRef.current = true

    // Reset health when connection changes
    healthRef.current = { status: 'unknown', lastCheck: null, failCount: 0 }
    setHealthState(healthRef.current)

    if (intervalRef.current) clearInterval(intervalRef.current)

    if (activeConnectionId) {
      // Initial ping with small delay to let connection settle
      const timeout = setTimeout(doPing, 500)
      // Periodic ping
      intervalRef.current = setInterval(doPing, PING_INTERVAL)
      return () => {
        mountedRef.current = false
        clearTimeout(timeout)
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }

    return () => {
      mountedRef.current = false
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [activeConnectionId, doPing])

  return { health, doPing }
}

