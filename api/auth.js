// Kindred accounts: signup, login, and session check. Email + password, server
// verified. Returns a signed token the client stores and sends as a bearer.
import { withErrorHandling, methodNotAllowed, readJsonBody } from './_utils.js';
import { getSql, ensureTables } from './_lib-db.js';
import { hashPassword, verifyPassword, signToken, accountFromReq } from './_lib-account.js';

export const config = { maxDuration: 20 };

const emailOk = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

export default withErrorHandling(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = readJsonBody(req);
  const action = body.action;

  // Cheap, no-DB session check.
  if (action === 'me') {
    const acct = accountFromReq(req);
    if (!acct) return res.status(401).json({ error: 'Not signed in' });
    return res.status(200).json({ ok: true, account: { id: acct.sub, email: acct.email } });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!emailOk(email)) return res.status(400).json({ error: 'Enter a valid email.' });
  if (password.length < 8) return res.status(400).json({ error: 'Use at least 8 characters for your password.' });

  await ensureTables();
  const sql = getSql();

  if (action === 'signup') {
    const existing = await sql`select id from kindred_accounts where email = ${email}`;
    if (existing.length) return res.status(409).json({ error: 'That email already has an account. Try signing in instead.' });
    const rows = await sql`insert into kindred_accounts (email, pw_hash) values (${email}, ${hashPassword(password)}) returning id, email`;
    const acct = rows[0];
    return res.status(200).json({ ok: true, token: signToken({ sub: acct.id, email: acct.email }), account: { id: acct.id, email: acct.email } });
  }

  if (action === 'login') {
    const rows = await sql`select id, email, pw_hash from kindred_accounts where email = ${email}`;
    if (!rows.length || !verifyPassword(password, rows[0].pw_hash)) {
      return res.status(401).json({ error: 'That email or password is not right.' });
    }
    const acct = rows[0];
    return res.status(200).json({ ok: true, token: signToken({ sub: acct.id, email: acct.email }), account: { id: acct.id, email: acct.email } });
  }

  return res.status(400).json({ error: 'Unknown action.' });
});
