// Kindred control room - the owner-only admin dashboard. A warm, calm read on the
// whole fleet: who signed up, who keeps showing up, where activation leaks, and a
// per-person deep dive. Read-only. Gated behind sign-in + admin (first account or
// ADMIN_EMAILS). All data comes from /api/admin. No chart library, no extra deps.
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/icons.jsx';
import { StreakFlame } from '../components/Delight.jsx';
import { authHeader, isSignedIn, login, logout } from '../lib/account.js';

/* ----------------------------- small helpers ----------------------------- */

function fmt(n) {
  const v = Number(n) || 0;
  if (v >= 1000000) return (v / 1000000).toFixed(v % 1000000 ? 1 : 0) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k';
  return String(v);
}

function relTime(ts) {
  if (!ts) return 'never';
  const d = new Date(ts).getTime();
  if (!d) return 'never';
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 0) return 'just now';
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const days = Math.floor(h / 24);
  if (days < 30) return days + 'd ago';
  const mo = Math.floor(days / 30);
  if (mo < 12) return mo + 'mo ago';
  return Math.floor(mo / 12) + 'y ago';
}

function shortDate(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function eventLabel(name, path) {
  switch (name) {
    case 'checkin': return 'checked in';
    case 'goal_done': return 'kept a promise';
    case 'reflection': return 'reflected at night';
    case 'interview_complete': return 'finished onboarding';
    case 'app_open': return 'opened the app';
    case 'page_view': return 'viewed ' + (path || 'a page');
    case 'faith_set': return 'set their faith';
    case 'domain_added': return 'added a life area';
    case 'notify_enabled': return 'turned on notifications';
    case 'reminders_set': return 'set reminders';
    default: return String(name || 'did something').replace(/_/g, ' ');
  }
}

function engColor(score) {
  const s = Number(score) || 0;
  if (s >= 70) return 'var(--sage)';
  if (s >= 40) return 'var(--gold)';
  if (s >= 15) return 'var(--accent)';
  return 'var(--rose)';
}

async function fetchSection(section, id) {
  const q = new URLSearchParams({ section });
  if (id) q.set('id', id);
  const r = await fetch('/api/admin?' + q.toString(), { headers: { ...authHeader() } });
  if (r.status === 401) { const e = new Error('Not signed in'); e.code = 401; throw e; }
  if (r.status === 403) { const e = new Error('Not authorized'); e.code = 403; throw e; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Could not load the control room.');
  return j;
}

/* ------------------------------- charts ---------------------------------- */

function BarChart({ data = [], color = 'var(--accent)' }) {
  const W = 320, H = 96, pad = 3;
  const max = Math.max(1, ...data.map(d => d.count));
  const n = data.length || 1;
  const bw = (W - pad * 2) / n;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="ad-chart" role="img" aria-label="Signups over the last 30 days">
      {data.map((d, i) => {
        const h = (d.count / max) * (H - 8);
        const x = pad + i * bw;
        const y = H - h;
        const shown = d.count > 0 ? Math.max(h, 2) : 0;
        return <rect key={i} x={x + bw * 0.16} y={H - shown} width={Math.max(bw * 0.68, 1)} height={shown} rx="1.4" fill={color} />;
      })}
    </svg>
  );
}

function AreaChart({ data = [], color = 'var(--accent)' }) {
  const W = 320, H = 96;
  const max = Math.max(1, ...data.map(d => d.count));
  const n = data.length;
  if (!n) return <svg viewBox={`0 0 ${W} ${H}`} className="ad-chart" aria-hidden />;
  const pts = data.map((d, i) => {
    const x = n === 1 ? W / 2 : (i / (n - 1)) * W;
    const y = H - (d.count / max) * (H - 8) - 2;
    return [x, y];
  });
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ` L ${W} ${H} L 0 ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="ad-chart" role="img" aria-label="Daily active people over the last 30 days">
      <path d={area} fill={color} opacity="0.14" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------ sign-in ---------------------------------- */

function SignIn({ forbidden, onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await login(email.trim(), password);
      onSignedIn();
    } catch (ex) {
      setErr(ex.message || 'That email or password is not right.');
    } finally { setBusy(false); }
  };

  return (
    <div className="ad-gate">
      <form className="ad-gate-card" onSubmit={submit}>
        <div className="ad-gate-badge"><Icon name="compass" size={22} /></div>
        <h1 className="ad-gate-title">Kindred control room</h1>
        {forbidden ? (
          <>
            <p className="ad-gate-sub">This account is not an admin.</p>
            <button type="button" className="ad-btn ad-btn-ghost" onClick={() => { logout(); onSignedIn(); }}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <p className="ad-gate-sub">Sign in with the owner account to see the fleet.</p>
            <label className="ad-field">
              <span>Email</span>
              <input type="email" value={email} autoComplete="email" required
                onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
            </label>
            <label className="ad-field">
              <span>Password</span>
              <input type="password" value={password} autoComplete="current-password" required
                onChange={e => setPassword(e.target.value)} placeholder="Your password" />
            </label>
            {err && <div className="ad-gate-err">{err}</div>}
            <button type="submit" className="ad-btn ad-btn-primary" disabled={busy}>
              {busy ? 'Signing in...' : 'Enter the control room'}
            </button>
          </>
        )}
        <Link to="/today" className="ad-gate-back">Back to Kindred</Link>
      </form>
      <ScopedStyle />
    </div>
  );
}

/* ------------------------------ stat card -------------------------------- */

function StatCard({ label, value, sub, tone }) {
  return (
    <div className="ad-stat">
      <div className="ad-stat-label">{label}</div>
      <div className="ad-stat-value" style={tone ? { color: tone } : undefined}>{value}</div>
      {sub && <div className="ad-stat-sub">{sub}</div>}
    </div>
  );
}

/* -------------------------------- funnel --------------------------------- */

function Funnel({ funnel }) {
  const steps = [
    { key: 'opened', label: 'Opened', value: funnel.opened || 0 },
    { key: 'interviewed', label: 'Interviewed', value: funnel.interviewed || 0 },
    { key: 'checkedIn', label: 'Checked in', value: funnel.checkedIn || 0 },
  ];
  const top = Math.max(1, steps[0].value);
  return (
    <div className="ad-funnel">
      {steps.map((s, i) => {
        const pctOfTop = Math.round((s.value / top) * 100);
        const pctOfPrev = i === 0 ? 100 : (steps[i - 1].value ? Math.round((s.value / steps[i - 1].value) * 100) : 0);
        return (
          <div className="ad-funnel-row" key={s.key}>
            <div className="ad-funnel-head">
              <span className="ad-funnel-label">{s.label}</span>
              <span className="ad-funnel-num">{fmt(s.value)} <span className="ad-muted">({pctOfTop}%)</span></span>
            </div>
            <div className="ad-funnel-track">
              <div className="ad-funnel-fill" style={{ width: Math.max(pctOfTop, s.value ? 4 : 0) + '%' }} />
            </div>
            {i > 0 && <div className="ad-funnel-conv">{pctOfPrev}% carried over from {steps[i - 1].label.toLowerCase()}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------- user detail -------------------------------- */

function UserDrawer({ userId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(''); setDetail(null);
    fetchSection('user', userId)
      .then(d => { if (alive) setDetail(d); })
      .catch(e => { if (alive) setErr(e.message || 'Could not load this person.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const initial = (detail?.name || detail?.email || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="ad-drawer-scrim" onClick={onClose}>
      <aside className="ad-drawer" onClick={e => e.stopPropagation()} role="dialog" aria-label="Person detail">
        <div className="ad-drawer-top">
          <button className="ad-icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>

        {loading && <div className="ad-drawer-state">Loading this person...</div>}
        {err && !loading && <div className="ad-drawer-state ad-err-text">{err}</div>}

        {detail && !loading && (
          <div className="ad-drawer-body">
            <div className="ad-drawer-hero">
              <div className="ad-avatar ad-avatar-lg" style={{ background: engColor(detail.engagement) }}>{initial}</div>
              <div className="ad-drawer-idwrap">
                <div className="ad-drawer-name">{detail.name || 'Unnamed'}</div>
                <div className="ad-muted ad-clip">{detail.email || 'no email'}</div>
                <div className="ad-drawer-tags">
                  {detail.demo && <span className="ad-tag ad-tag-gold">demo</span>}
                  {detail.faithOpted && <span className="ad-tag ad-tag-sage">faith on</span>}
                  {detail.pushEnabled && <span className="ad-tag ad-tag-accent"><Icon name="volume" size={12} /> reminders</span>}
                </div>
              </div>
            </div>

            <div className="ad-drawer-meta">
              <div><span className="ad-muted">Joined</span><b>{shortDate(detail.createdAt)}</b></div>
              <div><span className="ad-muted">Last active</span><b>{relTime(detail.lastActive)}</b></div>
              <div><span className="ad-muted">Days active</span><b>{fmt(detail.daysActive)}</b></div>
              <div><span className="ad-muted">Engagement</span><b style={{ color: engColor(detail.engagement) }}>{detail.engagement}</b></div>
            </div>

            <div className="ad-chip-row">
              <span className="ad-chip"><b>{fmt(detail.goalsActive)}</b>/{fmt(detail.goalsTotal)} goals</span>
              <span className="ad-chip"><b>{fmt(detail.checkins)}</b> checkins</span>
              <span className="ad-chip"><b>{fmt(detail.reflections)}</b> reflections</span>
              <span className="ad-chip"><b>{fmt(detail.journal)}</b> journal</span>
              <span className="ad-chip"><b>{fmt(detail.people)}</b> people</span>
              <span className="ad-chip"><b>{fmt(detail.ariaMessages)}</b> Aria msgs</span>
            </div>

            {detail.profileSummary && (
              <div className="ad-drawer-profile">
                {detail.profileSummary.tone && <span>Tone: <b>{detail.profileSummary.tone}</b></span>}
                {detail.profileSummary.tradition && <span>Faith: <b>{detail.profileSummary.tradition}</b></span>}
                {detail.profileSummary.customDomains > 0 && <span><b>{detail.profileSummary.customDomains}</b> custom areas</span>}
              </div>
            )}

            <div className="ad-drawer-section">
              <h3 className="ad-drawer-h">Goals</h3>
              {detail.goals?.length ? (
                <div className="ad-goal-list">
                  {detail.goals.map((g, i) => (
                    <div className="ad-goal" key={i}>
                      <StreakFlame count={g.streak} size={26} showCount={false} />
                      <div className="ad-goal-main">
                        <div className="ad-goal-title ad-clip">{g.title}</div>
                        <div className="ad-muted ad-t-sm">{g.streak} in a row - {g.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="ad-muted ad-t-sm">No goals yet.</div>}
            </div>

            <div className="ad-drawer-section">
              <h3 className="ad-drawer-h">Recent activity</h3>
              {detail.recentEvents?.length ? (
                <ul className="ad-feed ad-feed-tight">
                  {detail.recentEvents.map((e, i) => (
                    <li key={i} className="ad-feed-item">
                      <span className="ad-feed-dot" />
                      <span className="ad-feed-text">{eventLabel(e.name, e.props?.path)}</span>
                      <span className="ad-feed-time">{relTime(e.ts)}</span>
                    </li>
                  ))}
                </ul>
              ) : <div className="ad-muted ad-t-sm">No activity recorded yet.</div>}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

/* ------------------------------ users table ------------------------------ */

const SORTS = {
  lastActive: { label: 'Last active', get: u => (u.lastActive ? new Date(u.lastActive).getTime() : 0) },
  engagement: { label: 'Engagement', get: u => u.engagement || 0 },
  bestStreak: { label: 'Streak', get: u => u.bestStreak || 0 },
  checkins: { label: 'Checkins', get: u => u.checkins || 0 },
};

function UsersTable({ users, onOpen }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('lastActive');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const getter = SORTS[sort].get;
    return users
      .filter(u => !needle ||
        (u.email || '').toLowerCase().includes(needle) ||
        (u.name || '').toLowerCase().includes(needle))
      .slice()
      .sort((a, b) => getter(b) - getter(a));
  }, [users, q, sort]);

  return (
    <div className="ad-card ad-users">
      <div className="ad-users-head">
        <div className="ad-panel-title">People <span className="ad-muted">({fmt(users.length)})</span></div>
        <div className="ad-users-controls">
          <div className="ad-search">
            <Icon name="users" size={15} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or email" />
          </div>
          <div className="ad-sort" role="tablist" aria-label="Sort people">
            {Object.entries(SORTS).map(([key, s]) => (
              <button key={key} className={'ad-sort-btn' + (sort === key ? ' is-on' : '')}
                onClick={() => setSort(key)}>{s.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="ad-table-head">
        <span>Person</span>
        <span className="ad-col-mid">Joined</span>
        <span className="ad-col-mid">Last active</span>
        <span>Engagement</span>
        <span className="ad-col-chips">Activity</span>
        <span className="ad-col-flags" />
      </div>

      {rows.length === 0 && (
        <div className="ad-empty">
          {users.length === 0 ? 'No people have signed up yet. The moment someone does, they show up here.' : 'No one matches that search.'}
        </div>
      )}

      <div className="ad-rows">
        {rows.map(u => {
          const initial = (u.name || u.email || '?').trim().charAt(0).toUpperCase() || '?';
          return (
            <button className="ad-row" key={u.id} onClick={() => onOpen(u.id)}>
              <span className="ad-row-user">
                <span className="ad-avatar" style={{ background: engColor(u.engagement) }}>{initial}</span>
                <span className="ad-row-idwrap">
                  <span className="ad-row-name ad-clip">{u.name || 'Unnamed'}</span>
                  <span className="ad-muted ad-clip ad-t-sm">{u.email || 'no email'}</span>
                </span>
                {u.demo && <span className="ad-tag ad-tag-gold ad-tag-inline">demo</span>}
              </span>

              <span className="ad-col-mid ad-cell">
                <span className="ad-m-label">Joined</span>{shortDate(u.createdAt)}
              </span>
              <span className="ad-col-mid ad-cell">
                <span className="ad-m-label">Last active</span>{relTime(u.lastActive)}
              </span>

              <span className="ad-cell ad-eng">
                <span className="ad-m-label">Engagement</span>
                <span className="ad-eng-bar"><i style={{ width: (u.engagement || 0) + '%', background: engColor(u.engagement) }} /></span>
                <b className="ad-eng-num" style={{ color: engColor(u.engagement) }}>{u.engagement}</b>
              </span>

              <span className="ad-col-chips ad-cell ad-row-chips">
                <span className="ad-mini">{fmt(u.goalsActive)}/{fmt(u.goalsTotal)} goals</span>
                <span className="ad-mini">{fmt(u.checkins)} checkins</span>
                <span className="ad-mini">{fmt(u.reflections)} reflections</span>
                <span className="ad-mini">{fmt(u.ariaMessages)} msgs</span>
              </span>

              <span className="ad-col-flags ad-cell ad-row-flags">
                {u.pushEnabled && <span className="ad-bell" title="Reminders on"><Icon name="volume" size={15} /></span>}
                {u.bestStreak > 0 && <span className="ad-streak-chip"><Icon name="flame" size={13} /> {u.bestStreak}</span>}
                <Icon name="chevronRight" size={16} className="ad-row-caret" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------- feed ----------------------------------- */

function LiveFeed({ feed }) {
  return (
    <div className="ad-card ad-livefeed">
      <div className="ad-panel-title">Live activity</div>
      {feed.length === 0 ? (
        <div className="ad-empty ad-empty-sm">Nothing has happened in the last little while. It will stream in here.</div>
      ) : (
        <ul className="ad-feed">
          {feed.map((e, i) => (
            <li key={i} className="ad-feed-item">
              <span className="ad-feed-dot" />
              <span className="ad-feed-text">
                <b>{e.email ? e.email.split('@')[0] : 'Someone'}</b> {eventLabel(e.name, e.path)}
              </span>
              <span className="ad-feed-time">{relTime(e.ts)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------- main page ------------------------------- */

export default function Admin() {
  // gate: 'checking' | 'need-login' | 'forbidden' | 'ok'
  const [gate, setGate] = useState(isSignedIn() ? 'checking' : 'need-login');
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState('');
  const [openUser, setOpenUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    try {
      const [ov, us] = await Promise.all([fetchSection('overview'), fetchSection('users')]);
      setOverview(ov);
      setUsers(us.users || []);
      setErr('');
      setGate('ok');
    } catch (e) {
      if (e.code === 401) { setGate('need-login'); }
      else if (e.code === 403) { setGate('forbidden'); }
      else { setErr(e.message || 'Could not load the control room.'); }
    } finally {
      if (soft) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (gate === 'checking') load(false);
  }, [gate, load]);

  useEffect(() => {
    if (gate !== 'ok') return;
    timer.current = setInterval(() => load(true), 30000);
    return () => clearInterval(timer.current);
  }, [gate, load]);

  if (gate === 'need-login' || gate === 'forbidden') {
    return <SignIn forbidden={gate === 'forbidden'} onSignedIn={() => setGate('checking')} />;
  }

  if (gate === 'checking' && !overview) {
    return (
      <div className="ad-wrap">
        <div className="ad-loading">
          <div className="ad-spinner" />
          <span>Opening the control room...</span>
        </div>
        <ScopedStyle />
      </div>
    );
  }

  const ov = overview || {};
  const active = ov.active || {};
  const signups = ov.signups || {};
  const push = ov.pushEnabled || {};
  const feed = ov.liveFeed || [];

  const activeNow = feed.filter(e => {
    const t = new Date(e.ts).getTime();
    return t && (Date.now() - t) < 5 * 60 * 1000;
  }).length;

  return (
    <div className="ad-wrap">
      <header className="ad-header">
        <div className="ad-header-l">
          <div className="ad-eyebrow">Owner</div>
          <h1 className="ad-title">Kindred control room</h1>
        </div>
        <div className="ad-header-r">
          <span className="ad-live-pill" title="Active in the last 5 minutes">
            <span className="ad-live-dot" /> {activeNow} active now
          </span>
          <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => load(true)} disabled={refreshing}>
            <Icon name="refresh" size={15} className={refreshing ? 'ad-spin' : ''} /> Refresh
          </button>
          <Link to="/today" className="ad-btn ad-btn-quiet ad-btn-sm">Back to Kindred</Link>
        </div>
      </header>

      {err && <div className="ad-banner ad-err-text">{err}</div>}

      <section className="ad-stats">
        <StatCard label="Total users" value={fmt(ov.totalUsers || 0)} sub={(signups.d30 || 0) + ' in the last 30 days'} />
        <StatCard label="New (7 days)" value={fmt(signups.d7 || 0)} sub={(signups.today || 0) + ' today'} tone="var(--accent)" />
        <StatCard label="Active today" value={fmt(active.dau || 0)} sub="DAU" tone="var(--sage)" />
        <StatCard label="Active this week" value={fmt(active.wau || 0)} sub={'MAU ' + fmt(active.mau || 0)} />
        <StatCard label="Reminders on" value={fmt(push.enabled || 0)} sub={'of ' + fmt(push.total || 0) + ' subscribed'} tone="var(--gold)" />
      </section>

      <section className="ad-charts">
        <div className="ad-card ad-chart-card">
          <div className="ad-panel-title">Signups <span className="ad-muted">last 30 days</span></div>
          <BarChart data={ov.signupSeries || []} color="var(--accent)" />
          <div className="ad-chart-foot">
            <span className="ad-muted">30 days ago</span>
            <span className="ad-muted">today</span>
          </div>
        </div>
        <div className="ad-card ad-chart-card">
          <div className="ad-panel-title">Daily active <span className="ad-muted">last 30 days</span></div>
          <AreaChart data={ov.activeSeries || []} color="var(--sage)" />
          <div className="ad-chart-foot">
            <span className="ad-muted">30 days ago</span>
            <span className="ad-muted">today</span>
          </div>
        </div>
      </section>

      <section className="ad-two">
        <div className="ad-card">
          <div className="ad-panel-title">Activation funnel</div>
          <Funnel funnel={ov.funnel || {}} />
        </div>
        <LiveFeed feed={feed} />
      </section>

      {users && <UsersTable users={users} onOpen={setOpenUser} />}

      {openUser && <UserDrawer userId={openUser} onClose={() => setOpenUser(null)} />}

      <ScopedStyle />
    </div>
  );
}

/* ------------------------------ scoped css ------------------------------- */

function ScopedStyle() {
  return (
    <style>{`
.ad-wrap { max-width: 1180px; margin: 0 auto; padding: clamp(1rem, 3vw, 2rem) clamp(.9rem, 3vw, 1.6rem) 5rem; color: var(--ink); }
.ad-muted { color: var(--n-600); font-weight: 500; }
.ad-t-sm { font-size: .82rem; }
.ad-clip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.ad-err-text { color: var(--rose); }

/* buttons */
.ad-btn { display: inline-flex; align-items: center; gap: .4rem; border: 1px solid transparent; border-radius: var(--r-pill);
  padding: .6rem 1.05rem; font-weight: 650; font-size: .92rem; cursor: pointer; transition: all .18s var(--ease, ease); font-family: inherit; }
.ad-btn-sm { padding: .48rem .85rem; font-size: .86rem; }
.ad-btn-primary { background: var(--accent); color: #fff; }
.ad-btn-primary:hover { background: var(--accent-600); }
.ad-btn-primary:disabled { opacity: .6; cursor: default; }
.ad-btn-ghost { background: var(--paper); border-color: var(--line-strong); color: var(--ink); }
.ad-btn-ghost:hover { border-color: var(--accent-300); }
.ad-btn-quiet { background: transparent; color: var(--n-600); }
.ad-btn-quiet:hover { color: var(--ink); background: var(--n-50); }
.ad-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: var(--r-pill);
  border: 1px solid var(--line); background: var(--paper); color: var(--n-600); cursor: pointer; }
.ad-icon-btn:hover { color: var(--ink); border-color: var(--line-strong); }
.ad-spin { animation: adspin 1s linear infinite; }
@keyframes adspin { to { transform: rotate(360deg); } }

/* header */
.ad-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.4rem; }
.ad-eyebrow { font-size: .72rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--accent-600); }
.ad-title { font-family: var(--font-display); font-size: clamp(1.7rem, 4vw, 2.4rem); font-weight: 600; letter-spacing: -.02em; margin: .1rem 0 0; }
.ad-header-r { display: flex; align-items: center; gap: .55rem; flex-wrap: wrap; }
.ad-live-pill { display: inline-flex; align-items: center; gap: .4rem; padding: .4rem .8rem; border-radius: var(--r-pill);
  background: var(--sage-bg); color: var(--sage); font-weight: 650; font-size: .85rem; }
