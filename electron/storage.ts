import Database from 'better-sqlite3'
import path from 'path'
import { app, safeStorage } from 'electron'
import type { DatabaseConnection, SavedQuery } from '../src/types'

let db: Database.Database | null = null

export const initStorage = () => {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'zentab.db')

  console.log('Initializing storage at:', dbPath)

  db = new Database(dbPath, {
    verbose: console.log,
    fileMustExist: false
  })

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'mongodb',
      host TEXT,
      port INTEGER,
      username TEXT,
      password TEXT,
      authDatabase TEXT,
      database TEXT,
      connectionString TEXT,
      sshTunnel TEXT,
      ssl TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS saved_queries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      query TEXT NOT NULL,
      database TEXT,
      collection TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS query_history (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      database TEXT,
      collection TEXT,
      executedAt TEXT,
      executionTime INTEGER,
      resultCount INTEGER
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      itemId TEXT NOT NULL,
      name TEXT NOT NULL,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS query_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      query TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      variables TEXT,
      isBuiltIn INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  // Migration: add type and database columns if they don't exist
  try {
    const tableInfo = db.pragma('table_info(connections)') as any[]
    const columns = tableInfo.map((col: any) => col.name)
    if (!columns.includes('type')) {
      db.exec("ALTER TABLE connections ADD COLUMN type TEXT DEFAULT 'mongodb'")
      console.log('Migration: added type column to connections')
    }
    if (!columns.includes('database')) {
      db.exec("ALTER TABLE connections ADD COLUMN database TEXT")
      console.log('Migration: added database column to connections')
    }
  } catch (e) {
    console.warn('Migration check failed:', e)
  }

  console.log('Storage initialized at:', dbPath)
  return db
}

export const getStorage = () => {
  if (!db) {
    throw new Error('Storage not initialized')
  }
  return db
}

// ── Password Encryption with safeStorage ──────────────────────
const ENCRYPTED_PREFIX = 'enc::'

const encryptString = (plaintext: string): string => {
  if (!plaintext) return plaintext
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(plaintext)
      return ENCRYPTED_PREFIX + encrypted.toString('base64')
    }
  } catch (e) {
    console.warn('safeStorage encryption failed, storing as-is:', e)
  }
  return plaintext
}

const decryptString = (stored: string): string => {
  if (!stored) return stored
  if (!stored.startsWith(ENCRYPTED_PREFIX)) return stored // plaintext (legacy)
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buf = Buffer.from(stored.slice(ENCRYPTED_PREFIX.length), 'base64')
      return safeStorage.decryptString(buf)
    }
  } catch (e) {
    console.warn('safeStorage decryption failed:', e)
  }
  return stored // fallback: return as-is
}

/** Migrate existing plaintext passwords to encrypted form */
export const migratePasswords = () => {
  if (!db) return
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('safeStorage not available — skipping password migration')
    return
  }

  const rows = db.prepare('SELECT id, password, connectionString FROM connections').all() as any[]
  const updateStmt = db.prepare('UPDATE connections SET password = ?, connectionString = ? WHERE id = ?')

  let migrated = 0
  for (const row of rows) {
    let changed = false
    let pwd = row.password
    let cs = row.connectionString

    if (pwd && !pwd.startsWith(ENCRYPTED_PREFIX)) {
      pwd = encryptString(pwd)
      changed = true
    }
    if (cs && !cs.startsWith(ENCRYPTED_PREFIX)) {
      cs = encryptString(cs)
      changed = true
    }
    if (changed) {
      updateStmt.run(pwd, cs, row.id)
      migrated++
    }
  }
  if (migrated > 0) {
    console.log(`[Storage] Migrated ${migrated} connection(s) to encrypted passwords`)
  }
}

