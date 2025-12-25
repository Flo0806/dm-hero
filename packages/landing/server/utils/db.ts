import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

export function getPool(): mysql.Pool {
  if (!pool) {
    const config = useRuntimeConfig()

    pool = mysql.createPool({
      host: config.dbHost,
      port: Number(config.dbPort),
      database: config.dbName,
      user: config.dbUser,
      password: config.dbPassword,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: 'Z', // Force UTC - MySQL stores TIMESTAMP in UTC
    })
  }

  return pool
}

export async function query<T>(sql: string, params?: unknown[]): Promise<T> {
  const pool = getPool()
  const [rows] = await pool.execute(sql, params)
  return rows as T
}

export async function queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T[]>(sql, params)
  return rows.length > 0 ? rows[0] : null
}
