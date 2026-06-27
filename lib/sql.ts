import postgres from 'postgres'
import { isDemoMode } from '@/lib/is-demo'

let client: ReturnType<typeof postgres> | null = null
let directDbDisabled = false

export function isPostgresAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('password authentication failed')
}

/** True when direct Postgres should not be used for this request. */
export function isDirectDbConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    isPostgresAuthError(error) ||
    message.includes('ECIRCUITBREAKER') ||
    message.includes('too many authentication failures') ||
    message.includes('DATABASE_URL connection unavailable') ||
    message.includes('DATABASE_URL is missing') ||
    message.includes('DATABASE_URL is for Supabase project') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ENOTFOUND') ||
    message.includes('ETIMEDOUT') ||
    message.includes('Connection terminated')
  )
}

/** Errors where direct Postgres should fall back to the Supabase API. */
export function isDirectDbRecoverableError(error: unknown): boolean {
  if (isDirectDbConnectionError(error)) return true
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('does not exist') ||
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('42703')
  )
}

/** Call after a failed Postgres login so reads fall back to the Supabase API. */
export function markDirectDbAuthFailed(): void {
  directDbDisabled = true
  client?.end().catch(() => {})
  client = null
}

/** Call after a successful Postgres write so reads can use direct SQL again. */
export function markDirectDbAvailable(): void {
  directDbDisabled = false
}

function extractPoolerHost(url?: string): string | null {
  if (!url) return null
  const match = url.match(/@([^:/]+)/)
  return match?.[1] ?? null
}

/** Prefer DATABASE_PASSWORD (plain text) over DATABASE_URL when both are set. */
function resolveDatabaseUrl(): string | undefined {
  const ref = supabaseProjectRef()
  const password = readEnv('DATABASE_PASSWORD')

  if (password && ref) {
    const host =
      readEnv('SUPABASE_DB_POOLER_HOST') ??
      extractPoolerHost(readEnv('DATABASE_URL')) ??
      'aws-1-ap-south-1.pooler.supabase.com'
    return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:6543/postgres`
  }

  return readEnv('DATABASE_URL')
}

function connectPostgres() {
  const url = resolveDatabaseUrl()
  if (!url) {
    throw new Error(
      'DATABASE_URL is missing from .env.local. In Supabase: Settings → Database → Connection string → URI (Transaction pooler, port 6543). Replace [YOUR-PASSWORD] with your database password, restart npm run dev, then try again.',
    )
  }
  validateDatabaseUrl(url)
  if (!client) {
    client = postgres(url, {
      ssl: 'require',
      prepare: false,
      max: 5,
      idle_timeout: 20,
    })
  }
  return client
}

/** True when DATABASE_URL is set for the same Supabase project (ignores read failures). */
export function isDatabaseUrlConfigured(): boolean {
  if (isDemoMode()) return false
  const url = resolveDatabaseUrl()
  if (!url) return false
  const appRef = supabaseProjectRef()
  const dbRef = databaseProjectRef(url)
  if (appRef && dbRef && appRef !== dbRef) return false
  return true
}

function readEnv(name: string): string | undefined {
  const direct = process.env[name]?.trim()
  if (direct) return direct
  for (const [key, value] of Object.entries(process.env)) {
    if (key.trim() === name && value?.trim()) return value.trim()
  }
  return undefined
}

export function supabaseProjectRef(): string | null {
  const match = (readEnv('NEXT_PUBLIC_SUPABASE_URL') ?? '').match(/https:\/\/([^.]+)\.supabase\.co/)
  return match?.[1] ?? null
}

function databaseProjectRef(url: string): string | null {
  const match = url.match(/postgres\.([^:@/]+)/)
  return match?.[1] ?? null
}

function validateDatabaseUrl(url: string): void {
  const appRef = supabaseProjectRef()
  const dbRef = databaseProjectRef(url)
  if (appRef && dbRef && appRef !== dbRef) {
    throw new Error(
      `DATABASE_URL is for Supabase project "${dbRef}" but this app uses "${appRef}". Open project ${appRef} in Supabase → Settings → Database → Connection string → URI (Transaction pooler, port 6543). URL-encode special characters in the password (@ → %40, $ → %24), update .env.local, and restart npm run dev.`,
    )
  }
}

/** Direct Postgres connection — bypasses Supabase Data API (PostgREST). */
export function getSql() {
  if (isDemoMode() || directDbDisabled) return null
  if (!resolveDatabaseUrl()) return null
  return connectPostgres()
}

function databaseUnavailableError(): Error {
  if (directDbDisabled) {
    return new Error('DATABASE_URL connection unavailable')
  }
  return new Error(
    'DATABASE_URL is missing from .env.local. In Supabase: Settings → Database → Connection string → URI (Transaction pooler, port 6543). Replace [YOUR-PASSWORD] with your database password, restart npm run dev, then try again.',
  )
}

export function requireSql() {
  const sql = getSql()
  if (!sql) throw databaseUnavailableError()
  return sql
}

/** For writes — uses direct Postgres when configured and not blocked by prior auth failures. */
export function requireWriteSql(options?: { force?: boolean }) {
  if (isDemoMode() || !isDatabaseUrlConfigured()) {
    throw new Error(
      'DATABASE_URL is missing from .env.local. In Supabase: Settings → Database → Connection string → URI (Transaction pooler, port 6543). Replace [YOUR-PASSWORD] with your database password, restart npm run dev, then try again.',
    )
  }
  if (directDbDisabled && !options?.force) {
    throw new Error('DATABASE_URL connection unavailable')
  }
  return connectPostgres()
}

/** True when DATABASE_URL is set and targets the same Supabase project as the app. */
export function hasDirectDb(): boolean {
  if (isDemoMode() || directDbDisabled) return false
  return isDatabaseUrlConfigured()
}