.ad-live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sage); animation: adpulse 1.8s ease-in-out infinite; }
@keyframes adpulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(.7); } }

.ad-banner { background: var(--rose-bg); border: 1px solid var(--line); border-radius: var(--r-md); padding: .8rem 1rem; margin-bottom: 1rem; font-weight: 600; }

/* cards */
.ad-card { background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-md); box-shadow: var(--shadow-sm); padding: 1.15rem 1.25rem; }
.ad-panel-title { font-weight: 700; font-size: 1.02rem; color: var(--ink); margin-bottom: .85rem; display: flex; align-items: baseline; gap: .45rem; }

/* stats */
.ad-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: .85rem; margin-bottom: 1.1rem; }
.ad-stat { background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-md); box-shadow: var(--shadow-sm); padding: 1rem 1.1rem; }
.ad-stat-label { font-size: .78rem; font-weight: 650; color: var(--n-600); letter-spacing: .01em; }
.ad-stat-value { font-family: var(--font-display); font-weight: 700; font-size: clamp(2rem, 3.4vw, 2.7rem); line-height: 1.02; letter-spacing: -.02em; margin: .2rem 0 .1rem; font-variant-numeric: tabular-nums; }
.ad-stat-sub { font-size: .8rem; color: var(--n-600); }

/* charts */
.ad-charts { display: grid; grid-template-columns: 1fr 1fr; gap: .85rem; margin-bottom: 1.1rem; }
.ad-chart-card { display: flex; flex-direction: column; }
.ad-chart { width: 100%; height: 96px; display: block; }
.ad-chart-foot { display: flex; justify-content: space-between; font-size: .74rem; margin-top: .35rem; }

