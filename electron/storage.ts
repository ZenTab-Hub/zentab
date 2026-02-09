import Database from 'better-sqlite3'
import path from 'path'
import { app, safeStorage } from 'electron'
import type { DatabaseConnection, SavedQuery } from '../src/types'

let db: Database.Database | null = null

export const initStorage = () => {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'queryai.db')

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
    (id, name, type, host, port, username, password, authDatabase, database, connectionString, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    createdAt,
    updatedAt
  )

  return connection
}

export const getConnections = (): DatabaseConnection[] => {
  const db = getStorage()
  const stmt = db.prepare('SELECT * FROM connections ORDER BY updatedAt DESC')
  const rows = stmt.all() as DatabaseConnection[]

  // Decrypt sensitive fields after reading
  return rows.map((row) => ({
    ...row,
    password: row.password ? decryptString(row.password) : row.password,
    connectionString: row.connectionString ? decryptString(row.connectionString) : row.connectionString,
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

