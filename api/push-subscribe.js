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

  await ensureTables();
  const sql = getSql();
  const acct = accountFromReq(req);
  const accountId = acct?.sub || null;

  await sql`insert into kindred_push_subs (endpoint, account_id, keys) values (${endpoint}, ${accountId}, ${sql.json(keys)})
    on conflict (endpoint) do update set account_id = ${accountId}, keys = ${sql.json(keys)}`;
  return res.status(200).json({ ok: true });
});
