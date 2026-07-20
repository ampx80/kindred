// Sends Aria's gentle nudges to every stored subscription. Invoked hourly by the
// Vercel cron in vercel.json (guarded by CRON_SECRET) or manually with the same
// secret. Because it runs every hour, the actual send decision is per user, in
// their own local time: a morning check-in at their chosen hour and an evening
// reflection at theirs, at most once each per local day. Older subscribers with
// no schedule still get the original single daily nudge (at 9am local) so nobody
// who opted in before this change gets spammed or dropped. Warm and low
// frequency by design - the point is to bring someone back to their own goals,
// gently, not to nag. Dead subscriptions (410/404) are pruned so the list stays
// clean. No em-dashes anywhere.
import { withErrorHandling } from './_utils.js';
import { getSql, ensureTables } from './_lib-db.js';
import webpush from 'web-push';

export const config = { maxDuration: 60 };

// Two pools, rotated by the local day so the line is not identical every day.
const MORNING = [
  'Good morning. One small move today counts more than a perfect week. What is the one thing?',
  'A gentle start: how are you, really? A one-line check-in is enough to begin.',
  'Morning. You have kept promises to yourself before. Today is a good day for one more.',
  'Here is your quiet nudge to begin. Pick one small thing and let the day build from there.',
  'Rise easy. Even a five-minute start is you keeping faith with yourself.',
];
const EVENING = [
  'Winding down. What is one thing from today worth being grateful for?',
  'A soft close to the day: what went well, even a little?',
  'Evening. Take a breath and look back kindly. You showed up, and that counts.',
  'Before you rest, name one moment from today you want to keep.',
  'The day is done. Be gentle with how you look back on it. Tomorrow is fresh.',
];

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${secret}`) return true;               // Vercel cron sends this
  if ((req.query && req.query.key) === secret) return true;   // manual trigger
  return false;
}

// Validate a tz string; fall back to UTC if missing or unrecognized.
function resolveTz(tz) {
  if (!tz || typeof tz !== 'string') return 'UTC';
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; }
  catch { return 'UTC'; }
}

// The user's current local hour (0-23) in the given tz.
function localHour(tz) {
  try {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date());
    let h = parseInt(s, 10);
    if (!Number.isInteger(h)) return null;
    if (h === 24) h = 0;   // some ICU builds render midnight as 24
    return h;
  } catch { return null; }
}

// The user's current local calendar day as 'YYYY-MM-DD' in the given tz.
function localDay(tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch { return null; }
}

// A stable per-calendar-day index so the message rotates once a day.
function dayRotation(day) {
  const [Y, M, D] = String(day).split('-').map(Number);
  if (!Y || !M || !D) return 0;
  return Math.floor(Date.UTC(Y, M - 1, D) / 86400000);
}

export default withErrorHandling(async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });

  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:hello@kindred.app';
  if (!pub || !priv) return res.status(503).json({ error: 'VAPID keys not configured' });
  webpush.setVapidDetails(subject, pub, priv);

  await ensureTables();
  const sql = getSql();
  const subs = await sql`select endpoint, keys, prefs from kindred_push_subs`;
  if (!subs.length) return res.status(200).json({ ok: true, sent: 0, pruned: 0 });

  const results = await Promise.all(subs.map(async (s) => {
    const prefs = (s.prefs && typeof s.prefs === 'object' && !Array.isArray(s.prefs)) ? s.prefs : {};
    const tz = resolveTz(prefs.tz);
    const hour = localHour(tz);
    const day = localDay(tz);
    if (hour == null || day == null) return { sent: 0 };

    const rot = dayRotation(day);
    const lastSent = (prefs.lastSent && typeof prefs.lastSent === 'object') ? prefs.lastSent : {};
    const enabled = prefs.enabled === true;
    const hasMorning = Number.isInteger(prefs.morning);
    const hasEvening = Number.isInteger(prefs.evening);

    const toSend = [];   // each entry: { slot, body }
    if (enabled && (hasMorning || hasEvening)) {
      if (hasMorning && prefs.morning === hour && lastSent.morning !== day) {
        toSend.push({ slot: 'morning', body: MORNING[rot % MORNING.length] });
      }
      if (hasEvening && prefs.evening === hour && lastSent.evening !== day) {
        toSend.push({ slot: 'evening', body: EVENING[rot % EVENING.length] });
      }
    } else if (!enabled && !hasMorning && !hasEvening) {
      // Legacy subscriber (no schedule): preserve the original one-a-day nudge
      // at 9am local, once per local day, without firing on every hourly run.
      if (hour === 9 && lastSent.legacy !== day) {
        toSend.push({ slot: 'legacy', body: MORNING[rot % MORNING.length] });
      }
    }

    if (!toSend.length) return { sent: 0 };

    const sub = { endpoint: s.endpoint, keys: s.keys };
    const newLast = { ...lastSent };
    let sentCount = 0;
    let dead = null;
    for (const { slot, body } of toSend) {
      const payload = JSON.stringify({ title: 'Aria', body, url: '/today', tag: 'kindred-daily' });
      try {
        await webpush.sendNotification(sub, payload);
        sentCount++;
        newLast[slot] = day;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) { dead = s.endpoint; break; }
      }
    }
    return { sent: sentCount, dead, endpoint: s.endpoint, lastSent: sentCount ? newLast : null };
  }));

  let sent = 0;
  const dead = [];
  const updates = [];
  for (const r of results) {
    sent += r.sent || 0;
    if (r.dead) dead.push(r.dead);
    else if (r.lastSent) updates.push({ endpoint: r.endpoint, lastSent: r.lastSent });
  }

  // Persist per-user lastSent bookkeeping so a slot is not resent the same day.
  // Top-level merge (prefs || {...}) replaces the whole lastSent object, so we
  // write the fully merged version (prior slots preserved) back in one shot.
  if (updates.length) {
    await Promise.all(updates.map(u =>
      sql`update kindred_push_subs set prefs = prefs || ${sql.json({ lastSent: u.lastSent })} where endpoint = ${u.endpoint}`
    ));
  }
  if (dead.length) await sql`delete from kindred_push_subs where endpoint = any(${dead})`;

  return res.status(200).json({ ok: true, sent, pruned: dead.length });
});
