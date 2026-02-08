import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { X } from 'lucide-react'

const connectionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  host: z.string().optional(),
  port: z.number().min(1).max(65535).default(27017),
  username: z.string().optional(),
  password: z.string().optional(),
  database: z.string().optional(),
  authDatabase: z.string().optional(),
  connectionString: z.string().optional(),
})

type ConnectionFormData = z.infer<typeof connectionSchema>

interface ConnectionFormProps {
  onSubmit: (data: ConnectionFormData) => void
  onCancel: () => void
  initialData?: Partial<ConnectionFormData>
}

export const ConnectionForm = ({ onSubmit, onCancel, initialData }: ConnectionFormProps) => {
  // Initialize state from initialData
  const [useConnectionString, setUseConnectionString] = useState(
    !!initialData?.connectionString && initialData.connectionString.trim() !== ''
  )
  const [connectionString, setConnectionString] = useState(initialData?.connectionString || '')
  const [connectionName, setConnectionName] = useState(initialData?.name || '')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConnectionFormData>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      port: 27017,
      ...initialData,
    },
  })

  const handleFormSubmit = (data: ConnectionFormData) => {
    onSubmit(data)
  }

  const handleConnectionStringSubmit = () => {
    if (!connectionName.trim()) {
      alert('Please enter a connection name')
      return
    }
    if (!connectionString.trim()) {
      alert('Please enter a connection string')
      return
    }
    // Pass connection string as-is
    onSubmit({
      name: connectionName,
      host: '',
      port: 27017,
      connectionString: connectionString,
    } as any)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-background p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            {initialData ? 'Edit Connection' : 'New Connection'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-4 flex gap-2">
          <Button
            variant={!useConnectionString ? 'default' : 'outline'}
            onClick={() => setUseConnectionString(false)}
            className="flex-1"
          >
            Connection Form
          </Button>
          <Button
            variant={useConnectionString ? 'default' : 'outline'}
            onClick={() => setUseConnectionString(true)}
            className="flex-1"
          >
            Connection String
          </Button>
        </div>

        {useConnectionString ? (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Connection Name *</label>
              <Input
                placeholder="My MongoDB Connection"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Connection String *</label>
              <Input
                placeholder="mongodb://localhost:27017 or mongodb+srv://..."
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Example: mongodb+srv://username:password@cluster.mongodb.net/database
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={handleConnectionStringSubmit}>Save & Connect</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Connection Name *</label>
              <Input {...register('name')} placeholder="My MongoDB" />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Host *</label>
                <Input {...register('host')} placeholder="localhost" />
                {errors.host && <p className="mt-1 text-xs text-red-500">{errors.host.message}</p>}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Port *</label>
                <Input
                  type="number"
                  {...register('port', { valueAsNumber: true })}
                  placeholder="27017"
                />
                {errors.port && <p className="mt-1 text-xs text-red-500">{errors.port.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Username</label>
                <Input {...register('username')} placeholder="admin" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Password</label>
                <Input type="password" {...register('password')} placeholder="••••••••" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Database</label>
                <Input {...register('database')} placeholder="mydb" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Auth Database</label>
                <Input {...register('authDatabase')} placeholder="admin" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit">Save & Connect</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

