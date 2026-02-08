import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import type { MongoDBConnection, SavedQuery } from '../src/types'

let db: Database.Database | null = null

export const initStorage = () => {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'mongodb-gui.db')

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
      host TEXT,
      port INTEGER,
      username TEXT,
      password TEXT,
      authDatabase TEXT,
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
  `)

  console.log('Storage initialized at:', dbPath)
  return db
}

export const getStorage = () => {
  if (!db) {
    throw new Error('Storage not initialized')
  }
  return db
}

// Connection operations
export const saveConnection = (connection: MongoDBConnection) => {
  const db = getStorage()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO connections
    (id, name, host, port, username, password, authDatabase, connectionString, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Convert Date to ISO string for SQLite
  const createdAt = connection.createdAt instanceof Date
    ? connection.createdAt.toISOString()
    : connection.createdAt
  const updatedAt = connection.updatedAt instanceof Date
    ? connection.updatedAt.toISOString()
    : connection.updatedAt

  stmt.run(
    connection.id,
    connection.name,
    connection.host || null,
    connection.port || null,
    connection.username || null,
    connection.password || null,
    connection.authDatabase || null,
    connection.connectionString || null,
    createdAt,
    updatedAt
  )

  return connection
}

export const getConnections = (): MongoDBConnection[] => {
  const db = getStorage()
  const stmt = db.prepare('SELECT * FROM connections ORDER BY updatedAt DESC')
  return stmt.all() as MongoDBConnection[]
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

