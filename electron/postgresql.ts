import { Pool } from 'pg'

interface PostgreSQLConnectionInfo {
  pool: Pool
  database?: string
}

const connections = new Map<string, PostgreSQLConnectionInfo>()

export const connectToPostgreSQL = async (connectionId: string, connectionString: string) => {
  try {
    // Close existing connection if any
    if (connections.has(connectionId)) {
      await disconnectFromPostgreSQL(connectionId)
    }

    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10,
    })

    // Test connection
    const client = await pool.connect()
    await client.query('SELECT NOW()')
    client.release()

    // Extract database name from connection string
    const dbMatch = connectionString.match(/\/([^/?]+)(?:\?|$)/)
    const database = dbMatch ? dbMatch[1] : 'postgres'

    connections.set(connectionId, { pool, database })

    console.log(`Connected to PostgreSQL: ${connectionId}`)
    return { success: true, connectionId }
  } catch (error: any) {
    console.error('PostgreSQL connection error:', error)
    return { success: false, error: error.message }
  }
}

export const disconnectFromPostgreSQL = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (connection) {
      await connection.pool.end()
      connections.delete(connectionId)
      console.log(`Disconnected from PostgreSQL: ${connectionId}`)
    }
    return { success: true }
  } catch (error: any) {
    console.error('PostgreSQL disconnect error:', error)
    return { success: false, error: error.message }
  }
}

export const pingPostgreSQL = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) return { success: false, error: 'Not connected' }
    const client = await connection.pool.connect()
    await client.query('SELECT 1')
    client.release()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const pgListDatabases = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const result = await connection.pool.query(
      "SELECT datname as name FROM pg_database WHERE datistemplate = false ORDER BY datname"
    )
    return { success: true, databases: result.rows }
  } catch (error: any) {
    console.error('PG list databases error:', error)
    return { success: false, error: error.message }
  }
}

export const pgListTables = async (connectionId: string, _database: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const result = await connection.pool.query(
      `SELECT table_name as name, table_type as type
       FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name`
    )
    return { success: true, collections: result.rows }
  } catch (error: any) {
    console.error('PG list tables error:', error)
    return { success: false, error: error.message }
  }
}

export const pgExecuteQuery = async (
  connectionId: string,
  _database: string,
  _table: string,
  query: string,
  options: any = {}
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    console.log('pgExecuteQuery called:', { query, options })
    const result = await connection.pool.query(query)

    return {
      success: true,
      documents: result.rows,
      totalCount: result.rowCount || result.rows.length,
      returnedCount: result.rows.length,
      fields: result.fields?.map(f => ({ name: f.name, dataTypeID: f.dataTypeID })),
    }
  } catch (error: any) {
    console.error('PG execute query error:', error)
    return { success: false, error: error.message }
  }
}



export const pgFindQuery = async (
  connectionId: string,
  _database: string,
  table: string,
  filter: any = {},
  options: any = {}
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const limit = options.limit || 100
    const skip = options.skip || 0
    const sort = options.sort || {}

    // Build WHERE clause from filter
    const { whereClause, values } = buildWhereClause(filter)

    // Build ORDER BY
    let orderBy = ''
    const sortKeys = Object.keys(sort)
    if (sortKeys.length > 0) {
      const sortParts = sortKeys.map(k => `"${k}" ${sort[k] === -1 ? 'DESC' : 'ASC'}`)
      orderBy = `ORDER BY ${sortParts.join(', ')}`
    }

    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM "${table}" ${whereClause}`
    const countResult = await connection.pool.query(countQuery, values)
    const totalCount = parseInt(countResult.rows[0]?.total || '0')

    // Fetch rows
    const dataQuery = `SELECT * FROM "${table}" ${whereClause} ${orderBy} LIMIT ${limit} OFFSET ${skip}`
    const result = await connection.pool.query(dataQuery, values)

    return {
      success: true,
      documents: result.rows,
      totalCount,
      returnedCount: result.rows.length,
    }
  } catch (error: any) {
    console.error('PG find query error:', error)
    return { success: false, error: error.message }
  }
}

export const pgInsertDocument = async (
  connectionId: string,
  _database: string,
  table: string,
  document: any
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const keys = Object.keys(document)
    const values = Object.values(document)
    const placeholders = keys.map((_, i) => `$${i + 1}`)

    const query = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`
    const result = await connection.pool.query(query, values)

    return { success: true, insertedId: result.rows[0]?.id, document: result.rows[0] }
  } catch (error: any) {
    console.error('PG insert error:', error)
    return { success: false, error: error.message }
  }
}