/* two-up */
.ad-two { display: grid; grid-template-columns: 1fr 1fr; gap: .85rem; margin-bottom: 1.1rem; align-items: start; }

/* funnel */
.ad-funnel { display: flex; flex-direction: column; gap: 1rem; }
.ad-funnel-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: .35rem; }
.ad-funnel-label { font-weight: 650; }
.ad-funnel-num { font-weight: 700; font-variant-numeric: tabular-nums; }
.ad-funnel-track { height: 12px; border-radius: var(--r-pill); background: var(--n-50); overflow: hidden; }
.ad-funnel-fill { height: 100%; border-radius: var(--r-pill); background: linear-gradient(90deg, var(--accent-300), var(--accent)); transition: width .5s var(--ease, ease); }
.ad-funnel-conv { font-size: .76rem; color: var(--n-600); margin-top: .3rem; }

/* live feed */
.ad-feed { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.ad-feed-item { display: flex; align-items: center; gap: .55rem; padding: .5rem 0; border-bottom: 1px solid var(--line); }
.ad-feed-item:last-child { border-bottom: none; }
.ad-feed-tight .ad-feed-item { padding: .4rem 0; }
.ad-feed-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent-300); flex: none; }
.ad-feed-text { flex: 1; min-width: 0; font-size: .9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ad-feed-time { flex: none; font-size: .78rem; color: var(--n-600); font-variant-numeric: tabular-nums; }
.ad-livefeed .ad-feed { max-height: 340px; overflow: auto; }

/* users */
.ad-users-head { display: flex; align-items: center; justify-content: space-between; gap: .8rem; flex-wrap: wrap; margin-bottom: .9rem; }
.ad-users-controls { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
.ad-search { display: inline-flex; align-items: center; gap: .45rem; border: 1px solid var(--line-strong); border-radius: var(--r-pill); padding: .4rem .8rem; color: var(--n-600); background: var(--paper); }
.ad-search input { border: none; outline: none; background: transparent; font-family: inherit; font-size: .9rem; color: var(--ink); width: 180px; }
.ad-sort { display: inline-flex; gap: .25rem; background: var(--n-50); border-radius: var(--r-pill); padding: .2rem; }
.ad-sort-btn { border: none; background: transparent; border-radius: var(--r-pill); padding: .38rem .7rem; font-size: .82rem; font-weight: 600; color: var(--n-600); cursor: pointer; font-family: inherit; }
.ad-sort-btn.is-on { background: var(--paper); color: var(--ink); box-shadow: var(--shadow-sm); }

.ad-table-head, .ad-row { display: grid; grid-template-columns: minmax(0, 2.3fr) .9fr 1fr 1.5fr minmax(0, 1.8fr) auto; gap: .7rem; align-items: center; }
.ad-table-head { padding: 0 .6rem .5rem; font-size: .74rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--n-600); border-bottom: 1px solid var(--line); }
.ad-rows { display: flex; flex-direction: column; }
.ad-row { width: 100%; text-align: left; background: transparent; border: none; border-bottom: 1px solid var(--line); padding: .7rem .6rem; cursor: pointer; font-family: inherit; color: var(--ink); transition: background .15s ease; }
.ad-row:hover { background: var(--n-25); }
.ad-row:last-child { border-bottom: none; }
.ad-row-user { display: flex; align-items: center; gap: .6rem; min-width: 0; }
.ad-avatar { width: 36px; height: 36px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-family: var(--font-display); font-size: 1.05rem; }
.ad-avatar-lg { width: 52px; height: 52px; font-size: 1.5rem; }
.ad-row-idwrap { display: flex; flex-direction: column; min-width: 0; }
.ad-row-name { font-weight: 650; }
.ad-cell { font-size: .88rem; }
.ad-eng { display: flex; align-items: center; gap: .5rem; }
.ad-eng-bar { flex: 1; height: 8px; min-width: 40px; border-radius: var(--r-pill); background: var(--n-50); overflow: hidden; }
.ad-eng-bar i { display: block; height: 100%; border-radius: var(--r-pill); }
.ad-eng-num { font-variant-numeric: tabular-nums; font-weight: 700; min-width: 24px; text-align: right; }
.ad-row-chips { display: flex; flex-wrap: wrap; gap: .3rem; }
.ad-mini { font-size: .74rem; font-weight: 600; color: var(--n-700); background: var(--n-50); border-radius: var(--r-pill); padding: .18rem .5rem; white-space: nowrap; }
.ad-row-flags { display: flex; align-items: center; justify-content: flex-end; gap: .4rem; }
.ad-bell { color: var(--accent-600); display: inline-flex; }
.ad-streak-chip { display: inline-flex; align-items: center; gap: .2rem; font-size: .76rem; font-weight: 700; color: var(--accent-600); background: var(--accent-50); border-radius: var(--r-pill); padding: .16rem .45rem; }
.ad-row-caret { color: var(--n-400); }
.ad-m-label { display: none; }
.ad-tag { display: inline-flex; align-items: center; gap: .25rem; font-size: .72rem; font-weight: 700; border-radius: var(--r-pill); padding: .16rem .5rem; }
.ad-tag-inline { flex: none; }
.ad-tag-gold { background: var(--gold-bg); color: var(--gold); }
.ad-tag-sage { background: var(--sage-bg); color: var(--sage); }
.ad-tag-accent { background: var(--accent-50); color: var(--accent-600); }

.ad-empty { padding: 2rem 1rem; text-align: center; color: var(--n-600); font-size: .92rem; }
.ad-empty-sm { padding: 1.2rem .5rem; font-size: .86rem; }

/* drawer */
.ad-drawer-scrim { position: fixed; inset: 0; background: rgba(46, 36, 30, .38); backdrop-filter: blur(2px); z-index: 60; display: flex; justify-content: flex-end; animation: adfade .2s ease; }
@keyframes adfade { from { opacity: 0; } to { opacity: 1; } }
.ad-drawer { width: min(460px, 100%); height: 100%; background: var(--paper); border-left: 1px solid var(--line); box-shadow: var(--shadow-lg); overflow-y: auto; animation: adslide .28s var(--ease, ease); }
@keyframes adslide { from { transform: translateX(24px); opacity: .4; } to { transform: translateX(0); opacity: 1; } }
.ad-drawer-top { display: flex; justify-content: flex-end; padding: 1rem 1rem 0; }
.ad-drawer-state { padding: 3rem 1.5rem; text-align: center; color: var(--n-600); }
.ad-drawer-body { padding: .5rem 1.5rem 2.5rem; }
.ad-drawer-hero { display: flex; gap: .9rem; align-items: center; margin-bottom: 1.2rem; }
.ad-drawer-idwrap { min-width: 0; }
.ad-drawer-name { font-family: var(--font-display); font-size: 1.35rem; font-weight: 600; letter-spacing: -.01em; }
.ad-drawer-tags { display: flex; gap: .35rem; margin-top: .4rem; flex-wrap: wrap; }
.ad-drawer-meta { display: grid; grid-template-columns: 1fr 1fr; gap: .7rem; padding: 1rem; background: var(--n-25); border-radius: var(--r-md); margin-bottom: 1rem; }
.ad-drawer-meta > div { display: flex; flex-direction: column; gap: .1rem; }
.ad-drawer-meta span { font-size: .76rem; }
.ad-drawer-meta b { font-size: 1rem; font-weight: 700; }
.ad-chip-row { display: flex; flex-wrap: wrap; gap: .4rem; margin-bottom: 1rem; }
.ad-chip { font-size: .82rem; font-weight: 600; color: var(--n-700); background: var(--n-50); border-radius: var(--r-pill); padding: .3rem .65rem; }
.ad-chip b { color: var(--ink); }
.ad-drawer-profile { display: flex; flex-wrap: wrap; gap: .8rem; font-size: .85rem; color: var(--n-600); margin-bottom: 1.2rem; }
.ad-drawer-profile b { color: var(--ink); }
.ad-drawer-section { margin-top: 1.3rem; }
.ad-drawer-h { font-size: .8rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--n-600); margin: 0 0 .6rem; }
.ad-goal-list { display: flex; flex-direction: column; gap: .55rem; }
.ad-goal { display: flex; align-items: center; gap: .6rem; }
.ad-goal-main { min-width: 0; }
.ad-goal-title { font-weight: 650; font-size: .92rem; }

