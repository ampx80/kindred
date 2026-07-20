// Owner admin dashboard data. One serverless route that powers the Kindred
// control room: fleet-wide overview (signups, activation, retention), a per-user
// roster with a derived engagement score, and a single-user deep dive. Read-only
// aggregates over the durable layer + product telemetry. Owner-gated: you must be
// signed in AND an admin (first account, or listed in ADMIN_EMAILS).
import { withErrorHandling } from './_utils.js';
import { getSql, ensureTables, isAdminAccount } from './_lib-db.js';
import { accountFromReq } from './_lib-account.js';

export const config = { maxDuration: 30 };

// Never let a malformed blob take down the whole response.
function safeData(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}
const arr = (v) => (Array.isArray(v) ? v : []);
const len = (v) => arr(v).length;

// A single blended 0-100 signal from the parts that actually mean "this person is
// building a life here": showing up (daysActive), momentum (best streak), the two
// core rituals (checkins, reflections), and how recently they were seen.
function engagementScore({ daysActive, bestStreak, checkins, reflections, lastActive }) {
  const cap = (n, max) => Math.max(0, Math.min(max, Number(n) || 0));
  let recency = 0;
  if (lastActive) {
    const ageDays = (Date.now() - new Date(lastActive).getTime()) / 86400000;
    recency = ageDays <= 1 ? 10 : ageDays <= 7 ? 6 : ageDays <= 30 ? 3 : 0;
  }
  const score = cap(daysActive, 30)      // up to 30
    + cap(bestStreak, 25)                 // up to 25
    + cap(checkins, 20)                   // up to 20
    + cap(reflections, 15)                // up to 15
    + recency;                            // up to 10
  return Math.round(Math.max(0, Math.min(100, score)));
}

// Fold one accounts+states row (with joined telemetry) into a flat user summary.
function deriveUser(row) {
  const data = safeData(row.data);
  const profile = data && typeof data.profile === 'object' ? data.profile : null;
  const goals = arr(data.goals);
  const bestStreak = goals.reduce((m, g) => Math.max(m, Number(g?.streak) || 0), 0);
  const goalsActive = goals.filter(g => (g?.status || 'active') === 'active').length;
  const checkins = len(data.checkins);
  const reflections = len(data.reflections);
  const daysActive = Number(row.days_active) || 0;

  const stateUpdated = row.updated_at ? new Date(row.updated_at).getTime() : 0;
  const lastEvent = row.last_event ? new Date(row.last_event).getTime() : 0;
  const lastMs = Math.max(stateUpdated, lastEvent);
  const lastActive = lastMs ? new Date(lastMs).toISOString() : null;

  return {
    id: row.id,
    email: row.email || null,
    createdAt: row.created_at || null,
    lastActive,
    name: (profile && profile.name) || null,
    goalsActive,
    goalsTotal: goals.length,
    bestStreak,
    checkins,
    reflections,
    journal: len(data.journal),
    people: len(data.people),
    ariaMessages: len(data.messages),
    faithOpted: !!(profile && profile.faith && profile.faith.opted),
    demo: !!(profile && profile.demo),
    pushEnabled: !!row.push_enabled,
    daysActive,
    engagement: engagementScore({ daysActive, bestStreak, checkins, reflections, lastActive }),
  };
}

async function overview(sql) {
  const [
    totals, signups, signupSeries, active, activeSeries, push, funnel, topEvents, liveFeed,
  ] = await Promise.all([
    sql`select count(*)::int as total from kindred_accounts`,
    sql`select
          (count(*) filter (where created_at >= (now() at time zone 'utc')::date))::int as today,
          (count(*) filter (where created_at >= now() - interval '7 days'))::int as d7,
          (count(*) filter (where created_at >= now() - interval '30 days'))::int as d30
        from kindred_accounts`,
    sql`select to_char(d.day::date, 'YYYY-MM-DD') as day, coalesce(c.count, 0)::int as count
        from generate_series((now() at time zone 'utc')::date - interval '29 days',
                             (now() at time zone 'utc')::date, interval '1 day') d(day)
        left join (
          select created_at::date as day, count(*)::int as count
          from kindred_accounts
          where created_at >= (now() at time zone 'utc')::date - interval '29 days'
          group by 1
        ) c on c.day = d.day::date
        order by d.day`,
    sql`select
          (count(distinct coalesce(account_id::text, anon_id)) filter (where ts >= now() - interval '1 day'))::int as dau,
          (count(distinct coalesce(account_id::text, anon_id)) filter (where ts >= now() - interval '7 days'))::int as wau,
          (count(distinct coalesce(account_id::text, anon_id)) filter (where ts >= now() - interval '30 days'))::int as mau
        from kindred_events`,
    sql`select to_char(d.day::date, 'YYYY-MM-DD') as day, coalesce(c.count, 0)::int as count
        from generate_series((now() at time zone 'utc')::date - interval '29 days',
                             (now() at time zone 'utc')::date, interval '1 day') d(day)
        left join (
          select day, count(distinct coalesce(account_id::text, anon_id))::int as count
          from kindred_events
          where day >= (now() at time zone 'utc')::date - interval '29 days'
          group by day
        ) c on c.day = d.day::date
        order by d.day`,
    sql`select count(*)::int as total,
               (count(*) filter (where prefs->>'enabled' = 'true'))::int as enabled
        from kindred_push_subs`,
    sql`select
          (count(distinct coalesce(account_id::text, anon_id)) filter (where name = 'app_open'))::int as opened,
          (count(distinct coalesce(account_id::text, anon_id)) filter (where name = 'interview_complete'))::int as interviewed,
          (count(distinct coalesce(account_id::text, anon_id)) filter (where name = 'checkin'))::int as checkedin
        from kindred_events`,
    sql`select name, count(*)::int as count
        from kindred_events
        where ts >= now() - interval '24 hours'
        group by name order by count desc limit 12`,
    sql`select e.name, a.email, e.ts, e.props->>'path' as path
        from kindred_events e
        left join kindred_accounts a on a.id = e.account_id
        order by e.ts desc limit 40`,
  ]);

  const f = funnel[0] || {};
  return {
    totalUsers: totals[0]?.total || 0,
    signups: {
      today: signups[0]?.today || 0,
      d7: signups[0]?.d7 || 0,
      d30: signups[0]?.d30 || 0,
    },
    signupSeries: signupSeries.map(r => ({ day: r.day, count: r.count })),
    active: {
      dau: active[0]?.dau || 0,
      wau: active[0]?.wau || 0,
      mau: active[0]?.mau || 0,
    },
    activeSeries: activeSeries.map(r => ({ day: r.day, count: r.count })),
    pushEnabled: {
      total: push[0]?.total || 0,
      enabled: push[0]?.enabled || 0,
    },
    funnel: {
      opened: f.opened || 0,
      interviewed: f.interviewed || 0,
      checkedIn: f.checkedin || 0,
    },
    topEvents: topEvents.map(r => ({ name: r.name, count: r.count })),
    liveFeed: liveFeed.map(r => ({
      name: r.name,
      email: r.email || null,
      ts: r.ts,
      path: r.path || null,
    })),
  };
}