export const pgUpdateDocument = async (
  connectionId: string,
  _database: string,
  table: string,
  filter: any,
  update: any
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const { whereClause, values: whereValues } = buildWhereClause(filter)
    const updateKeys = Object.keys(update).filter(k => !(k in filter))
    const updateValues = updateKeys.map(k => update[k])
    const setParts = updateKeys.map((k, i) => `"${k}" = $${whereValues.length + i + 1}`)

    if (setParts.length === 0) return { success: true, modifiedCount: 0 }

    const query = `UPDATE "${table}" SET ${setParts.join(', ')} ${whereClause}`
    const result = await connection.pool.query(query, [...whereValues, ...updateValues])

    return { success: true, modifiedCount: result.rowCount }
  } catch (error: any) {
    console.error('PG update error:', error)
    return { success: false, error: error.message }
  }
}

export const pgDeleteDocument = async (
  connectionId: string,
  _database: string,
  table: string,
  filter: any
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const { whereClause, values } = buildWhereClause(filter)
    const query = `DELETE FROM "${table}" ${whereClause}`
    const result = await connection.pool.query(query, values)

    return { success: true, deletedCount: result.rowCount }
  } catch (error: any) {
    console.error('PG delete error:', error)
    return { success: false, error: error.message }
  }
}

export const pgUpdateMany = async (
  connectionId: string,
  _database: string,
  table: string,
  filter: any,
  update: any
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const { whereClause, values: whereValues } = buildWhereClause(filter)
    const updateKeys = Object.keys(update).filter(k => !(k in filter))
    const updateValues = updateKeys.map(k => update[k])
    const setParts = updateKeys.map((k, i) => `"${k}" = $${whereValues.length + i + 1}`)

    if (setParts.length === 0) return { success: true, matchedCount: 0, modifiedCount: 0 }

    const query = `UPDATE "${table}" SET ${setParts.join(', ')} ${whereClause}`
    const result = await connection.pool.query(query, [...whereValues, ...updateValues])

    return { success: true, matchedCount: result.rowCount, modifiedCount: result.rowCount }
  } catch (error: any) {
    console.error('PG update many error:', error)
    return { success: false, error: error.message }
  }
}

export const pgDeleteMany = async (
  connectionId: string,
  _database: string,
  table: string,
  filter: any
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const { whereClause, values } = buildWhereClause(filter)
    const query = `DELETE FROM "${table}" ${whereClause}`
    const result = await connection.pool.query(query, values)

    return { success: true, deletedCount: result.rowCount }
  } catch (error: any) {
    console.error('PG delete many error:', error)
    return { success: false, error: error.message }
  }
}

export const pgCountRows = async (
  connectionId: string,
  _database: string,
  table: string,
  filter: any
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const { whereClause, values } = buildWhereClause(filter)
    const query = `SELECT COUNT(*) as count FROM "${table}" ${whereClause}`
    const result = await connection.pool.query(query, values)

    return { success: true, count: parseInt(result.rows[0]?.count || '0', 10) }
  } catch (error: any) {
    console.error('PG count rows error:', error)
    return { success: false, error: error.message }
  }
}

