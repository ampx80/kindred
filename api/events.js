// Telemetry ingest. Accepts a small batch of anonymous-or-account events from the
// client and stores names + tiny props (never journal/chat content). This is the
// raw material for the admin dashboard: activation, engagement, and a live feed of
// what people are actually doing. Signed-in requests are associated to the account;
// otherwise we keep a stable anon id so we can still count humans and D1/D7 return.
import { withErrorHandling, methodNotAllowed, readJsonBody } from './_utils.js';
import { getSql, ensureTables } from './_lib-db.js';
import { accountFromReq } from './_lib-account.js';

export const config = { maxDuration: 15 };

const MAX_BATCH = 50;
const NAME_RE = /^[a-z0-9_.:-]{1,48}$/i;

// Keep props tiny and scalar so this can never become a content sink.
function safeProps(p) {
  if (!p || typeof p !== 'object') return {};
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(p)) {
    if (n++ >= 12) break;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 120);
  }
  return out;
}

export default withErrorHandling(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = readJsonBody(req);
  const events = Array.isArray(body.events) ? body.events.slice(0, MAX_BATCH) : [];
  const anonId = typeof body.anonId === 'string' ? body.anonId.slice(0, 64) : null;
  if (!events.length) return res.status(200).json({ ok: true, stored: 0 });

  await ensureTables();
  const sql = getSql();
  const acct = accountFromReq(req);
  const accountId = acct?.sub || null;

  const rows = [];
  for (const e of events) {
    const name = typeof e?.name === 'string' ? e.name.trim() : '';
    if (!NAME_RE.test(name)) continue;
    const ts = Number(e?.t);
    const when = Number.isFinite(ts) && ts > 0 ? new Date(ts) : new Date();
    rows.push({
      account_id: accountId,
      anon_id: anonId,
      name,
      props: sql.json(safeProps(e?.props)),
      ts: when,
      day: when.toISOString().slice(0, 10),
    });
  }
  if (!rows.length) return res.status(200).json({ ok: true, stored: 0 });

  await sql`insert into kindred_events ${sql(rows, 'account_id', 'anon_id', 'name', 'props', 'ts', 'day')}`;
  return res.status(200).json({ ok: true, stored: rows.length });
});
