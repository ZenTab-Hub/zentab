import { useMemo } from 'react'
import { Trash2, Edit, Power, PowerOff, Database, Server, Layers } from 'lucide-react'
import { DatabaseIcon, getDatabaseTypeName, getDatabaseTypeColor } from '@/components/common/DatabaseIcon'
import type { DatabaseConnection, DatabaseType } from '@/types'

/* ── Connection groups ─────────────────────────────────────────── */
const CONNECTION_GROUPS: { label: string; icon: typeof Database; types: Set<DatabaseType> }[] = [
  { label: 'NoSQL',          icon: Database, types: new Set(['mongodb']) },
  { label: 'SQL',            icon: Server,   types: new Set(['postgresql', 'mysql', 'sqlite', 'mssql']) },
  { label: 'Stream & Cache', icon: Layers,   types: new Set(['redis', 'kafka']) },
]

interface ConnectionListProps {
  connections: DatabaseConnection[]
  onConnect: (connection: DatabaseConnection) => void
  onDisconnect: (connectionId: string) => void
  onEdit: (connection: DatabaseConnection) => void
  onDelete: (connectionId: string) => void
  activeConnectionId?: string
}

/* ── Connection Card ───────────────────────────────────────────── */
const ConnectionCard = ({ connection, isActive, onConnect, onDisconnect, onEdit, onDelete }: {
  connection: DatabaseConnection
  isActive: boolean
  onConnect: (c: DatabaseConnection) => void
  onDisconnect: (id: string) => void
  onEdit: (c: DatabaseConnection) => void
  onDelete: (id: string) => void
}) => {
  const dbType = connection.type || 'mongodb'
  return (
    <div
      className={`group relative rounded-lg border p-3.5 transition-all cursor-pointer hover:shadow-md ${
        isActive
          ? 'border-primary/50 bg-primary/5 shadow-sm shadow-primary/10'
          : 'bg-card hover:bg-accent/30 hover:border-border/80'
      }`}
      onDoubleClick={() => !isActive && onConnect(connection)}
    >
      {isActive && (
        <div className="absolute top-3 right-3">
          <div className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
          isActive ? 'bg-primary/15' : 'bg-muted'
        }`}>
          <DatabaseIcon type={dbType} className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">{connection.name}</h3>
            <span className={`db-badge ${getDatabaseTypeColor(dbType)}`}>
              {getDatabaseTypeName(dbType)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate font-mono">
            {connection.connectionString
              ? connection.connectionString.replace(/\/\/.*:.*@/, '//***:***@')
              : `${connection.host || 'localhost'}:${connection.port || ''}`
            }
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 mt-2.5 pt-2.5 border-t border-border/40">
        {isActive ? (
          <button
            onClick={() => onDisconnect(connection.id)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            <PowerOff className="h-3 w-3" />
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => onConnect(connection)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Power className="h-3 w-3" />
            Connect
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={() => onEdit(connection)}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
          title="Edit"
        >
          <Edit className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => !isActive && onDelete(connection.id)}
          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-30"
          title="Delete"
          disabled={isActive}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

/* ── Main list ─────────────────────────────────────────────────── */
export const ConnectionList = ({
  connections,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  activeConnectionId,
}: ConnectionListProps) => {
  const grouped = useMemo(() => {
    return CONNECTION_GROUPS
      .map(group => ({
        ...group,
        items: connections.filter(c => group.types.has(c.type || 'mongodb')),
      }))
      .filter(g => g.items.length > 0)
  }, [connections])

  if (connections.length === 0) return null

  return (
    <div className="space-y-5 overflow-y-auto">
      {grouped.map(group => {
        const GroupIcon = group.icon
        return (
          <div key={group.label}>
            <div className="flex items-center gap-2 mb-2.5">
              <GroupIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</h3>
              <span className="text-[10px] text-muted-foreground/60 font-medium">{group.items.length}</span>
              <div className="flex-1 border-t border-border/30" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {group.items.map(connection => (
                <ConnectionCard
                  key={connection.id}
                  connection={connection}
                  isActive={connection.id === activeConnectionId}
                  onConnect={onConnect}
                  onDisconnect={onDisconnect}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

