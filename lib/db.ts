import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined
}

function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: false,  // ← 這行是唯一改動
  })

  pool.on('error', (err) => {
    console.error('[pg pool] unexpected error:', err)
  })

  return pool
}

export const pool: Pool =
  process.env.NODE_ENV === 'development'
    ? (globalThis._pgPool ??= createPool())
    : createPool()

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query(text, params)
  return result.rows as T[]
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}

export function getDevUserId(): string {
  const id = process.env.TEST_USER_ID
  if (!id) throw new Error('TEST_USER_ID is not set in .env.local')
  return id
}