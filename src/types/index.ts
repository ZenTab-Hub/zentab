// Connection types
export type DatabaseType = 'mongodb' | 'postgresql' | 'mysql' | 'sqlite' | 'redis' | 'mssql' | 'kafka'

export interface DatabaseConnection {
  id: string
  name: string
  type: DatabaseType
  connectionString: string
  host?: string
  port?: number
  username?: string
  password?: string
  authDatabase?: string
  database?: string
  ssl?: boolean
  sshTunnel?: SSHTunnelConfig
  kafkaSASL?: 'none' | 'plain' | 'scram-sha-256' | 'scram-sha-512'
  kafkaSSL?: boolean
  createdAt: Date
  updatedAt: Date
  isFavorite?: boolean
  color?: string
  group?: string
}

/** @deprecated Use DatabaseConnection instead */
export type MongoDBConnection = DatabaseConnection

export interface SSHTunnelConfig {
  enabled: boolean
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
}

export interface ConnectionStatus {
  connectionId: string
  isConnected: boolean
  error?: string
  databases?: DatabaseInfo[]
}

// Database types
export interface DatabaseInfo {
  name: string
  sizeOnDisk?: number
  empty?: boolean
  collections?: CollectionInfo[]
}

export interface CollectionInfo {
  name: string
  type: 'collection' | 'view'
  options?: any
  info?: {
    readOnly: boolean
    uuid?: string
  }
  idIndex?: any
  stats?: CollectionStats
}

export interface CollectionStats {
  count: number
  size: number
  avgObjSize: number
  storageSize: number
  totalIndexSize: number
  indexSizes: Record<string, number>
}

// Query types
export interface QueryFilter {
  [key: string]: any
}

export interface QueryOptions {
  projection?: Record<string, 0 | 1>
  sort?: Record<string, 1 | -1> | any
  limit?: number
  skip?: number
}

export interface QueryResult {
  success: boolean
  documents: any[]
  count: number
  totalCount?: number
  returnedCount?: number
  executionTime?: number
  hasMore?: boolean
  error?: string
}

export interface SavedQuery {
  id: string
  name: string
  description?: string
  connectionId: string
  database: string
  collection: string
  query: QueryFilter
  options?: QueryOptions
  createdAt: Date
  updatedAt: Date
  isFavorite?: boolean
  tags?: string[]
}

export interface QueryHistory {
  id: string
  connectionId: string
  database: string
  collection: string
  query: QueryFilter
  options?: QueryOptions
  executedAt: Date
  executionTime: number
  resultCount: number
}

// Aggregation types
export interface AggregationPipeline {
  id: string
  name: string
  description?: string
  connectionId: string
  database: string
  collection: string
  stages: AggregationStage[]
  createdAt: Date
  updatedAt: Date
}

export interface AggregationStage {
  id: string
  type: string
  config: any
  enabled: boolean
}

// Schema types
export interface SchemaField {
  name: string
  path: string
  types: FieldType[]
  count: number
  probability: number
  unique?: number
  hasNulls?: boolean
}

export interface FieldType {
  type: string
  count: number
  probability: number
  values?: any[]
}

export interface SchemaAnalysis {
  collectionName: string
  totalDocuments: number
  sampledDocuments: number
  fields: SchemaField[]
  analyzedAt: Date
}

// Index types
export interface IndexInfo {
  name: string
  key: Record<string, 1 | -1 | 'text' | '2d' | '2dsphere'>
  unique?: boolean
  sparse?: boolean
  partialFilterExpression?: any
  expireAfterSeconds?: number
  background?: boolean
  size?: number
  usageStats?: IndexUsageStats
}

export interface IndexUsageStats {
  ops: number
  since: Date
}

// Import/Export types
export interface ImportConfig {
  file: File
  format: 'json' | 'csv' | 'excel' | 'sql'
  database: string
  collection: string
  mode: 'insert' | 'upsert' | 'replace'
  fieldMapping?: Record<string, string>
  transformations?: FieldTransformation[]
}

export interface ExportConfig {
  database: string
  collection: string
  format: 'json' | 'csv' | 'excel' | 'sql'
  query?: QueryFilter
  fields?: string[]
  fileName?: string
}

export interface FieldTransformation {
  field: string
  type: 'rename' | 'convert' | 'default' | 'custom'
  config: any
}

