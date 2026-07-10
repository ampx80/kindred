// Settings - the trust and account home. Sign in to make your life durable and
// cross-device; control Aria's voice and daily nudges; see plainly what Aria has
// inferred about you (the mental-privacy view); export everything; or erase it
// all. Warm, calm, honest - the surfaces that earn the right to hold a life.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Field, Input, SectionHeader, useToast } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { useStore, getProfile, saveSettings, resetStore, exportData, domainMeta, TONES } from '../lib/store.js';
import { onAccount, getAccount, signup, login, logout, forgetAccountLocal, authHeader } from '../lib/account.js';
import { enablePush, disablePush, pushSupported, notificationPermission } from '../lib/push.js';
import { speak, speechAvailable } from '../lib/voice.js';
import { sharePortrait } from '../lib/share.js';
import { summary as analyticsSummary } from '../lib/analytics.js';

function AuthCard({ account }) {
  const toast = useToast();
  const [mode, setMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (account) {
    return (
      <Card pad={22}>
        <div className="row between wrap gap-2">
          <div className="col" style={{ gap: '.2rem', minWidth: 0 }}>
            <span className="fw-7" style={{ fontSize: '1.1rem' }}>Signed in</span>
            <span className="muted clip">{account.email}</span>
            <span className="t-sm" style={{ color: 'var(--sage)' }}>Your life is saved and syncs across devices.</span>
          </div>
          <Button variant="quiet" onClick={() => { logout(); toast('Signed out on this device. Your data stays safe.', 'ok'); }}>Sign out</Button>
        </div>
      </Card>
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'signup') await signup(email.trim(), password);
      else await login(email.trim(), password);
      toast(mode === 'signup' ? 'Account created. Your life is durable now.' : 'Welcome back.', 'ok');
      setPassword('');
    } catch (e) {
      toast(e.message || 'That did not work.', 'risk');
    } finally { setBusy(false); }
  };

  return (
    <Card pad={22}>
      <div className="col" style={{ gap: '.35rem', marginBottom: '1rem' }}>
        <span className="fw-7" style={{ fontSize: '1.15rem' }}>Make it yours, keep it forever</span>
        <span className="muted t-sm">Right now your life lives only in this browser. Create an account and it is saved, backed up, and there on every device. No spam, just your data kept safe.</span>
      </div>
      <div className="col gap-2">
        <Field label="Email">
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="a private password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
        </Field>
        <div className="row gap-2 wrap" style={{ marginTop: '.3rem' }}>
          <Button variant="primary" onClick={submit} disabled={busy || !email || password.length < 8}>
            {busy ? 'One sec...' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </Button>
          <button className="linkish" onClick={() => setMode(m => m === 'signup' ? 'login' : 'signup')} style={{ background: 'none', border: 'none', color: 'var(--accent-700)', cursor: 'pointer', fontSize: '.95rem' }}>
            {mode === 'signup' ? 'I already have an account' : 'I need an account'}
          </button>
        </div>
      </div>
    </Card>
  );
}

export default function Settings() {
  const profile = useStore(s => s.profile);
  const settings = useStore(s => s.settings);
  const nav = useNavigate();
  const toast = useToast();
  const [account, setAccount] = useState(getAccount());
  const [pushOn, setPushOn] = useState(notificationPermission() === 'granted');
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => onAccount(setAccount), []);

  const stats = analyticsSummary();

  const toggleVoice = () => {
    const next = !settings.voiceOn;
    saveSettings({ voiceOn: next });
    if (next && speechAvailable()) speak(`Hi ${profile?.name || 'there'}. This is my voice. I am glad to be here with you.`);
  };

  const toggleNudge = async () => {
    if (pushOn) { await disablePush(); setPushOn(false); toast('Daily nudges off.', 'ok'); return; }
    if (!pushSupported()) { toast('Notifications are not available here. On iPhone, add Kindred to your home screen first.', 'warn'); return; }
    const r = await enablePush();
    if (r.ok) { setPushOn(true); toast('Aria will send one warm nudge a day.', 'ok'); }
    else if (r.reason === 'denied') toast('Notifications are blocked in your browser settings.', 'warn');
    else toast('Could not turn on nudges here.', 'warn');
  };

  const doExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `kindred-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Your full record downloaded.', 'ok');
  };

  const doWipe = async () => {
    if (account) {
      try { await fetch('/api/state', { method: 'DELETE', headers: { ...authHeader() } }); } catch {}
      forgetAccountLocal();
    }
    resetStore();
    toast('Everything erased. A clean slate.', 'ok');
    setConfirmWipe(false);
    nav('/');
  };

  const doShare = async () => {
    if (!profile) return;
    const r = await sharePortrait(profile);
    if (r.downloaded) toast('Your portrait downloaded, ready to share.', 'ok');
  };

  const tone = profile?.tone && TONES[profile.tone];

  return (
    <div className="stack-lg" style={{ maxWidth: 760 }}>
      <SectionHeader eyebrow="Settings" title="You, in control" sub="Your account, your voice, your data. Nothing here is out of your hands." />

      <AuthCard account={account} />

      {/* Aria's voice + daily nudge */}
      <Card pad={22}>
        <div className="col gap-3">
          <div className="row between gap-2">
            <div className="col" style={{ gap: '.15rem', minWidth: 0 }}>
              <span className="fw-7 row gap-1" style={{ fontSize: '1.05rem' }}><Icon name="volume" size={18} /> Aria's voice</span>
              <span className="muted t-sm">Let Aria read her daily message and replies aloud.</span>
            </div>
            <button className={`kd-switch${settings.voiceOn ? ' on' : ''}`} onClick={toggleVoice} aria-pressed={settings.voiceOn} aria-label="Toggle Aria voice"><span /></button>
          </div>
          <div className="row between gap-2" style={{ borderTop: '1px solid var(--line)', paddingTop: '.9rem' }}>
            <div className="col" style={{ gap: '.15rem', minWidth: 0 }}>
              <span className="fw-7 row gap-1" style={{ fontSize: '1.05rem' }}><Icon name="heart" size={18} /> One daily nudge</span>
              <span className="muted t-sm">A single warm reminder a day. Never a nag, off anytime.</span>
            </div>
            <button className={`kd-switch${pushOn ? ' on' : ''}`} onClick={toggleNudge} aria-pressed={pushOn} aria-label="Toggle daily nudge"><span /></button>
          </div>
        </div>
      </Card>

      {/* What Aria has inferred - the mental-privacy view */}
      {profile && (
        <Card pad={22}>
          <div className="col gap-2">
            <span className="fw-7 row gap-1" style={{ fontSize: '1.05rem' }}><Icon name="sparkles" size={18} /> What Aria understands about you</span>
            <span className="muted t-sm">Everything Aria works from is here, in plain sight. It is yours. Nothing about you is hidden from you or sold.</span>
            <p style={{ margin: '.4rem 0 0', lineHeight: 1.6 }}>{profile.summary}</p>
            <div className="row wrap gap-1" style={{ marginTop: '.3rem' }}>
              {(profile.domains || []).map(d => (
                <span key={d.id} className="chip" style={{ background: domainMeta(d.id).bg, color: domainMeta(d.id).color }}>{domainMeta(d.id).emoji} {d.name}</span>
              ))}
            </div>
            {tone && (
              <div className="row gap-2" style={{ marginTop: '.5rem', padding: '.7rem .9rem', background: 'var(--accent-50)', borderRadius: 'var(--r-md)' }}>
                <div className="col" style={{ gap: '.1rem' }}>
                  <span className="fw-6">Aria coaches you as a {tone.name}</span>
                  <span className="t-sm muted">{profile.toneWhy || tone.line}. Aria read this from how you answered, and you can change it in chat any time.</span>
                </div>
              </div>
            )}
            <Button variant="ghost" onClick={doShare} style={{ marginTop: '.6rem', alignSelf: 'flex-start' }}><Icon name="send" size={16} /> Share your portrait</Button>
          </div>
        </Card>
      )}

      {/* Consistency (local analytics) */}
      <Card pad={22}>
        <div className="col gap-2">
          <span className="fw-7" style={{ fontSize: '1.05rem' }}>Your consistency</span>
          <span className="muted t-sm">Counted only on this device, never uploaded.</span>
          <div className="row gap-3 wrap" style={{ marginTop: '.3rem' }}>
            <div className="col"><span className="stat-value" style={{ fontSize: '2rem' }}>{stats.activeDays}</span><span className="t-sm muted">days with Kindred</span></div>
            <div className="col"><span className="stat-value" style={{ fontSize: '2rem' }}>{stats.returnedD1 ? 'Yes' : '-'}</span><span className="t-sm muted">came back next day</span></div>
            <div className="col"><span className="stat-value" style={{ fontSize: '2rem' }}>{stats.counts?.goal_done || 0}</span><span className="t-sm muted">reps logged</span></div>
          </div>
        </div>
      </Card>

      {/* Your data */}
      <Card pad={22}>
        <div className="col gap-3">
          <span className="fw-7" style={{ fontSize: '1.05rem' }}>Your data</span>
          <div className="row between wrap gap-2">
            <span className="muted t-sm" style={{ maxWidth: 420 }}>Download everything Kindred holds about you as a single file.</span>
            <Button variant="ghost" onClick={doExport}><Icon name="book" size={16} /> Export my data</Button>
          </div>
          <div className="row between wrap gap-2" style={{ borderTop: '1px solid var(--line)', paddingTop: '.9rem' }}>
            <span className="muted t-sm" style={{ maxWidth: 420 }}>Erase your whole record, on this device and on our servers. This cannot be undone.</span>
            {!confirmWipe
              ? <Button variant="quiet" onClick={() => setConfirmWipe(true)} style={{ color: 'var(--rose)' }}><Icon name="x" size={16} /> Erase everything</Button>
              : <div className="row gap-2"><Button variant="quiet" onClick={() => setConfirmWipe(false)}>Keep it</Button><Button variant="primary" onClick={doWipe} style={{ background: 'var(--rose)' }}>Yes, erase it all</Button></div>}
          </div>
        </div>
      </Card>

      <p className="muted t-sm" style={{ textAlign: 'center', padding: '0 1rem' }}>
        Aria is an AI companion, not a person or a licensed professional. Kindred supports your wellbeing but does not diagnose or treat. If you are struggling, tap the heart in the Aria panel for real help.
      </p>
    </div>
  );
}
