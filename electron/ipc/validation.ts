import { z } from 'zod'
import type { IpcMainInvokeEvent } from 'electron'

/**
 * Wraps an IPC handler with Zod validation.
 * Returns { success: false, error: string } if validation fails.
 */
export function validated<T extends z.ZodTuple>(
  schema: T,
  handler: (event: IpcMainInvokeEvent, ...args: z.infer<T>) => Promise<any>
) {
  return async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    const result = schema.safeParse(args)
    if (!result.success) {
      const msg = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      return { success: false, error: `Invalid input: ${msg}` }
    }
    return handler(event, ...result.data)
  }
}

// ── Common Schemas ──────────────────────────────────

export const connectionId = z.string().min(1, 'connectionId is required')
export const databaseName = z.string().min(1, 'database name is required')
export const collectionName = z.string().min(1, 'collection/table name is required')
export const indexName = z.string().min(1, 'index name is required')
export const filterObj = z.record(z.unknown()).default({})
export const optionsObj = z.record(z.unknown()).optional()
export const pipelineArr = z.array(z.record(z.unknown()))
export const documentObj = z.record(z.unknown())

// SSH Tunnel (optional)
export const sshTunnelSchema = z.object({
  enabled: z.boolean(),
  host: z.string(),
  port: z.number(),
  username: z.string(),
  password: z.string().optional(),
  privateKey: z.string().optional(),
}).optional().nullable()

// ── MongoDB Schemas ─────────────────────────────────

export const mongoSchemas = {
  connect: z.tuple([connectionId, z.string().min(1), sshTunnelSchema]),
  disconnect: z.tuple([connectionId]),
  listDatabases: z.tuple([connectionId]),
  listCollections: z.tuple([connectionId, databaseName]),
  executeQuery: z.tuple([connectionId, databaseName, collectionName, filterObj, optionsObj]),
  insertDocument: z.tuple([connectionId, databaseName, collectionName, documentObj]),
  updateDocument: z.tuple([connectionId, databaseName, collectionName, filterObj, documentObj]),
  deleteDocument: z.tuple([connectionId, databaseName, collectionName, filterObj]),
  updateMany: z.tuple([connectionId, databaseName, collectionName, filterObj, documentObj]),
  deleteMany: z.tuple([connectionId, databaseName, collectionName, filterObj]),
  countDocuments: z.tuple([connectionId, databaseName, collectionName, filterObj]),
  aggregate: z.tuple([connectionId, databaseName, collectionName, pipelineArr]),
  getCollectionStats: z.tuple([connectionId, databaseName, collectionName]),
  createDatabase: z.tuple([connectionId, databaseName]),
  dropDatabase: z.tuple([connectionId, databaseName]),
  createCollection: z.tuple([connectionId, databaseName, collectionName, optionsObj]),
  dropCollection: z.tuple([connectionId, databaseName, collectionName]),
  renameCollection: z.tuple([connectionId, databaseName, z.string().min(1), z.string().min(1)]),
  listIndexes: z.tuple([connectionId, databaseName, collectionName]),
  createIndex: z.tuple([connectionId, databaseName, collectionName, z.record(z.unknown()), optionsObj]),
  dropIndex: z.tuple([connectionId, databaseName, collectionName, indexName]),
  explainQuery: z.tuple([connectionId, databaseName, collectionName, filterObj]),
  getServerStatus: z.tuple([connectionId]),
}

// ── PostgreSQL Schemas ──────────────────────────────

export const pgSchemas = {
  connect: z.tuple([connectionId, z.string().min(1), sshTunnelSchema]),
  disconnect: z.tuple([connectionId]),
  listDatabases: z.tuple([connectionId]),
  listTables: z.tuple([connectionId, databaseName]),
  executeQuery: z.tuple([connectionId, databaseName, z.string(), z.string(), optionsObj]),
  findQuery: z.tuple([connectionId, databaseName, collectionName, filterObj, optionsObj]),
  insertRow: z.tuple([connectionId, databaseName, collectionName, documentObj]),
  updateRow: z.tuple([connectionId, databaseName, collectionName, filterObj, documentObj]),
  deleteRow: z.tuple([connectionId, databaseName, collectionName, filterObj]),
  getTableSchema: z.tuple([connectionId, databaseName, collectionName]),
}