export const pgGetTableSchema = async (
  connectionId: string,
  _database: string,
  table: string
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const result = await connection.pool.query(
      `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length,
              numeric_precision, numeric_scale
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table]
    )

    return { success: true, columns: result.rows }
  } catch (error: any) {
    console.error('PG get table schema error:', error)
    return { success: false, error: error.message }
  }
}

export const pgAggregate = async (
  connectionId: string,
  _database: string,
  _table: string,
  query: string
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const result = await connection.pool.query(query)
    return { success: true, documents: result.rows }
  } catch (error: any) {
    console.error('PG aggregate error:', error)
    return { success: false, error: error.message }
  }
}

/* ── Database Management ──────────────────────────────── */

export const pgCreateDatabase = async (connectionId: string, database: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    // Database names must be sanitized (no parameterized queries for DDL)
    const safeName = database.replace(/[^a-zA-Z0-9_]/g, '')
    await connection.pool.query(`CREATE DATABASE "${safeName}"`)
    return { success: true }
  } catch (error: any) {
    console.error('PG create database error:', error)
    return { success: false, error: error.message }
  }
}

export const pgDropDatabase = async (connectionId: string, database: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const safeName = database.replace(/[^a-zA-Z0-9_]/g, '')
    // Terminate existing connections to the database first
    await connection.pool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [safeName]
    )
    await connection.pool.query(`DROP DATABASE "${safeName}"`)
    return { success: true }
  } catch (error: any) {
    console.error('PG drop database error:', error)
    return { success: false, error: error.message }
  }
}

export const pgCreateTable = async (
  connectionId: string,
  _database: string,
  table: string,
  columns: Array<{ name: string; type: string; nullable?: boolean; defaultValue?: string; primaryKey?: boolean }>
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const colDefs = columns.map(col => {
      let def = `"${col.name}" ${col.type}`
      if (col.primaryKey) def += ' PRIMARY KEY'
      if (col.nullable === false) def += ' NOT NULL'
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`
      return def
    })

    const query = `CREATE TABLE "${table}" (${colDefs.join(', ')})`
    await connection.pool.query(query)
    return { success: true }
  } catch (error: any) {
    console.error('PG create table error:', error)
    return { success: false, error: error.message }
  }
}

export const pgDropTable = async (connectionId: string, _database: string, table: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    await connection.pool.query(`DROP TABLE IF EXISTS "${table}" CASCADE`)
    return { success: true }
  } catch (error: any) {
    console.error('PG drop table error:', error)
    return { success: false, error: error.message }
  }
}

export const pgRenameTable = async (connectionId: string, _database: string, oldName: string, newName: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    await connection.pool.query(`ALTER TABLE "${oldName}" RENAME TO "${newName}"`)
    return { success: true }
  } catch (error: any) {
    console.error('PG rename table error:', error)
    return { success: false, error: error.message }
  }
}

/* ── Index Management ─────────────────────────────────── */

export const pgListIndexes = async (connectionId: string, _database: string, table: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const result = await connection.pool.query(
      `SELECT indexname as name, indexdef as definition,
              pg_size_pretty(pg_relation_size(quote_ident(indexname))) as size
       FROM pg_indexes
       WHERE tablename = $1 AND schemaname = 'public'
       ORDER BY indexname`,
      [table]
    )
    return { success: true, indexes: result.rows }
  } catch (error: any) {
    console.error('PG list indexes error:', error)
    return { success: false, error: error.message }
  }
}

export const pgCreateIndex = async (
  connectionId: string,
  _database: string,
  table: string,
  indexName: string,
  columns: string[],
  options?: { unique?: boolean; method?: string }
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const unique = options?.unique ? 'UNIQUE ' : ''
    const method = options?.method ? `USING ${options.method} ` : ''
    const cols = columns.map(c => `"${c}"`).join(', ')

    const query = `CREATE ${unique}INDEX "${indexName}" ON "${table}" ${method}(${cols})`
    await connection.pool.query(query)
    return { success: true }
  } catch (error: any) {
    console.error('PG create index error:', error)
    return { success: false, error: error.message }
  }
}

export const pgDropIndex = async (connectionId: string, _database: string, indexName: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    await connection.pool.query(`DROP INDEX IF EXISTS "${indexName}"`)
    return { success: true }
  } catch (error: any) {
    console.error('PG drop index error:', error)
    return { success: false, error: error.message }
  }
}

/* ── Helper: build WHERE clause from filter object ──────────── */

export const pgExplainQuery = async (
  connectionId: string,
  _database: string,
  _table: string,
  query: string
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const explainQuery = `EXPLAIN (ANALYZE, FORMAT JSON) ${query}`
    const result = await connection.pool.query(explainQuery)

    return { success: true, explain: result.rows[0]['QUERY PLAN'] || result.rows }
  } catch (error: any) {
    console.error('PG explain query error:', error)
    return { success: false, error: error.message }
  }
}

