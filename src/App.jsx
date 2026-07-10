import { useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './components/icons.jsx';
import { useStore, resetStore } from './lib/store.js';
import { applyTheme, useTheme, toggleTheme } from './lib/theme.js';
import AriaDock from './components/AriaDock.jsx';
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

const APP_SEGS = new Set(['today', 'paths', 'journal', 'people', 'foryou', 'growth', 'settings']);

const NAV = [
  { to: '/today', label: 'Today', icon: 'sun' },
  { to: '/paths', label: 'Paths', icon: 'compass' },
  { to: '/journal', label: 'Journal', icon: 'book' },
  { to: '/people', label: 'People', icon: 'users' },
  { to: '/foryou', label: 'For you', icon: 'sparkles' },
  { to: '/growth', label: 'Growth', icon: 'trophy' },
];
const TABS = NAV.filter(n => n.to !== '/foryou'); // bottom bar keeps 5; For you lives on Today + rail

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

function TabBar() {
  return (
    <nav className="kd-tabbar" aria-label="Main">
      {TABS.map(t => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => `kd-tab${isActive ? ' active' : ''}`}>
          <span className="kd-tab-ic"><Icon name={t.icon} size={20} /></span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
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

  useEffect(() => { applyTheme(); }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  const seg = loc.pathname.split('/')[1] || '';
  const inApp = APP_SEGS.has(seg);

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
            <Routes location={loc}>
              <Route path="/today" element={<Today />} />
              <Route path="/paths" element={<Paths />} />
              <Route path="/paths/:id" element={<PathDetail />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/people" element={<People />} />
              <Route path="/people/:id" element={<PersonDetail />} />
              <Route path="/foryou" element={<ForYou />} />
              <Route path="/growth" element={<Growth />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/today" replace />} />
            </Routes>
          </div>
        </main>
      </div>
      <TabBar />
      <AriaDock />
    </div>
  );
}