async function usersRoster(sql) {
  const rows = await sql`
    select a.id, a.email, a.created_at, s.data, s.updated_at,
           ev.days_active, ev.last_event, ps.push_enabled
    from kindred_accounts a
    left join kindred_states s on s.account_id = a.id
    left join (
      select account_id, count(distinct day)::int as days_active, max(ts) as last_event
      from kindred_events where account_id is not null group by account_id
    ) ev on ev.account_id = a.id
    left join (
      select account_id, bool_or(prefs->>'enabled' = 'true') as push_enabled
      from kindred_push_subs where account_id is not null group by account_id
    ) ps on ps.account_id = a.id`;

  const users = rows.map(deriveUser).sort((x, y) => {
    const a = x.lastActive ? new Date(x.lastActive).getTime() : 0;
    const b = y.lastActive ? new Date(y.lastActive).getTime() : 0;
    return b - a;
  });
  return { users };
}

async function userDetail(sql, id) {
  const rows = await sql`
    select a.id, a.email, a.created_at, s.data, s.updated_at,
           ev.days_active, ev.last_event, ps.push_enabled
    from kindred_accounts a
    left join kindred_states s on s.account_id = a.id
    left join (
      select account_id, count(distinct day)::int as days_active, max(ts) as last_event
      from kindred_events where account_id is not null group by account_id
    ) ev on ev.account_id = a.id
    left join (
      select account_id, bool_or(prefs->>'enabled' = 'true') as push_enabled
      from kindred_push_subs where account_id is not null group by account_id
    ) ps on ps.account_id = a.id
    where a.id = ${id}`;

  if (!rows.length) return null;
  const base = deriveUser(rows[0]);
  const data = safeData(rows[0].data);
  const profile = data && typeof data.profile === 'object' ? data.profile : null;

  const events = await sql`
    select name, props, ts from kindred_events
    where account_id = ${id} order by ts desc limit 60`;

  const goals = arr(data.goals).map(g => ({
    title: g?.title || 'Untitled',
    streak: Number(g?.streak) || 0,
    status: g?.status || 'active',
  }));

  const faith = profile && profile.faith ? profile.faith : null;
  const profileSummary = {
    name: (profile && profile.name) || null,
    tone: (profile && profile.tone) || null,
    tradition: faith && faith.opted ? (faith.tradition || null) : null,
    faithImportance: faith && faith.opted ? (faith.importance ?? null) : null,
    customDomains: profile ? len(profile.customDomains) : 0,
    reminders: !!(data.settings && data.settings.reminders && data.settings.reminders.enabled),
    createdAt: (profile && profile.createdAt) || rows[0].created_at || null,
  };

  return {
    ...base,
    goals,
    recentEvents: events.map(e => ({ name: e.name, props: e.props || {}, ts: e.ts })),
    profileSummary,
  };
}

export default withErrorHandling(async (req, res) => {
  const acct = accountFromReq(req);
  if (!acct) return res.status(401).json({ error: 'Not signed in' });
  await ensureTables();
  if (!(await isAdminAccount(acct))) return res.status(403).json({ error: 'Not authorized' });

  let section = 'overview';
  let id = null;
  if (req.method === 'POST') {
    const body = (req.body && typeof req.body === 'object') ? req.body
      : (typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : {});
    section = body.section || section;
    id = body.id || null;
  } else {
    section = (req.query && req.query.section) || section;
    id = (req.query && req.query.id) || null;
  }

  const sql = getSql();

  if (section === 'overview') {
    return res.status(200).json(await overview(sql));
  }
  if (section === 'users') {
    return res.status(200).json(await usersRoster(sql));
  }
  if (section === 'user') {
    if (!id) return res.status(400).json({ error: 'id required' });
    const detail = await userDetail(sql, id);
    if (!detail) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json(detail);
  }

  return res.status(400).json({ error: 'Unknown section' });
});
