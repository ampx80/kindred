// Lazy Postgres access for Kindred's durable layer. One pooled client per warm
// serverless instance. Tables are created idempotently on first use so a fresh
// environment self-heals without a separate migration step. prepare:false keeps
// us compatible with the Supabase transaction pooler (pgbouncer).
import postgres from 'postgres';

let _sql = null;
export function getSql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    const e = new Error('DATABASE_URL not configured'); e.code = 'ENV_MISSING'; e.status = 503; throw e;
  }
  _sql = postgres(url, { ssl: 'require', max: 1, idle_timeout: 20, connect_timeout: 12, prepare: false });
  return _sql;
}

let _ensured = false;
export async function ensureTables() {
  if (_ensured) return;
  const sql = getSql();
  await sql`create table if not exists kindred_accounts (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    pw_hash text not null,
    created_at timestamptz not null default now()
  )`;
  await sql`create table if not exists kindred_states (
    account_id uuid primary key references kindred_accounts(id) on delete cascade,
    data jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
  )`;
  await sql`create table if not exists kindred_push_subs (
    endpoint text primary key,
    account_id uuid references kindred_accounts(id) on delete cascade,
    keys jsonb not null,
    created_at timestamptz not null default now()
  )`;
  _ensured = true;
}
