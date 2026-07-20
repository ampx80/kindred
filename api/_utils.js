// Shared utilities for Kindred serverless routes.
// Every route: `export default withErrorHandling(async (req, res) => { ... })`

// Native apps (Capacitor iOS/Android) load from capacitor://localhost or
// http://localhost and call this same backend cross-origin. Auth is by bearer
// token (never cookies), so a permissive CORS policy is safe and lets the native
// shells talk to production with zero per-route changes. Preflight is answered here.
function applyCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Kindred-Anon');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function withErrorHandling(fn) {
  return async (req, res) => {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    try {
      return await fn(req, res);
    } catch (e) {
      const status = e.code === 'ENV_MISSING' ? 503 : (e.status || 500);
      console.error('[api error]', e);
      return res.status(status).json({ error: e.message, code: e.code || null });
    }
  };
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  return res.status(405).json({ error: 'Method not allowed' });
}

export function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}
