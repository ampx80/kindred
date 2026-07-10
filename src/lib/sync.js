// The bridge between the local store and the durable server record. On sign-in
// we pull the server blob (server wins if it holds a real life); on the first
// sign-in for an account we seed the server from local so the demo-turned-real
// life is not lost. Every store change debounce-pushes up. Last-write-wins by
// updated_at is good enough for v1 (one person, a few devices).
import { getToken, onAccount } from './account.js';
import { snapshot, subscribe, hydrate } from './store.js';
import { authHeader } from './account.js';

let pushTimer = null;
let pulling = false;

async function pull() {
  const token = getToken();
  if (!token) return null;
  try {
    const r = await fetch('/api/state', { headers: { ...authHeader() } });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return j?.data || null;
  } catch { return null; }
}

async function push() {
  if (!getToken()) return;
  try {
    await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ data: snapshot() }),
    });
  } catch {}
}

function schedulePush() {
  if (!getToken() || pulling) return;   // do not echo a pull straight back up
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 1500);
}

const hasRealLife = (blob) => !!(blob && (blob.profile || (Array.isArray(blob.goals) && blob.goals.length)));

export function initSync() {
  subscribe(schedulePush);

  onAccount(async (acct) => {
    if (!acct) return;
    pulling = true;
    try {
      const server = await pull();
      if (hasRealLife(server)) {
        hydrate(server);          // restore the durable record onto this device
      } else {
        await push();             // first sign-in on this account: seed the server
      }
    } finally {
      pulling = false;
    }
  });
}
