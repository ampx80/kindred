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
  // Per-subscription reminder preferences: { enabled, tz, morning (0-23|null),
  // evening (0-23|null), lastSentDay }. Added idempotently so existing rows heal.
  await sql`alter table kindred_push_subs add column if not exists prefs jsonb not null default '{}'::jsonb`;

  // Product telemetry: anonymous-or-account event stream that powers the admin
  // dashboard (activation, engagement, "what are people doing"). Content is
  // never stored here, only event names + small numeric/string props.
  await sql`create table if not exists kindred_events (
    id bigserial primary key,
    account_id uuid references kindred_accounts(id) on delete cascade,
    anon_id text,
    name text not null,
    props jsonb not null default '{}'::jsonb,
    day date not null default ((now() at time zone 'utc')::date),
    ts timestamptz not null default now()
  )`;
  await sql`create index if not exists kindred_events_ts_idx on kindred_events (ts desc)`;
  await sql`create index if not exists kindred_events_name_idx on kindred_events (name)`;
  await sql`create index if not exists kindred_events_acct_idx on kindred_events (account_id)`;
  await sql`create index if not exists kindred_events_day_idx on kindred_events (day)`;
  _ensured = true;
}

// True if this account is the workspace owner/admin: either listed in
// ADMIN_EMAILS (comma-separated), or the very first account created (so the
// owner has access out of the box with no extra config).
export async function isAdminAccount(acct) {
  if (!acct?.sub) return false;
  const allow = String(process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (acct.email && allow.includes(String(acct.email).toLowerCase())) return true;
  try {
    const sql = getSql();
    const rows = await sql`select id from kindred_accounts order by created_at asc limit 1`;
    return rows.length > 0 && rows[0].id === acct.sub;
  } catch { return false; }
}
