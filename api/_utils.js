// Shared utilities for Kindred serverless routes.
// Every route: `export default withErrorHandling(async (req, res) => { ... })`

export function withErrorHandling(fn) {
  return async (req, res) => {
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