/* gate */
.ad-gate { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem; background: radial-gradient(120% 120% at 50% 0%, var(--accent-50), var(--paper) 60%); }
.ad-gate-card { width: min(400px, 100%); background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-lg, 20px); box-shadow: var(--shadow-lg); padding: 2.2rem 1.8rem; display: flex; flex-direction: column; gap: .7rem; text-align: center; }
.ad-gate-badge { width: 48px; height: 48px; border-radius: 50%; background: var(--accent-50); color: var(--accent-600); display: flex; align-items: center; justify-content: center; margin: 0 auto .3rem; }
.ad-gate-title { font-family: var(--font-display); font-size: 1.55rem; font-weight: 600; margin: 0; }
.ad-gate-sub { color: var(--n-600); font-size: .92rem; margin: 0 0 .6rem; }
.ad-field { display: flex; flex-direction: column; gap: .3rem; text-align: left; }
.ad-field span { font-size: .85rem; font-weight: 650; color: var(--ink-2, var(--n-700)); }
.ad-field input { border: 1px solid var(--line-strong); border-radius: var(--r-sm, 10px); padding: .68rem .8rem; font-family: inherit; font-size: .95rem; background: var(--paper); color: var(--ink); outline: none; }
.ad-field input:focus { border-color: var(--accent); }
.ad-gate-err { color: var(--rose); font-size: .85rem; font-weight: 600; }
.ad-gate-back { margin-top: .4rem; color: var(--n-600); font-size: .86rem; text-decoration: none; }
.ad-gate-back:hover { color: var(--accent-600); }

/* loading */
.ad-loading { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 5rem 1rem; color: var(--n-600); }
.ad-spinner { width: 34px; height: 34px; border-radius: 50%; border: 3px solid var(--n-100); border-top-color: var(--accent); animation: adspin .8s linear infinite; }

/* responsive */
@media (max-width: 1000px) {
  .ad-stats { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 820px) {
  .ad-charts, .ad-two { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .ad-table-head { display: none; }
  .ad-col-mid, .ad-col-chips, .ad-col-flags { }
  .ad-row { grid-template-columns: 1fr; gap: .5rem; padding: 1rem .4rem; }
  .ad-cell { display: flex; align-items: center; gap: .5rem; }
  .ad-m-label { display: inline; font-size: .74rem; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: var(--n-600); min-width: 88px; }
  .ad-row-chips { justify-content: flex-start; }
  .ad-row-flags { justify-content: flex-start; }
  .ad-row-caret { display: none; }
  .ad-drawer { width: 100%; border-left: none; }
  .ad-drawer-scrim { justify-content: stretch; }
}
@media (max-width: 480px) {
  .ad-stats { grid-template-columns: 1fr; }
  .ad-search input { width: 130px; }
}
`}</style>
  );
}
