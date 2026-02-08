import { Database, Trash2, Edit, Power, PowerOff } from 'lucide-react'
import { Button } from '@/components/common/Button'
import type { MongoDBConnection } from '@/types'

interface ConnectionListProps {
  connections: MongoDBConnection[]
  onConnect: (connection: MongoDBConnection) => void
  onDisconnect: (connectionId: string) => void
  onEdit: (connection: MongoDBConnection) => void
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
    <div className="space-y-2">
      {connections.map((connection) => {
        const isActive = connection.id === activeConnectionId

        return (
          <div
            key={connection.id}
            className={`rounded-lg border p-4 transition-colors ${
              isActive ? 'border-primary bg-primary/5' : 'bg-card hover:bg-accent'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-1 rounded-lg p-2 ${
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{connection.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {connection.host}:{connection.port}
                  </p>
                  {connection.username && (
                    <p className="text-xs text-muted-foreground">User: {connection.username}</p>
                  )}
                  {connection.createdAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Created: {new Date(connection.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {isActive ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDisconnect(connection.id)}
                  >
                    <PowerOff className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                ) : (
                  <Button variant="default" size="sm" onClick={() => onConnect(connection)}>
                    <Power className="mr-2 h-4 w-4" />
                    Connect
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => onEdit(connection)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(connection.id)}
                  disabled={isActive}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

