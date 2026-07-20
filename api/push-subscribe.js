// Stores a web-push subscription so Aria can send a daily nudge. Account is
// optional: a signed-in user's subs are tied to them (and cascade-deleted with
// the account); anonymous subs are kept by endpoint too. Dedupe by endpoint.
import { withErrorHandling, methodNotAllowed, readJsonBody } from './_utils.js';
import { getSql, ensureTables } from './_lib-db.js';
import { accountFromReq } from './_lib-account.js';

export const config = { maxDuration: 20 };

export default withErrorHandling(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = readJsonBody(req);
  const endpoint = String(body.endpoint || '');
  const keys = body.keys;
  if (!endpoint || !keys || typeof keys !== 'object') return res.status(400).json({ error: 'endpoint + keys required' });

  // Optional per-user schedule prefs ({ enabled, morning, evening, tz, ... }).
  // When present we merge them onto the row's existing prefs so the notification
  // wizard can save times without resending keys, and repeated saves compound
  // rather than clobber (e.g. lastSent bookkeeping written by push-send stays).
  const prefs = (body.prefs && typeof body.prefs === 'object' && !Array.isArray(body.prefs)) ? body.prefs : null;

  await ensureTables();
  const sql = getSql();
  const acct = accountFromReq(req);
  const accountId = acct?.sub || null;

  if (prefs) {
    await sql`insert into kindred_push_subs (endpoint, account_id, keys, prefs)
      values (${endpoint}, ${accountId}, ${sql.json(keys)}, ${sql.json(prefs)})
      on conflict (endpoint) do update set
        account_id = ${accountId},
        keys = ${sql.json(keys)},
        prefs = kindred_push_subs.prefs || ${sql.json(prefs)}`;
  } else {
    await sql`insert into kindred_push_subs (endpoint, account_id, keys)
      values (${endpoint}, ${accountId}, ${sql.json(keys)})
      on conflict (endpoint) do update set account_id = ${accountId}, keys = ${sql.json(keys)}`;
  }
  return res.status(200).json({ ok: true });
});
