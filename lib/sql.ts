import postgres from 'postgres'
import { isDemoMode } from '@/lib/is-demo'

let client: ReturnType<typeof postgres> | null = null
let directDbDisabled = false

export function isPostgresAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('password authentication failed')
}

/** Call after a failed Postgres login so the app falls back to the Supabase API. */
export function markDirectDbAuthFailed(): void {
  directDbDisabled = true
  client?.end().catch(() => {})
  client = null
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
  const url = readEnv('DATABASE_URL')
  if (!url) return null
  if (!client) {
    validateDatabaseUrl(url)
    client = postgres(url, {
      ssl: 'require',
      prepare: false,
      max: 5,
      idle_timeout: 20,
    })
  }
  return client
}

export function requireSql() {
  const sql = getSql()
  if (!sql) {
    throw new Error(
      'DATABASE_URL is missing from .env.local. In Supabase: Settings → Database → Connection string → URI (Transaction pooler, port 6543). Replace [YOUR-PASSWORD] with your database password, restart npm run dev, then try again.',
    )
  }
  return sql
}

/** True when DATABASE_URL is set and targets the same Supabase project as the app. */
export function hasDirectDb(): boolean {
  if (isDemoMode() || directDbDisabled) return false
  const url = readEnv('DATABASE_URL')
  if (!url) return false
  const appRef = supabaseProjectRef()
  const dbRef = databaseProjectRef(url)
  if (appRef && dbRef && appRef !== dbRef) return false
  return true
}