export const pgGetServerStats = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const versionResult = await connection.pool.query('SELECT version()')
    const activityResult = await connection.pool.query(`SELECT state, count(*) as count FROM pg_stat_activity GROUP BY state`)
    const dbSizeResult = await connection.pool.query(`SELECT pg_database_size(current_database()) as size`)
    const bgWriterResult = await connection.pool.query(`SELECT * FROM pg_stat_bgwriter`)
    const dbStatsResult = await connection.pool.query(`SELECT * FROM pg_stat_database WHERE datname = current_database()`)

    const connections_by_state: Record<string, number> = {}
    activityResult.rows.forEach((r: any) => { connections_by_state[r.state || 'null'] = parseInt(r.count) })

    const dbStats = dbStatsResult.rows[0] || {}

    return {
      success: true,
      stats: {
        version: versionResult.rows[0]?.version,
        database_size: parseInt(dbSizeResult.rows[0]?.size || '0'),
        connections: connections_by_state,
        total_connections: Object.values(connections_by_state).reduce((a: number, b: number) => a + b, 0),
        transactions: { committed: parseInt(dbStats.xact_commit || '0'), rolledBack: parseInt(dbStats.xact_rollback || '0') },
        tuples: {
          returned: parseInt(dbStats.tup_returned || '0'),
          fetched: parseInt(dbStats.tup_fetched || '0'),
          inserted: parseInt(dbStats.tup_inserted || '0'),
          updated: parseInt(dbStats.tup_updated || '0'),
          deleted: parseInt(dbStats.tup_deleted || '0'),
        },
        blocks: { read: parseInt(dbStats.blks_read || '0'), hit: parseInt(dbStats.blks_hit || '0') },
        bgwriter: bgWriterResult.rows[0] || {},
      },
    }
  } catch (error: any) {
    console.error('PG server stats error:', error)
    return { success: false, error: error.message }
  }
}
function buildWhereClause(filter: any): { whereClause: string; values: any[] } {
  const keys = Object.keys(filter)
  if (keys.length === 0) return { whereClause: '', values: [] }

  const conditions: string[] = []
  const values: any[] = []

  keys.forEach((key, i) => {
    conditions.push(`"${key}" = $${i + 1}`)
    values.push(filter[key])
  })

  return { whereClause: `WHERE ${conditions.join(' AND ')}`, values }
}

/* ── PG Tools: Active Queries ─────────────────────────── */

export const pgGetActiveQueries = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const result = await connection.pool.query(
      `SELECT pid, usename, datname, client_addr, state, query,
              query_start, state_change,
              EXTRACT(EPOCH FROM (now() - query_start))::numeric(10,2) AS duration_sec,
              wait_event_type, wait_event, backend_type
       FROM pg_stat_activity
       WHERE pid <> pg_backend_pid()
       ORDER BY query_start DESC NULLS LAST`
    )
    return { success: true, queries: result.rows }
  } catch (error: any) {
    console.error('PG active queries error:', error)
    return { success: false, error: error.message }
  }
}

export const pgCancelQuery = async (connectionId: string, pid: number) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')
    await connection.pool.query('SELECT pg_cancel_backend($1)', [pid])
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const pgTerminateBackend = async (connectionId: string, pid: number) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')
    await connection.pool.query('SELECT pg_terminate_backend($1)', [pid])
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/* ── PG Tools: Table Details (constraints, FK, triggers) ── */

