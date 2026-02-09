import { Database, WifiOff, Clock, HardDrive, Activity } from 'lucide-react'
import { useConnectionStore } from '@/store/connectionStore'
import { getDatabaseTypeName } from '@/components/common/DatabaseIcon'
import { useConnectionHealth, HealthStatus } from '@/hooks/useConnectionHealth'

const healthColors: Record<HealthStatus, string> = {
  healthy: 'text-emerald-400',
  checking: 'text-yellow-400 animate-pulse',
  unhealthy: 'text-red-400',
  unknown: 'text-muted-foreground',
}

const healthLabels: Record<HealthStatus, string> = {
  healthy: 'Connected',
  checking: 'Checking...',
  unhealthy: 'Disconnected',
  unknown: 'Unknown',
}

export const StatusBar = () => {
  const { activeConnectionId, getActiveConnection, selectedDatabase, selectedCollection } = useConnectionStore()
  const activeConnection = getActiveConnection()
  const { health, doPing } = useConnectionHealth()

  const isNoSQL = !activeConnection?.type || activeConnection.type === 'mongodb' || activeConnection.type === 'redis'
  const itemLabel = isNoSQL ? 'Collection' : 'Table'

  const healthStatus = health.status
  const healthColor = healthColors[healthStatus]
  const healthLabel = healthLabels[healthStatus]

  const lastCheckStr = health.lastCheck
    ? new Date(health.lastCheck).toLocaleTimeString()
    : null

  return (
    <div className="status-bar">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Connection status */}
        {activeConnectionId && activeConnection ? (
          <div className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${healthStatus === 'healthy' ? 'bg-emerald-400' : healthStatus === 'unhealthy' ? 'bg-red-400' : healthStatus === 'checking' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-400'}`} />
            <span>{activeConnection.name}</span>
            <span className="text-muted-foreground/50">•</span>
            <span className="text-muted-foreground">{getDatabaseTypeName(activeConnection.type || 'mongodb')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <WifiOff className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">No connection</span>
          </div>
        )}

        {/* Database / Collection info */}
        {selectedDatabase && (
          <>
            <span className="text-muted-foreground/30">|</span>
            <div className="flex items-center gap-1.5">
              <Database className="h-3 w-3 text-muted-foreground" />
              <span>{selectedDatabase}</span>
            </div>
          </>
        )}

        {selectedCollection && (
          <>
            <span className="text-muted-foreground/30">|</span>
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3 w-3 text-muted-foreground" />
              <span>{itemLabel}: {selectedCollection}</span>
            </div>
          </>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Health indicator */}
        {activeConnectionId && activeConnection && (
          <button
            onClick={() => doPing()}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            title={`Status: ${healthLabel}${health.error ? ` — ${health.error}` : ''}${lastCheckStr ? `\nLast check: ${lastCheckStr}` : ''}\nClick to check now`}
          >
            <Activity className={`h-3 w-3 ${healthColor}`} />
            <span className={healthColor}>{healthLabel}</span>
          </button>
        )}
        {!activeConnectionId && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Ready</span>
          </div>
        )}
      </div>
    </div>
  )
}

