// Account primitives: password hashing (scrypt) and stateless session tokens
// (HMAC-signed, no DB lookup to verify). Built on node:crypto only, no deps.
// This is our own lightweight auth because we do not yet have a client anon key
// or an email provider wired for Supabase Auth magic links; email + password
// gives real cross-device accounts today, and magic link is a later upgrade.
import crypto from 'node:crypto';

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s) { const e = new Error('SESSION_SECRET not configured'); e.code = 'ENV_MISSING'; e.status = 503; throw e; }
  return s;
};

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const dk = crypto.scryptSync(pw, salt, 32).toString('hex');
  return `scrypt$${salt}$${dk}`;
}

export function verifyPassword(pw, stored) {
  try {
    const [alg, salt, dk] = String(stored).split('$');
    if (alg !== 'scrypt' || !salt || !dk) return false;
    const test = crypto.scryptSync(pw, salt, 32).toString('hex');
    const a = Buffer.from(test, 'hex'); const b = Buffer.from(dk, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

export function signToken(payload, days = 90) {
  const body = { ...payload, exp: Date.now() + days * 86400000 };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token) {
  try {
    const [data, sig] = String(token).split('.');
    if (!data || !sig) return null;
    const expect = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
    const a = Buffer.from(sig); const b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const body = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!body.exp || body.exp < Date.now()) return null;
    return body;   // { sub, email, exp }
  } catch { return null; }
}

export function accountFromReq(req) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return null;
  return verifyToken(m[1].trim());
}
