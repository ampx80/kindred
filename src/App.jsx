import { useEffect, useState, Component, lazy, Suspense } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { Icon } from './components/icons.jsx';
import { useStore, resetStore } from './lib/store.js';
import { applyTheme, useTheme, toggleTheme } from './lib/theme.js';
import { trackPageview } from './lib/track.js';
import AriaDock from './components/AriaDock.jsx';
import NotifyWizard from './components/NotifyWizard.jsx';

const Admin = lazy(() => import('./pages/Admin.jsx'));
const Engines = lazy(() => import('./pages/Engines.jsx'));
const EngineDetail = lazy(() => import('./pages/EngineDetail.jsx'));
import Landing from './pages/Landing.jsx';
import Welcome from './pages/Welcome.jsx';
import Today from './pages/Today.jsx';
import Paths from './pages/Paths.jsx';
import PathDetail from './pages/PathDetail.jsx';
import Journal from './pages/Journal.jsx';
import People from './pages/People.jsx';
import PersonDetail from './pages/PersonDetail.jsx';
import ForYou from './pages/ForYou.jsx';
import Growth from './pages/Growth.jsx';
import Settings from './pages/Settings.jsx';
import Tools from './pages/Tools.jsx';
import ToolPage from './pages/ToolPage.jsx';

const APP_SEGS = new Set(['today', 'paths', 'journal', 'people', 'foryou', 'growth', 'settings', 'tools', 'engines']);

const NAV = [
  { to: '/today', label: 'Today', icon: 'sun' },
  { to: '/engines', label: 'Engines', icon: 'layers' },
  { to: '/paths', label: 'Paths', icon: 'compass' },
  { to: '/tools', label: 'Tools', icon: 'sparkles' },
  { to: '/journal', label: 'Journal', icon: 'book' },
  { to: '/people', label: 'People', icon: 'users' },
  { to: '/foryou', label: 'For you', icon: 'target' },
  { to: '/growth', label: 'Growth', icon: 'trophy' },
];
const TABS = [NAV[0], NAV[1], NAV[2], NAV[3], NAV[7]]; // bottom bar: Today, Engines, Paths, Tools, Growth

function PageSpin() {
  return <div className="col center" style={{ minHeight: '50vh' }}><span className="aria-orb is-thinking" style={{ width: 44, height: 44 }} aria-hidden /></div>;
}

