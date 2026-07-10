// The durable life record. The client store is a single JSON blob, so sync is
// just push (PUT) and pull (GET) of that blob, keyed by account. This is what
// makes Kindred survive a cleared cache or a new device: the compounding record
// lives on the server, not only in one browser. DELETE erases the account and
// (by cascade) all of its data - the mental-privacy right to be forgotten.
import { withErrorHandling, methodNotAllowed, readJsonBody } from './_utils.js';
import { getSql, ensureTables } from './_lib-db.js';
import { accountFromReq } from './_lib-account.js';

export const config = { maxDuration: 20 };

export default withErrorHandling(async (req, res) => {
  const acct = accountFromReq(req);
  if (!acct) return res.status(401).json({ error: 'Not signed in' });
  await ensureTables();
  const sql = getSql();

  if (req.method === 'GET') {
    const rows = await sql`select data, updated_at from kindred_states where account_id = ${acct.sub}`;
    if (!rows.length) return res.status(200).json({ ok: true, data: null, updatedAt: null });
    return res.status(200).json({ ok: true, data: rows[0].data, updatedAt: rows[0].updated_at });
  }

  if (req.method === 'PUT') {
    const body = readJsonBody(req);
    const data = body.data;
    if (!data || typeof data !== 'object') return res.status(400).json({ error: 'data object required' });
    await sql`insert into kindred_states (account_id, data, updated_at) values (${acct.sub}, ${sql.json(data)}, now())
      on conflict (account_id) do update set data = ${sql.json(data)}, updated_at = now()`;
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await sql`delete from kindred_accounts where id = ${acct.sub}`;   // cascades to states + push subs
    return res.status(200).json({ ok: true });
  }

  return methodNotAllowed(res, ['GET', 'PUT', 'DELETE']);
});
