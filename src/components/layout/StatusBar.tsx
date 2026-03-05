import { Database, WifiOff, Clock, HardDrive, Activity } from 'lucide-react'
import { useConnectionStore } from '@/store/connectionStore'
import { getDatabaseTypeName } from '@/components/common/DatabaseIcon'
import { useConnectionHealth, HealthStatus } from '@/hooks/useConnectionHealth'

const healthConfig: Record<HealthStatus, { color: string; dot: string; label: string }> = {
  healthy:   { color: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Connected' },
  checking:  { color: 'text-amber-400 animate-pulse', dot: 'bg-amber-400 animate-pulse', label: 'Checking...' },
  unhealthy: { color: 'text-red-400', dot: 'bg-red-400', label: 'Disconnected' },
  unknown:   { color: 'text-muted-foreground', dot: 'bg-muted-foreground', label: 'Unknown' },
}

export const StatusBar = () => {
  const { activeConnectionId, getActiveConnection, selectedDatabase, selectedCollection } = useConnectionStore()
  const activeConnection = getActiveConnection()
  const { health, doPing } = useConnectionHealth()

  const isNoSQL = !activeConnection?.type || activeConnection.type === 'mongodb' || activeConnection.type === 'redis'
  const itemLabel = isNoSQL ? 'Collection' : 'Table'

  const config = healthConfig[health.status]
  const lastCheckStr = health.lastCheck ? new Date(health.lastCheck).toLocaleTimeString() : null

  return (
    <div className="status-bar select-none">
      {/* Left */}
      <div className="flex items-center gap-3">
        {activeConnectionId && activeConnection ? (
          <div className="flex items-center gap-1.5">
            <div className={`h-[6px] w-[6px] rounded-full ${config.dot}`} />
            <span className="font-medium">{activeConnection.name}</span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-muted-foreground">{getDatabaseTypeName(activeConnection.type || 'mongodb')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <WifiOff className="h-3 w-3" />
            <span>No connection</span>
          </div>
        )}

        {selectedDatabase && (
          <>
            <span className="text-muted-foreground/20">|</span>
            <div className="flex items-center gap-1.5">
              <Database className="h-3 w-3 text-muted-foreground/60" />
              <span>{selectedDatabase}</span>
            </div>
          </>
        )}

        {selectedCollection && (
          <>
            <span className="text-muted-foreground/20">|</span>
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3 w-3 text-muted-foreground/60" />
              <span>{itemLabel}: {selectedCollection}</span>
            </div>
          </>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {activeConnectionId && activeConnection ? (
          <button
            onClick={() => doPing()}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors rounded px-1.5 py-0.5 hover:bg-accent/50"
            title={`Status: ${config.label}${health.error ? ` — ${health.error}` : ''}${lastCheckStr ? `\nLast check: ${lastCheckStr}` : ''}\nClick to check now`}
          >
            <Activity className={`h-3 w-3 ${config.color}`} />
            <span className={config.color}>{config.label}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Ready</span>
          </div>
        )}
      </div>
    </div>
  )
}
