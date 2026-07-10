// Sends the daily nudge to every stored subscription. Invoked by the Vercel cron
// in vercel.json (guarded by CRON_SECRET) or manually with the same secret. A
// warm, non-clinical, low-frequency message - the whole point of the channel is
// to bring someone back to their own goals, gently, not to nag. Dead
// subscriptions (410/404) are pruned so the list stays clean.
import { withErrorHandling } from './_utils.js';
import { getSql, ensureTables } from './_lib-db.js';
import webpush from 'web-push';

export const config = { maxDuration: 60 };

const NUDGES = [
  { title: 'Aria', body: 'One small thing today counts more than a perfect week. What is the one move?' },
  { title: 'Aria', body: 'Checking in, gently. How are you, really? A one-line check-in is enough.' },
  { title: 'Aria', body: 'You have kept promises to yourself before. Today is a good day for one more.' },
  { title: 'Aria', body: 'Someone you care about is worth a two-line message. Want me to help you write it?' },
  { title: 'Aria', body: 'A quiet reminder: you are still moving, even on the slow days.' },
];

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${secret}`) return true;               // Vercel cron sends this
  if ((req.query && req.query.key) === secret) return true;   // manual trigger
  return false;
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
  const subs = await sql`select endpoint, keys from kindred_push_subs`;
  if (!subs.length) return res.status(200).json({ ok: true, sent: 0, pruned: 0 });

  // One message this run, rotated by day so it is not the same line daily.
  const idx = new Date().getUTCDate() % NUDGES.length;
  const payload = JSON.stringify({ ...NUDGES[idx], url: '/today', tag: 'kindred-daily' });

  let sent = 0; const dead = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload);
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.endpoint);
    }
  }));
  if (dead.length) await sql`delete from kindred_push_subs where endpoint = any(${dead})`;

  return res.status(200).json({ ok: true, sent, pruned: dead.length });
});