function Rail() {
  const profile = useStore(s => s.profile);
  const theme = useTheme();
  return (
    <aside className="kd-rail">
      <div className="row gap-2" style={{ padding: '1.35rem 1.2rem 1.1rem', alignItems: 'center' }}>
        <span className="aria-orb" style={{ width: 34, height: 34 }} aria-hidden />
        <div className="col" style={{ lineHeight: 1.1 }}>
          <span className="serif" style={{ fontWeight: 700, fontSize: '1.3rem', letterSpacing: '-.01em' }}>Kindred</span>
          <span style={{ fontSize: '.72rem', color: 'var(--n-400)', letterSpacing: '.08em', textTransform: 'uppercase' }}>your life, with company</span>
        </div>
      </div>
      <nav className="col gap-1" style={{ padding: '.4rem .8rem', flex: 1 }}>
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `kd-nav-item${isActive ? ' active' : ''}`}>
            <Icon name={n.icon} size={19} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="col gap-1" style={{ padding: '.9rem .8rem', borderTop: '1px solid var(--line)' }}>
        <NavLink to="/settings" className={({ isActive }) => `kd-nav-item${isActive ? ' active' : ''}`}>
          <Icon name="settings" size={18} />
          <span>Settings</span>
        </NavLink>
        <button className="kd-nav-item" onClick={toggleTheme} style={{ border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          <span>{theme === 'dark' ? 'Morning light' : 'Candlelight'}</span>
        </button>
        {profile && (
          <div className="row gap-2" style={{ padding: '.5rem .8rem .2rem' }}>
            <span className="row center" style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--accent-50)', color: 'var(--accent-700)', fontWeight: 750, fontSize: '.95rem', flex: 'none' }}>
              {profile.name?.[0] || '?'}
            </span>
            <div className="col" style={{ minWidth: 0, lineHeight: 1.2 }}>
              <span className="clip fw-6 t-sm">{profile.name}</span>
              <span className="clip t-xs muted">since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function TabBar({ onMore, moreOpen }) {
  return (
    <nav className="kd-tabbar" aria-label="Main">
      {TABS.map(t => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => `kd-tab${isActive ? ' active' : ''}`}>
          <span className="kd-tab-ic"><Icon name={t.icon} size={20} /></span>
          <span>{t.label}</span>
        </NavLink>
      ))}
      {/* More: the mobile home for everything the desktop rail holds (Journal,
          For you, Settings, theme) which was otherwise unreachable on a phone. */}
      <button type="button" className={`kd-tab kd-tab-more${moreOpen ? ' active' : ''}`} onClick={onMore} aria-label="More" aria-expanded={moreOpen}>
        <span className="kd-tab-ic"><Icon name="menu" size={20} /></span>
        <span>More</span>
      </button>
    </nav>
  );
}

// Mobile "More" bottom sheet. Everything the rail offers on desktop, so nothing
// is dead-ended on a phone: Journal, For you, Settings, theme, profile.
function MoreSheet({ open, onClose }) {
  const profile = useStore(s => s.profile);
  const theme = useTheme();
  const nav = useNavigate();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const go = (to) => { onClose(); nav(to); };
  const items = [
    { to: '/journal', label: 'Journal', icon: 'book', sub: 'Everything you have said, kept' },
    { to: '/foryou', label: 'For you', icon: 'target', sub: "Aria's picks, tuned to you" },
    { to: '/settings', label: 'Settings', icon: 'settings', sub: 'Account, sync, privacy, export' },
  ];
  return (
    <div className="kd-sheet-scrim" onClick={onClose}>
      <div className="kd-sheet" role="dialog" aria-label="More" onClick={(e) => e.stopPropagation()}>
        <div className="kd-sheet-grip" aria-hidden />
        {profile && (
          <div className="row gap-2" style={{ padding: '.2rem .4rem 1rem', alignItems: 'center' }}>
            <span className="row center" style={{ width: 42, height: 42, borderRadius: 999, background: 'var(--accent-50)', color: 'var(--accent-700)', fontWeight: 750, fontSize: '1.15rem', flex: 'none' }}>{profile.name?.[0] || '?'}</span>
            <div className="col" style={{ minWidth: 0, lineHeight: 1.25 }}>
              <span className="fw-7">{profile.name}</span>
              <span className="t-xs muted">with Aria since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        )}
        <div className="col gap-1">
          {items.map(it => (
            <button key={it.to} type="button" className="kd-sheet-item" onClick={() => go(it.to)}>
              <span className="kd-sheet-ic"><Icon name={it.icon} size={20} /></span>
              <span className="col" style={{ minWidth: 0, lineHeight: 1.2, textAlign: 'left' }}>
                <span className="fw-6">{it.label}</span>
                <span className="t-xs muted clip">{it.sub}</span>
              </span>
              <Icon name="chevronRight" size={18} style={{ color: 'var(--n-400)', marginLeft: 'auto' }} />
            </button>
          ))}
          <button type="button" className="kd-sheet-item" onClick={() => { toggleTheme(); }}>
            <span className="kd-sheet-ic"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} /></span>
            <span className="col" style={{ minWidth: 0, lineHeight: 1.2, textAlign: 'left' }}>
              <span className="fw-6">{theme === 'dark' ? 'Morning light' : 'Candlelight'}</span>
              <span className="t-xs muted">Switch the mood</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Catch a render error on any screen and show a warm recovery card instead of a
// blank white page. Keeps a bad tool result or bad data from bricking the app.
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { try { console.error('[kindred]', err); } catch {} }
  render() {
    if (this.state.err) {
      return (
        <div className="col center" style={{ minHeight: '60vh', textAlign: 'center', gap: '1rem', padding: '2rem' }}>
          <span className="aria-orb" style={{ width: 54, height: 54 }} aria-hidden />
          <h2 className="serif" style={{ margin: 0 }}>Something hiccupped.</h2>
          <p className="muted" style={{ maxWidth: 420 }}>This screen ran into a snag, but your life is safe and saved. Let us try again.</p>
          <div className="row gap-2" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => this.setState({ err: null })}>Try again</button>
            <Link className="btn btn-ghost" to="/today" onClick={() => this.setState({ err: null })}>Back to Today</Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function DemoBanner() {
  const profile = useStore(s => s.profile);
  const nav = useNavigate();
  if (!profile?.demo) return null;
  return (
    <div className="row gap-2 wrap" style={{ background: 'var(--gold-bg)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '.7rem 1rem', marginBottom: '1.1rem' }}>
      <span style={{ fontSize: '.95rem' }}><b>You are exploring a demo life</b> (Jordan's). Everything here is example data.</span>
      <span className="spacer" />
      <button className="btn btn-primary btn-sm" onClick={() => { resetStore(); nav('/welcome'); }}>Start your own</button>
    </div>
  );
}

export default function App() {
  const loc = useLocation();
  const profile = useStore(s => s.profile);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => { applyTheme(); }, []);
  useEffect(() => { window.scrollTo(0, 0); setMoreOpen(false); trackPageview(loc.pathname); }, [loc.pathname]);

  const seg = loc.pathname.split('/')[1] || '';
  const inApp = APP_SEGS.has(seg);

  // Owner-only dashboard. Reachable without a local profile (an admin may open it
  // on a fresh device); the server enforces who is actually allowed to see data.
  if (seg === 'admin') {
    return (
      <Suspense fallback={<div className="col center" style={{ minHeight: '60vh' }}><span className="aria-orb" style={{ width: 48, height: 48 }} aria-hidden /></div>}>
        <Admin />
      </Suspense>
    );
  }

  if (!inApp) {
    return (
      <Routes>
        <Route path="/" element={profile ? <Navigate to="/today" replace /> : <Landing />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (!profile) return <Navigate to="/" replace />;

  return (
    <div>
      <div className="ambient" aria-hidden><span className="b1" /><span className="b2" /><span className="b3" /></div>
      <Rail />
      <div className="kd-main">
        <main className="kd-content">
          <DemoBanner />
          <div key={loc.pathname} className="page-in">
            <ErrorBoundary key={loc.pathname}>
            <Routes location={loc}>
              <Route path="/today" element={<Today />} />
              <Route path="/engines" element={<Suspense fallback={<PageSpin />}><Engines /></Suspense>} />
              <Route path="/engines/:id" element={<Suspense fallback={<PageSpin />}><EngineDetail /></Suspense>} />
              <Route path="/engines/:id/:toolId" element={<Suspense fallback={<PageSpin />}><EngineDetail /></Suspense>} />
              <Route path="/paths" element={<Paths />} />
              <Route path="/paths/:id" element={<PathDetail />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/people" element={<People />} />
              <Route path="/people/:id" element={<PersonDetail />} />
              <Route path="/foryou" element={<ForYou />} />
              <Route path="/growth" element={<Growth />} />
              <Route path="/tools" element={<Tools />} />
              <Route path="/tools/saved/:sub" element={<ToolPage />} />
              <Route path="/tools/:id" element={<ToolPage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/today" replace />} />
            </Routes>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <TabBar onMore={() => setMoreOpen(o => !o)} moreOpen={moreOpen} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      <AriaDock />
      <NotifyWizard />
    </div>
  );
}
