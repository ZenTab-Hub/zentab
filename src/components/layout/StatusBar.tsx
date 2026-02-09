import { Database, Wifi, WifiOff, Clock, HardDrive } from 'lucide-react'
import { useConnectionStore } from '@/store/connectionStore'
import { getDatabaseTypeName } from '@/components/common/DatabaseIcon'

export const StatusBar = () => {
  const { activeConnectionId, getActiveConnection, selectedDatabase, selectedCollection } = useConnectionStore()
  const activeConnection = getActiveConnection()

  const isNoSQL = !activeConnection?.type || activeConnection.type === 'mongodb' || activeConnection.type === 'redis'
  const itemLabel = isNoSQL ? 'Collection' : 'Table'

  return (
    <div className="status-bar">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Connection status */}
        {activeConnectionId && activeConnection ? (
          <div className="flex items-center gap-1.5">
            <Wifi className="h-3 w-3 text-success" />
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
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Ready</span>
        </div>
      </div>
    </div>
  )
}

