// Stores a native push device token (APNs on iOS, FCM on Android) sent by the
// Capacitor shell after the person allows notifications. Associated to the signed
// in account when a bearer token is present, otherwise kept on its own so the
// device can still be reached. Sending the actual nudges from the server needs
// APNs/FCM credentials wired at deploy time; this is the token sink that makes it
// possible.
import { withErrorHandling, methodNotAllowed, readJsonBody } from './_utils.js';
import { getSql } from './_lib-db.js';
import { accountFromReq } from './_lib-account.js';

export default withErrorHandling(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const b = readJsonBody(req);
  const token = String(b.token || '').slice(0, 500);
  const platform = ['ios', 'android'].includes(b.platform) ? b.platform : 'unknown';
  if (!token) return res.status(400).json({ error: 'token required' });

  const sql = getSql();
  await sql`create table if not exists kindred_native_tokens (
    token text primary key,
    platform text,
    account_id text,
    created_at timestamptz default now(),
    seen_at timestamptz default now()
  )`;

  let accountId = null;
  try { const acct = accountFromReq(req); accountId = (acct && acct.sub) || null; } catch {}

  await sql`
    insert into kindred_native_tokens (token, platform, account_id, seen_at)
    values (${token}, ${platform}, ${accountId}, now())
    on conflict (token) do update set
      platform = excluded.platform,
      account_id = coalesce(excluded.account_id, kindred_native_tokens.account_id),
      seen_at = now()
  `;

  return res.status(200).json({ ok: true });
});