// Connection operations
export const saveConnection = (connection: DatabaseConnection) => {
  const db = getStorage()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO connections
    (id, name, type, host, port, username, password, authDatabase, database, connectionString, sshTunnel, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Convert Date to ISO string for SQLite
  const createdAt = connection.createdAt instanceof Date
    ? connection.createdAt.toISOString()
    : connection.createdAt
  const updatedAt = connection.updatedAt instanceof Date
    ? connection.updatedAt.toISOString()
    : connection.updatedAt

  // Encrypt sensitive fields before storing
  const encPassword = connection.password ? encryptString(connection.password) : null
  const encConnectionString = connection.connectionString ? encryptString(connection.connectionString) : null

  // Serialise SSH tunnel config as JSON string
  const sshTunnelJson = connection.sshTunnel ? JSON.stringify(connection.sshTunnel) : null

  stmt.run(
    connection.id,
    connection.name,
    connection.type || 'mongodb',
    connection.host || null,
    connection.port || null,
    connection.username || null,
    encPassword,
    connection.authDatabase || null,
    connection.database || null,
    encConnectionString,
    sshTunnelJson,
    createdAt,
    updatedAt
  )

  return connection
}

export const getConnections = (): DatabaseConnection[] => {
  const db = getStorage()
  const stmt = db.prepare('SELECT * FROM connections ORDER BY updatedAt DESC')
  const rows = stmt.all() as any[]

  // Decrypt sensitive fields and parse JSON fields after reading
  return rows.map((row) => ({
    ...row,
    password: row.password ? decryptString(row.password) : row.password,
    connectionString: row.connectionString ? decryptString(row.connectionString) : row.connectionString,
    sshTunnel: row.sshTunnel ? JSON.parse(row.sshTunnel) : undefined,
  }))
}

export const deleteConnection = (id: string) => {
  const db = getStorage()
  const stmt = db.prepare('DELETE FROM connections WHERE id = ?')
  stmt.run(id)
}

// Query operations
export const saveQuery = (query: SavedQuery) => {
  const db = getStorage()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO saved_queries
    (id, name, query, database, collection, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  // Convert Date to ISO string for SQLite
  const createdAt = query.createdAt instanceof Date
    ? query.createdAt.toISOString()
    : query.createdAt
  const updatedAt = query.updatedAt instanceof Date
    ? query.updatedAt.toISOString()
    : query.updatedAt

  stmt.run(
    query.id,
    query.name,
    JSON.stringify(query.query),
    query.database || null,
    query.collection || null,
    createdAt,
    updatedAt
  )

  return query
}

export const getSavedQueries = (): SavedQuery[] => {
  const db = getStorage()
  const stmt = db.prepare('SELECT * FROM saved_queries ORDER BY updatedAt DESC')
  return stmt.all() as SavedQuery[]
}

export const deleteSavedQuery = (id: string) => {
  const db = getStorage()
  const stmt = db.prepare('DELETE FROM saved_queries WHERE id = ?')
  stmt.run(id)
}

// Query history
export const addQueryHistory = (history: any) => {
  const db = getStorage()
  const stmt = db.prepare(`
    INSERT INTO query_history
    (id, query, database, collection, executedAt, executionTime, resultCount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  // Convert Date to ISO string for SQLite
  const executedAt = history.executedAt instanceof Date
    ? history.executedAt.toISOString()
    : history.executedAt

  stmt.run(
    history.id,
    JSON.stringify(history.query),
    history.database || null,
    history.collection || null,
    executedAt,
    history.executionTime || null,
    history.resultCount || null
  )
}

export const getQueryHistory = (limit = 50) => {
  const db = getStorage()
  const stmt = db.prepare('SELECT * FROM query_history ORDER BY executedAt DESC LIMIT ?')
  return stmt.all(limit)
}

// App settings (key-value store for 2FA, etc.)
export const getAppSetting = (key: string): string | null => {
  const db = getStorage()
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as any
  return row ? row.value : null
}

export const setAppSetting = (key: string, value: string) => {
  const db = getStorage()
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(key, value)
}

export const deleteAppSetting = (key: string) => {
  const db = getStorage()
  db.prepare('DELETE FROM app_settings WHERE key = ?').run(key)
}

// ── Query Templates ──────────────────────────────────────────
export interface QueryTemplate {
  id: string
  name: string
  query: string
  category: string // 'mongodb' | 'postgresql' | 'redis' | 'kafka'
  description?: string
  variables?: string // JSON array e.g. '["collection","field"]'
  isBuiltIn: number // 0 or 1
  createdAt?: string
  updatedAt?: string
}

export const getQueryTemplates = (): QueryTemplate[] => {
  const db = getStorage()
  return db.prepare('SELECT * FROM query_templates ORDER BY isBuiltIn DESC, name ASC').all() as QueryTemplate[]
}

export const saveQueryTemplate = (t: QueryTemplate) => {
  const db = getStorage()
  db.prepare(`
    INSERT OR REPLACE INTO query_templates
    (id, name, query, category, description, variables, isBuiltIn, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(t.id, t.name, t.query, t.category, t.description || null, t.variables || null, t.isBuiltIn || 0, t.createdAt || new Date().toISOString(), t.updatedAt || new Date().toISOString())
  return t
}

export const deleteQueryTemplate = (id: string) => {
  const db = getStorage()
  db.prepare('DELETE FROM query_templates WHERE id = ?').run(id)
}

export const seedBuiltInTemplates = () => {
  const db = getStorage()
  const count = (db.prepare('SELECT COUNT(*) as c FROM query_templates WHERE isBuiltIn = 1').get() as any).c
  if (count > 0) return // already seeded

  const now = new Date().toISOString()
  const templates: Omit<QueryTemplate, 'createdAt' | 'updatedAt'>[] = [
    // MongoDB
    { id: 'builtin-mongo-find', name: 'Find All', query: 'db.{{collection}}.find({})', category: 'mongodb', description: 'Find all documents in a collection', variables: '["collection"]', isBuiltIn: 1 },
    { id: 'builtin-mongo-find-filter', name: 'Find with Filter', query: 'db.{{collection}}.find({ "{{field}}": "{{value}}" })', category: 'mongodb', description: 'Find documents matching a filter', variables: '["collection","field","value"]', isBuiltIn: 1 },
    { id: 'builtin-mongo-aggregate', name: 'Aggregate Pipeline', query: 'db.{{collection}}.aggregate([\n  { "$match": {} },\n  { "$group": { "_id": "${{field}}", "count": { "$sum": 1 } } },\n  { "$sort": { "count": -1 } }\n])', category: 'mongodb', description: 'Basic aggregation with match, group, sort', variables: '["collection","field"]', isBuiltIn: 1 },
    { id: 'builtin-mongo-update', name: 'Update One', query: 'db.{{collection}}.updateOne(\n  { "_id": ObjectId("{{id}}") },\n  { "$set": { "{{field}}": "{{value}}" } }\n)', category: 'mongodb', description: 'Update a single document by ID', variables: '["collection","id","field","value"]', isBuiltIn: 1 },
    { id: 'builtin-mongo-insert', name: 'Insert One', query: 'db.{{collection}}.insertOne({\n  "{{field}}": "{{value}}"\n})', category: 'mongodb', description: 'Insert a new document', variables: '["collection","field","value"]', isBuiltIn: 1 },
    { id: 'builtin-mongo-delete', name: 'Delete Many', query: 'db.{{collection}}.deleteMany({ "{{field}}": "{{value}}" })', category: 'mongodb', description: 'Delete documents matching a filter', variables: '["collection","field","value"]', isBuiltIn: 1 },
    { id: 'builtin-mongo-count', name: 'Count Documents', query: 'db.{{collection}}.countDocuments({})', category: 'mongodb', description: 'Count documents in a collection', variables: '["collection"]', isBuiltIn: 1 },
    // PostgreSQL
    { id: 'builtin-pg-select', name: 'Select All', query: 'SELECT * FROM {{table}} LIMIT 100;', category: 'postgresql', description: 'Select all rows from a table', variables: '["table"]', isBuiltIn: 1 },
    { id: 'builtin-pg-select-where', name: 'Select with WHERE', query: 'SELECT * FROM {{table}}\nWHERE {{column}} = \'{{value}}\'\nORDER BY {{column}} ASC\nLIMIT 100;', category: 'postgresql', description: 'Select rows with a condition', variables: '["table","column","value"]', isBuiltIn: 1 },
    { id: 'builtin-pg-join', name: 'Join Tables', query: 'SELECT a.*, b.*\nFROM {{table1}} a\nJOIN {{table2}} b ON a.id = b.{{fk}}\nLIMIT 100;', category: 'postgresql', description: 'Join two tables', variables: '["table1","table2","fk"]', isBuiltIn: 1 },
    { id: 'builtin-pg-insert', name: 'Insert Row', query: 'INSERT INTO {{table}} ({{columns}})\nVALUES ({{values}})\nRETURNING *;', category: 'postgresql', description: 'Insert a new row', variables: '["table","columns","values"]', isBuiltIn: 1 },
    { id: 'builtin-pg-update', name: 'Update Rows', query: 'UPDATE {{table}}\nSET {{column}} = \'{{value}}\'\nWHERE {{condition}};', category: 'postgresql', description: 'Update rows matching a condition', variables: '["table","column","value","condition"]', isBuiltIn: 1 },
    { id: 'builtin-pg-group', name: 'Group By Count', query: 'SELECT {{column}}, COUNT(*) as count\nFROM {{table}}\nGROUP BY {{column}}\nORDER BY count DESC;', category: 'postgresql', description: 'Group by a column and count', variables: '["table","column"]', isBuiltIn: 1 },
    // Redis
    { id: 'builtin-redis-get', name: 'Get Key', query: 'GET {{key}}', category: 'redis', description: 'Get value of a key', variables: '["key"]', isBuiltIn: 1 },
    { id: 'builtin-redis-set', name: 'Set Key', query: 'SET {{key}} {{value}}', category: 'redis', description: 'Set a key-value pair', variables: '["key","value"]', isBuiltIn: 1 },
    { id: 'builtin-redis-keys', name: 'List Keys', query: 'KEYS {{pattern}}', category: 'redis', description: 'Find keys matching a pattern', variables: '["pattern"]', isBuiltIn: 1 },
    { id: 'builtin-redis-info', name: 'Server Info', query: 'INFO', category: 'redis', description: 'Get Redis server information', variables: '[]', isBuiltIn: 1 },
    { id: 'builtin-redis-ttl', name: 'Check TTL', query: 'TTL {{key}}', category: 'redis', description: 'Get time-to-live of a key', variables: '["key"]', isBuiltIn: 1 },
    // Kafka
    { id: 'builtin-kafka-produce', name: 'Produce Message', query: '{\n  "key": "{{key}}",\n  "value": "{{message}}"\n}', category: 'kafka', description: 'Produce a message to a topic', variables: '["key","message"]', isBuiltIn: 1 },
    { id: 'builtin-kafka-produce-batch', name: 'Produce Batch', query: '[\n  { "key": "{{key1}}", "value": "{{msg1}}" },\n  { "key": "{{key2}}", "value": "{{msg2}}" }\n]', category: 'kafka', description: 'Produce multiple messages', variables: '["key1","msg1","key2","msg2"]', isBuiltIn: 1 },
  ]

  const stmt = db.prepare(`INSERT INTO query_templates (id, name, query, category, description, variables, isBuiltIn, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  for (const t of templates) {
    stmt.run(t.id, t.name, t.query, t.category, t.description || null, t.variables || null, t.isBuiltIn, now, now)
  }
  console.log(`[Storage] Seeded ${templates.length} built-in query templates`)
}

