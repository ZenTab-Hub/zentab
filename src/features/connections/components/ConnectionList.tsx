import { Trash2, Edit, Power, PowerOff } from 'lucide-react'
import { DatabaseIcon, getDatabaseTypeName, getDatabaseTypeColor } from '@/components/common/DatabaseIcon'
import type { DatabaseConnection } from '@/types'

interface ConnectionListProps {
  connections: DatabaseConnection[]
  onConnect: (connection: DatabaseConnection) => void
  onDisconnect: (connectionId: string) => void
  onEdit: (connection: DatabaseConnection) => void
  onDelete: (connectionId: string) => void
  activeConnectionId?: string
}

export const ConnectionList = ({
  connections,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  activeConnectionId,
}: ConnectionListProps) => {
  if (connections.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {connections.map((connection) => {
        const isActive = connection.id === activeConnectionId
        const dbType = connection.type || 'mongodb'

        return (
          <div
            key={connection.id}
            className={`group relative rounded-lg border p-4 transition-all cursor-pointer hover:shadow-md ${
              isActive
                ? 'border-primary/50 bg-primary/5 shadow-sm shadow-primary/10'
                : 'bg-card hover:bg-accent/30 hover:border-border/80'
            }`}
            onDoubleClick={() => !isActive && onConnect(connection)}
          >
            {/* Status indicator */}
            {isActive && (
              <div className="absolute top-3 right-3">
                <div className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                isActive ? 'bg-primary/15' : 'bg-muted'
              }`}>
                <DatabaseIcon type={dbType} className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold truncate">{connection.name}</h3>
                  <span className={`db-badge ${getDatabaseTypeColor(dbType)}`}>
                    {getDatabaseTypeName(dbType)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {connection.connectionString
                    ? connection.connectionString.replace(/\/\/.*:.*@/, '//***:***@')
                    : `${connection.host || 'localhost'}:${connection.port || ''}`
                  }
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50">
              {isActive ? (
                <button
                  onClick={() => onDisconnect(connection.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                >
                  <PowerOff className="h-3 w-3" />
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => onConnect(connection)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <Power className="h-3 w-3" />
                  Connect
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => onEdit(connection)}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                title="Edit"
              >
                <Edit className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => !isActive && onDelete(connection.id)}
                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-30"
                title="Delete"
                disabled={isActive}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

