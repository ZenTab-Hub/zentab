import { Database, Server, HardDrive, Layers, Radio } from 'lucide-react'
import { DatabaseType } from '@/types'

interface DatabaseIconProps {
  type: DatabaseType
  className?: string
}

export const DatabaseIcon = ({ type, className = 'h-4 w-4' }: DatabaseIconProps) => {
  switch (type) {
    case 'mongodb':
      return <Database className={`${className} text-green-600`} />
    case 'postgresql':
      return <Server className={`${className} text-blue-600`} />
    case 'mysql':
      return <Server className={`${className} text-orange-600`} />
    case 'sqlite':
      return <HardDrive className={`${className} text-gray-600`} />
    case 'redis':
      return <Layers className={`${className} text-red-600`} />
    case 'mssql':
      return <Server className={`${className} text-purple-600`} />
    case 'kafka':
      return <Radio className={`${className} text-amber-600`} />
    default:
      return <Database className={`${className} text-gray-600`} />
  }
}

export const getDatabaseTypeName = (type: DatabaseType): string => {
  switch (type) {
    case 'mongodb':
      return 'MongoDB'
    case 'postgresql':
      return 'PostgreSQL'
    case 'mysql':
      return 'MySQL'
    case 'sqlite':
      return 'SQLite'
    case 'redis':
      return 'Redis'
    case 'mssql':
      return 'SQL Server'
    case 'kafka':
      return 'Kafka'
    default:
      return 'Database'
  }
}

export const getDatabaseTypeColor = (type: DatabaseType): string => {
  switch (type) {
    case 'mongodb':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    case 'postgresql':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
    case 'mysql':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
    case 'sqlite':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
    case 'redis':
      return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    case 'mssql':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
    case 'kafka':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
  }
}

