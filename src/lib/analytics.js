// Privacy-respecting, local-first analytics. We record only anonymous event
// counts and timestamps (never content) so we can see activation and return
// behavior - the metrics that define success in this category. It lives in
// localStorage and never leaves the device unless a future opt-in ships. This
// is how we stop flying blind on D1/D7/D30 without violating the mental-privacy
// principle the whole app is built on.
const KEY = 'kindred_analytics_v1';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') || fresh(); } catch { return fresh(); }
}
function fresh() {
  return { firstSeen: new Date().toISOString(), days: {}, counts: {}, lastSeen: null };
}
function write(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {} }

// Call once on load: records a daily active day and the return streak.
export function pingVisit() {
  const a = read();
  const today = new Date().toISOString().slice(0, 10);
  a.days[today] = (a.days[today] || 0) + 1;
  a.lastSeen = new Date().toISOString();
  write(a);
}

export function track(event) {
  const a = read();
  a.counts[event] = (a.counts[event] || 0) + 1;
  write(a);
}

// Returns { activeDays, retentionD1, retentionD7, totalEvents, ... } for a
// future in-app "your consistency" view. All derived locally.
export function summary() {
  const a = read();
  const dayKeys = Object.keys(a.days).sort();
  const first = a.firstSeen ? a.firstSeen.slice(0, 10) : dayKeys[0];
  const has = (d) => !!a.days[d];
  const plus = (base, n) => { const dt = new Date(base); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };
  return {
    firstSeen: a.firstSeen,
    activeDays: dayKeys.length,
    returnedD1: first ? has(plus(first, 1)) : false,
    returnedD7: first ? dayKeys.some(d => d >= plus(first, 7)) : false,
    counts: a.counts,
  };
}