export const pgGetTableDetails = async (connectionId: string, _database: string, table: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    // Constraints
    const constraintsResult = await connection.pool.query(
      `SELECT con.conname AS name, con.contype AS type,
              pg_get_constraintdef(con.oid) AS definition
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
       WHERE rel.relname = $1 AND nsp.nspname = 'public'
       ORDER BY con.contype, con.conname`,
      [table]
    )

    // Foreign keys (outgoing)
    const fkResult = await connection.pool.query(
      `SELECT tc.constraint_name, kcu.column_name,
              ccu.table_name AS foreign_table, ccu.column_name AS foreign_column,
              rc.update_rule, rc.delete_rule
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
       JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
       JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1 AND tc.table_schema = 'public'`,
      [table]
    )

    // Triggers
    const triggersResult = await connection.pool.query(
      `SELECT trigger_name, event_manipulation, action_timing, action_statement
       FROM information_schema.triggers
       WHERE event_object_table = $1 AND event_object_schema = 'public'
       ORDER BY trigger_name`,
      [table]
    )

    // Table size
    const sizeResult = await connection.pool.query(
      `SELECT pg_size_pretty(pg_total_relation_size(quote_ident($1))) AS total_size,
              pg_size_pretty(pg_relation_size(quote_ident($1))) AS table_size,
              pg_size_pretty(pg_indexes_size(quote_ident($1))) AS indexes_size`,
      [table]
    )

    return {
      success: true,
      constraints: constraintsResult.rows,
      foreignKeys: fkResult.rows,
      triggers: triggersResult.rows,
      size: sizeResult.rows[0] || {},
    }
  } catch (error: any) {
    console.error('PG table details error:', error)
    return { success: false, error: error.message }
  }
}

/* ── PG Tools: Roles & Users ─────────────────────────── */

export const pgListRoles = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const result = await connection.pool.query(
      `SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin,
              rolreplication, rolconnlimit, rolvaliduntil,
              ARRAY(SELECT b.rolname FROM pg_catalog.pg_auth_members m
                    JOIN pg_catalog.pg_roles b ON m.roleid = b.oid
                    WHERE m.member = r.oid) AS member_of
       FROM pg_catalog.pg_roles r
       ORDER BY rolname`
    )
    return { success: true, roles: result.rows }
  } catch (error: any) {
    console.error('PG list roles error:', error)
    return { success: false, error: error.message }
  }
}

/* ── PG Tools: Extensions ────────────────────────────── */

export const pgListExtensions = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const result = await connection.pool.query(
      `SELECT e.extname AS name, e.extversion AS version, n.nspname AS schema,
              c.description
       FROM pg_extension e
       JOIN pg_namespace n ON n.oid = e.extnamespace
       LEFT JOIN pg_description c ON c.objoid = e.oid
       ORDER BY e.extname`
    )
    return { success: true, extensions: result.rows }
  } catch (error: any) {
    console.error('PG list extensions error:', error)
    return { success: false, error: error.message }
  }
}

/* ── PG Tools: Maintenance (VACUUM / ANALYZE / REINDEX) ── */

export const pgRunMaintenance = async (
  connectionId: string,
  _database: string,
  table: string,
  action: 'vacuum' | 'vacuum_full' | 'analyze' | 'reindex'
) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '')
    let sql = ''
    switch (action) {
      case 'vacuum': sql = `VACUUM "${safeTable}"`; break
      case 'vacuum_full': sql = `VACUUM FULL "${safeTable}"`; break
      case 'analyze': sql = `ANALYZE "${safeTable}"`; break
      case 'reindex': sql = `REINDEX TABLE "${safeTable}"`; break
    }
    await connection.pool.query(sql)
    return { success: true }
  } catch (error: any) {
    console.error('PG maintenance error:', error)
    return { success: false, error: error.message }
  }
}

/* ── PG Tools: Table Sizes ───────────────────────────── */

export const pgGetTableSizes = async (connectionId: string) => {
  try {
    const connection = connections.get(connectionId)
    if (!connection) throw new Error('Not connected')

    const result = await connection.pool.query(
      `SELECT relname AS name,
              pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
              pg_total_relation_size(c.oid) AS total_bytes,
              pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
              pg_size_pretty(pg_indexes_size(c.oid)) AS indexes_size,
              n_live_tup AS row_estimate
       FROM pg_class c
       LEFT JOIN pg_stat_user_tables s ON s.relname = c.relname
       WHERE c.relkind = 'r' AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
       ORDER BY pg_total_relation_size(c.oid) DESC`
    )
    return { success: true, tables: result.rows }
  } catch (error: any) {
    console.error('PG table sizes error:', error)
    return { success: false, error: error.message }
  }
}

/** Disconnect all PostgreSQL connections (used on app quit) */
export const disconnectAll = async () => {
  const tasks = Array.from(connections.keys()).map((id) => disconnectFromPostgreSQL(id).catch(() => {}))
  await Promise.allSettled(tasks)
}
