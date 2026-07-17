// The Kindred life store - the single concrete home for a person's whole
// life: who they are (profile), what they are building (goals per domain),
// how they feel (check-ins), what they said (journal), who matters (people),
// what they have done (wins), and what Aria suggested (recs). Local-first,
// persists to localStorage, Supabase-swappable: every function carries a
// `// SUPABASE:` note describing the live equivalent.
import { useEffect, useState } from 'react';
import { track } from './analytics.js';

const LS_KEY = 'kindred_state_v1';   // bump to force a clean reseed

export const DOMAIN_META = {
  faith: { emoji: '🕊️', color: 'var(--sky)', bg: 'var(--sky-bg)' },
  fitness: { emoji: '💪', color: 'var(--accent-600)', bg: 'var(--accent-50)' },
  nutrition: { emoji: '🥗', color: 'var(--sage)', bg: 'var(--sage-bg)' },
  mindset: { emoji: '🧠', color: 'var(--sky)', bg: 'var(--sky-bg)' },
  relationships: { emoji: '🤝', color: 'var(--rose)', bg: 'var(--rose-bg)' },
  family: { emoji: '🏡', color: 'var(--rose)', bg: 'var(--rose-bg)' },
  friendship: { emoji: '🫶', color: 'var(--rose)', bg: 'var(--rose-bg)' },
  romance: { emoji: '❤️', color: 'var(--rose)', bg: 'var(--rose-bg)' },
  career: { emoji: '🧭', color: 'var(--gold)', bg: 'var(--gold-bg)' },
  money: { emoji: '🌱', color: 'var(--sage)', bg: 'var(--sage-bg)' },
  creativity: { emoji: '✍️', color: 'var(--gold)', bg: 'var(--gold-bg)' },
  learning: { emoji: '📚', color: 'var(--sky)', bg: 'var(--sky-bg)' },
  nature: { emoji: '🌲', color: 'var(--sage)', bg: 'var(--sage-bg)' },
  travel: { emoji: '🗺️', color: 'var(--gold)', bg: 'var(--gold-bg)' },
  purpose: { emoji: '⭐', color: 'var(--gold)', bg: 'var(--gold-bg)' },
  recovery: { emoji: '🌅', color: 'var(--accent-600)', bg: 'var(--accent-50)' },
  health: { emoji: '🫀', color: 'var(--accent-600)', bg: 'var(--accent-50)' },
  community: { emoji: '🏘️', color: 'var(--sage)', bg: 'var(--sage-bg)' },
};
// Resolves a domain's look from the fixed set OR a user-created custom domain
// (chess, watching more TV, gardening - anything they said matters). Custom
// domains carry their own emoji/color on the profile so any life goal has a home.
export const domainMeta = (id) => {
  if (DOMAIN_META[id]) return DOMAIN_META[id];
  const custom = ((state && state.profile && state.profile.customDomains) || []).find(d => d.id === id);
  if (custom) return { emoji: custom.emoji || '✨', color: custom.color || 'var(--accent-600)', bg: custom.bg || 'var(--accent-50)' };
  const pd = ((state && state.profile && state.profile.domains) || []).find(d => d.id === id);
  if (pd && pd.emoji) return { emoji: pd.emoji, color: 'var(--accent-600)', bg: 'var(--accent-50)' };
  return { emoji: '✨', color: 'var(--accent-600)', bg: 'var(--accent-50)' };
};

// Faith and values - optional, inclusive, never gated. We ask warmly, store the
// tradition they choose (or "prefer not to say"), and only ever personalize -
// never require, never assume, never preach. Modeled on how the big faith apps
// stay welcoming to everyone (Hallow/Pray are "agnostic to who comes on").
export const FAITH_TRADITIONS = [
  { id: 'christian', label: 'Christian' },
  { id: 'catholic', label: 'Catholic' },
  { id: 'muslim', label: 'Muslim' },
  { id: 'jewish', label: 'Jewish' },
  { id: 'hindu', label: 'Hindu' },
  { id: 'buddhist', label: 'Buddhist' },
  { id: 'spiritual', label: 'Spiritual, not religious' },
  { id: 'seeking', label: 'Still exploring' },
  { id: 'secular', label: 'Not religious' },
  { id: 'private', label: 'Prefer not to say' },
];

// Daily reflective prompts, flavored to a tradition. These are Kindred's own
// gentle prompts (not quoted scripture, so nothing is ever misattributed), warm
// and never preachy. Secular / private get none (returns null).
const FAITH_PROMPTS = {
  christian: [
    'Where could you show a little more grace today - to someone else, or to yourself?',
    'What is one thing you can trust God with today instead of carrying alone?',
    'Who in your life could use an unprompted word of encouragement from you?',
    'What would loving your neighbor look like in one small, concrete act today?',
    'Before the day fills up, what are you genuinely thankful for right now?',
    'Where is a quiet five minutes today you could give to prayer or stillness?',
  ],
  catholic: [
    'A small examen: where did you feel most alive yesterday, and where drained?',
    'What is one thing to offer up today, and one grace to ask for?',
    'Who could you carry in prayer today?',
    'Where can you choose patience over hurry today?',
    'What are you grateful for this morning?',
    'What is one small act of service within reach today?',
  ],
  muslim: [
    'What is one thing you are grateful to have been given today?',
    'Where could a little more patience serve you today?',
    'Who could you show kindness to today without being asked?',
    'What intention do you want to set before the day begins?',
    'Where is a quiet moment today for remembrance or reflection?',
    'What is one small good deed within reach today?',
  ],
  jewish: [
    'What is one thing worthy of a blessing today, big or small?',
    'Where could a small act of repair fit into your day?',
    'Who could you reach out to and strengthen today?',
    'What would bringing a little more calm into today look like?',
    'What are you grateful for this morning?',
    'Where can you choose generosity today?',
  ],
  hindu: [
    'What intention would you like to carry into today?',
    'Where can you act today without clinging to the outcome?',
    'What is one thing you are grateful for this morning?',
    'Where could a few quiet breaths steady you today?',
    'Who could you serve or uplift today?',
    'What would acting from your best self look like in one moment today?',
  ],
  buddhist: [
    'Where can you bring a little more presence to something ordinary today?',
    'What is one thing you can meet with acceptance instead of resistance?',
    'Who could you offer a moment of genuine kindness to today?',
    'Take three slow breaths. What do you notice right now?',
    'What are you grateful for in this moment?',
    'Where could you loosen your grip on something today?',
  ],
  spiritual: [
    'What would feeding your spirit, not just your to-do list, look like today?',
    'Where can you pause and feel connected to something larger today?',
    'What are you grateful for this morning?',
    'Who could you show quiet kindness to today?',
    'Where is a still moment today you could actually take?',
    'What does your gut say you need more of right now?',
  ],
  seeking: [
    'No pressure to have answers. What question about your life is quietly with you today?',
    'What has given you a sense of meaning lately, even in small doses?',
    'What are you grateful for this morning?',
    'Where could a quiet moment of reflection fit today?',
    'Who or what makes you feel most like yourself?',
    'What would tending your inner life look like today?',
  ],
};

// Surprise "sparks" - a variable reward on a fully closed day. Not every time
// (that is the point: unpredictable warmth lands harder than predictable praise).
const SPARKS = [
  'You closed the loop today. Morning, moves, and an honest look back. That is a full day, kept.',
  'Full rings. Days like this are the ones that quietly change everything.',
  'You showed up for your whole day, start to finish. I noticed. Proud of you.',
  'Complete. This is what it looks like when someone actually means it.',
  'That is a whole day, honored. Rest easy tonight - you earned it.',
  'You did the thing most people skip: you finished the day on purpose.',
];

const isoDay = (d) => d.toISOString().slice(0, 10);
const dayIndex = () => {
  const now = new Date();
  return now.getFullYear() * 366 + Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
};

export const TONES = {
  nurturer: { name: 'Nurturer', line: 'gentle, patient, zero pressure' },
  coach: { name: 'Coach', line: 'encouraging, structured, keeps you moving' },
  challenger: { name: 'Challenger', line: 'direct, honest, tough love when you need it' },
};

const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

function blank() {
  return {
    profile: null,     // set by the interview: { name, summary, domains[], customDomains[], faith?, tone, toneWhy, belief, answers[], createdAt, demo? }
    goals: [],         // { id, domainId, title, why, cadence, streak, best, lastDoneAt, status, createdAt }
    checkins: [],      // { id, date, mood 1-5, note } - the MORNING beat
    reflections: [],   // { id, date, rating 1-5, gratitude, note, at } - the EVENING beat
    journal: [],       // { id, at, text, source }
    people: [],        // { id, name, relation, intent, notes, lastTouch }
    wins: [],          // { id, at, title, detail, domainId }
    recs: [],          // { id, kind book|action|practice, title, why, domainId, done, at }
    messages: [],      // Aria thread, persisted so the relationship compounds
    creations: [],     // saved outputs from the feature engine (plans, prayers, scripts...)
    settings: { theme: 'light', voiceOn: false },
  };
}

/* persistence + pub/sub */
let state = load();
const subs = new Set();
function load() {
  try { const raw = localStorage.getItem(LS_KEY); if (raw) return { ...blank(), ...JSON.parse(raw) }; } catch {}
  return blank();
}
function commit(next) {
  state = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  subs.forEach(fn => fn(state));
}
export function resetStore() { try { localStorage.removeItem(LS_KEY); } catch {} state = blank(); subs.forEach(fn => fn(state)); }

/* Sync hooks (used by lib/sync.js for the durable server layer). */
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function snapshot() { return state; }
// Replace local state with a server blob (on sign-in restore). Merges over a
// blank base so older server blobs missing new keys still hydrate cleanly.
export function hydrate(next) { if (next && typeof next === 'object') commit({ ...blank(), ...next }); }
export function exportData() { return JSON.stringify(state, null, 2); }

/* React hook: reactive snapshot of the store */
export function useStore(selector = (s) => s) {
  const [snap, setSnap] = useState(() => selector(state));
  useEffect(() => {
    const fn = (s) => setSnap(selector(s));
    subs.add(fn); fn(state);
    return () => subs.delete(fn);
  }, []); // eslint-disable-line
  return snap;
}

/* ---------------- READ API ---------------- */
export const getProfile = () => state.profile;                       // SUPABASE: from('profiles').select().single()
export const getGoals = () => state.goals;                           // SUPABASE: from('goals').select()
export const getGoal = (id) => state.goals.find(g => g.id === id);
export const getCheckins = () => state.checkins;                     // SUPABASE: from('checkins').select()
export const getTodayCheckin = () => state.checkins.find(c => c.date === todayStr());
export const getJournal = () => state.journal;                       // SUPABASE: from('journal').select().order('at')
export const getPeople = () => state.people;                         // SUPABASE: from('people').select()
export const getPerson = (id) => state.people.find(p => p.id === id);
export const getWins = () => state.wins;                             // SUPABASE: from('wins').select()
export const getRecs = () => state.recs;                             // SUPABASE: from('recommendations').select()
export const getMessages = () => state.messages;
export const getSettings = () => state.settings;

/* Derived reads */
export function goalsForDomain(domainId) { return state.goals.filter(g => g.domainId === domainId); }

export function isGoalDueToday(g) {
  if (g.status !== 'active') return false;
  if (!g.lastDoneAt) return true;
  const last = new Date(g.lastDoneAt);
  const now = new Date();
  if (g.cadence === 'daily') return last.toISOString().slice(0, 10) !== todayStr();
  const weekMs = 7 * 86400000;
  return (now - last) > weekMs - 86400000; // due again near the week mark
}

export function peopleNeedingTouch(days = 14) {
  const cutoff = Date.now() - days * 86400000;
  return state.people.filter(p => !p.lastTouch || new Date(p.lastTouch).getTime() < cutoff);
}

export function moodTrend(n = 7) {
  const recent = [...state.checkins].sort((a, b) => a.date < b.date ? 1 : -1).slice(0, n);
  if (!recent.length) return null;
  const avg = recent.reduce((a, c) => a + c.mood, 0) / recent.length;
  return { avg: Math.round(avg * 10) / 10, count: recent.length, latest: recent[0] };
}

/* The 1-3 moves that matter today, drawn from their real data. */
export function todaysMoves() {
  const moves = [];
  for (const g of state.goals) {
    if (isGoalDueToday(g)) moves.push({ kind: 'goal', id: g.id, label: g.title, sub: g.streak > 0 ? `${g.streak} in a row - keep it alive` : 'a small rep today', to: '/paths' });
    if (moves.length >= 2) break;
  }
  const p = peopleNeedingTouch()[0];
  if (p && moves.length < 3) moves.push({ kind: 'person', id: p.id, label: `Reach out to ${p.name}`, sub: p.lastTouch ? 'it has been a while' : 'you said they matter', to: `/people/${p.id}` });
  if (moves.length < 3) {
    const r = state.recs.find(x => !x.done && x.kind !== 'book');
    if (r) moves.push({ kind: 'rec', id: r.id, label: r.title, sub: 'from Aria, for you', to: '/foryou' });
  }
  return moves.slice(0, 3);
}

/* A line from their own past words (throwback wins + journal). */
export function throwback() {
  const pool = [
    ...state.wins.map(w => ({ at: w.at, text: w.title, kind: 'win' })),
    ...state.journal.filter(j => j.source === 'user' && j.text.length > 20 && j.text.length < 200).map(j => ({ at: j.at, text: j.text, kind: 'journal' })),
  ].filter(x => Date.now() - new Date(x.at).getTime() > 2 * 86400000);
  if (!pool.length) return null;
  const idx = Math.floor(new Date().getDate() % pool.length);
  return pool[idx];
}

/* ---------------- WRITE API (validated writers; return { error } never throw) ---------------- */

// SUPABASE: upsert into profiles
export function completeProfile(profile) {
  if (!profile || !profile.name || !Array.isArray(profile.domains) || !profile.domains.length) {
    return { error: true, message: 'That profile is missing pieces. Try the interview again.' };
  }
  const goals = [];
  for (const d of profile.domains) {
    if (d.firstGoal) {
      goals.push({ id: uid(), domainId: d.id, title: d.firstGoal, why: d.why || '', cadence: 'daily', streak: 0, best: 0, lastDoneAt: null, status: 'active', createdAt: nowIso() });
    }
  }
  // Any domain the interview surfaced that is not one of the fixed set is a
  // custom life area (chess, TV, gardening...). Register its look so it renders.
  const customDomains = (profile.domains || [])
    .filter(d => !DOMAIN_META[d.id])
    .map(d => ({ id: d.id, emoji: d.emoji || '✨', color: 'var(--accent-600)', bg: 'var(--accent-50)' }));
  commit({
    ...state,
    profile: { ...profile, customDomains, createdAt: nowIso() },
    goals: [...state.goals, ...goals],
    wins: [...state.wins, { id: uid(), at: nowIso(), title: 'Met Aria and mapped your life', detail: 'The day this started.', domainId: profile.domains[0]?.id || 'purpose' }],
  });
  track('interview_complete');
  return { profile: state.profile };
}

// SUPABASE: update profiles set tone=...
export function setTone(tone) {
  if (!state.profile) return { error: true, message: 'No profile yet.' };
  if (!TONES[tone]) return { error: true, message: 'Unknown tone.' };
  commit({ ...state, profile: { ...state.profile, tone } });
  return { tone };
}

// SUPABASE: insert into goals
export function addGoal({ title, domainId, why = '', cadence = 'daily' }) {
  if (!title || !title.trim()) return { error: true, message: 'Give the goal a name.' };
  if (!domainId) return { error: true, message: 'Pick a life area for it.' };
  const dup = state.goals.find(g => g.status === 'active' && g.title.toLowerCase() === title.trim().toLowerCase());
  if (dup) return { error: true, message: 'You already have that goal going.' };
  const goal = { id: uid(), domainId, title: title.trim(), why, cadence: cadence === 'weekly' ? 'weekly' : 'daily', streak: 0, best: 0, lastDoneAt: null, status: 'active', createdAt: nowIso() };
  commit({ ...state, goals: [...state.goals, goal] });
  return { goal };
}

// SUPABASE: update goals set streak/lastDoneAt; insert into wins on milestones
// Non-punitive streaks: one missed period does NOT reset a streak to 1. Each
// streak run carries a single "grace" (a streak freeze). Miss one day (or one
// week) and the grace absorbs it so the streak holds; miss again before earning
// it back, or miss by more than the grace window, and it resets kindly. Punitive
// streaks are a documented harm vector and they churn people - this is gentler
// and it retains better.
export function markGoalDone(id) {
  const g = state.goals.find(x => x.id === id);
  if (!g) return { error: true, message: 'That goal is gone.' };
  const today = todayStr();
  if (g.lastDoneAt && g.lastDoneAt.slice(0, 10) === today) return { error: true, message: 'Already counted today. Tomorrow is the next rep.' };

  const onTime = g.cadence === 'daily' ? 1 : 8;   // gap that counts as "kept up"
  const graceWindow = g.cadence === 'daily' ? 2 : 15;   // one missed period is forgivable
  let streak = 1;
  let graceUsedAt = g.graceUsedAt || null;
  let graceApplied = false;

  if (g.lastDoneAt) {
    const gap = Math.floor((new Date(today) - new Date(g.lastDoneAt.slice(0, 10))) / 86400000);
    if (gap <= onTime) {
      streak = g.streak + 1;                        // kept the rhythm
    } else if (gap <= graceWindow && !graceUsedAt) {
      streak = g.streak + 1;                        // one slip, grace absorbs it
      graceUsedAt = today; graceApplied = true;
    } else {
      streak = 1; graceUsedAt = null;               // reset, grace refreshes for the new run
    }
  } else {
    graceUsedAt = null;
  }
  // Earn the grace back after a clean stretch since it was last used.
  if (graceUsedAt && !graceApplied) {
    const sinceGrace = Math.floor((new Date(today) - new Date(graceUsedAt)) / 86400000);
    if (sinceGrace >= (g.cadence === 'daily' ? 7 : 28)) graceUsedAt = null;
  }

  const best = Math.max(streak, g.best || 0);
  const goals = state.goals.map(x => x.id === id ? { ...x, streak, best, lastDoneAt: nowIso(), graceUsedAt } : x);
  let wins = state.wins;
  let milestone = null;
  if ([3, 7, 14, 30, 60, 100].includes(streak)) {
    milestone = streak;
    wins = [...wins, { id: uid(), at: nowIso(), title: `${streak} in a row: ${g.title}`, detail: 'A streak milestone.', domainId: g.domainId }];
  }
  commit({ ...state, goals, wins });
  track('goal_done');
  return { goal: goals.find(x => x.id === id), milestone, graceApplied };
}

// SUPABASE: update goals set status
export function setGoalStatus(id, status) {
  if (!['active', 'paused', 'done'].includes(status)) return { error: true, message: 'Unknown status.' };
  if (!state.goals.find(x => x.id === id)) return { error: true, message: 'That goal is gone.' };
  commit({ ...state, goals: state.goals.map(x => x.id === id ? { ...x, status } : x) });
  return { ok: true };
}

// SUPABASE: insert into checkins (one per day)
export function addCheckin({ mood, note = '' }) {
  const m = Number(mood);
  if (!(m >= 1 && m <= 5)) return { error: true, message: 'Mood is 1 to 5.' };
  const date = todayStr();
  const existing = state.checkins.find(c => c.date === date);
  const checkins = existing
    ? state.checkins.map(c => c.date === date ? { ...c, mood: m, note: note || c.note } : c)
    : [...state.checkins, { id: uid(), date, mood: m, note }];
  commit({ ...state, checkins });
  track('checkin');
  return { checkin: checkins.find(c => c.date === date) };
}

// SUPABASE: insert into journal
export function addJournal(text, source = 'user') {
  if (!text || !text.trim()) return { error: true, message: 'Say something first.' };
  const entry = { id: uid(), at: nowIso(), text: text.trim(), source };
  commit({ ...state, journal: [...state.journal, entry] });
  return { entry };
}

// SUPABASE: insert into people
export function addPerson({ name, relation = '', intent = '', notes = '' }) {
  if (!name || !name.trim()) return { error: true, message: 'Who is this person?' };
  const dup = state.people.find(p => p.name.toLowerCase() === name.trim().toLowerCase());
  if (dup) return { error: true, message: `${dup.name} is already in your people.` };
  const person = { id: uid(), name: name.trim(), relation, intent, notes, lastTouch: null, createdAt: nowIso() };
  commit({ ...state, people: [...state.people, person] });
  return { person };
}

// SUPABASE: update people set lastTouch, append note
export function touchPerson(id, note = '') {
  const p = state.people.find(x => x.id === id);
  if (!p) return { error: true, message: 'That person is gone.' };
  const people = state.people.map(x => x.id === id ? { ...x, lastTouch: nowIso(), notes: note ? (x.notes ? x.notes + '\n' : '') + `${todayStr()}: ${note}` : x.notes } : x);
  commit({ ...state, people });
  return { person: people.find(x => x.id === id) };
}

// SUPABASE: update people
export function updatePerson(id, patch) {
  if (!state.people.find(x => x.id === id)) return { error: true, message: 'That person is gone.' };
  commit({ ...state, people: state.people.map(x => x.id === id ? { ...x, ...patch, id } : x) });
  return { ok: true };
}

// SUPABASE: insert into wins
export function addWin({ title, detail = '', domainId = 'purpose' }) {
  if (!title || !title.trim()) return { error: true, message: 'Name the win.' };
  const win = { id: uid(), at: nowIso(), title: title.trim(), detail, domainId };
  commit({ ...state, wins: [...state.wins, win] });
  return { win };
}

// SUPABASE: insert into recommendations
export function addRec({ kind = 'action', title, why = '', domainId = '' }) {
  if (!title || !title.trim()) return { error: true, message: 'Recommendation needs a title.' };
  if (state.recs.find(r => r.title.toLowerCase() === title.trim().toLowerCase())) return { error: true, message: 'Already on your list.' };
  const rec = { id: uid(), kind, title: title.trim(), why, domainId, done: false, at: nowIso() };
  commit({ ...state, recs: [...state.recs, rec] });
  return { rec };
}

// SUPABASE: update recommendations set done
export function markRecDone(id) {
  const r = state.recs.find(x => x.id === id);
  if (!r) return { error: true, message: 'That one is gone.' };
  commit({ ...state, recs: state.recs.map(x => x.id === id ? { ...x, done: true } : x) });
  return { rec: { ...r, done: true } };
}

// Persist the Aria thread (capped so localStorage stays light).
export function saveMessages(messages) {
  commit({ ...state, messages: messages.slice(-60) });
  return { ok: true };
}

export function saveSettings(patch) {
  commit({ ...state, settings: { ...state.settings, ...patch } });
  return { settings: state.settings };
}

/* ---------------- FAITH + VALUES (optional, inclusive) ---------------- */
export const getFaith = () => (state.profile && state.profile.faith) || null;
// SUPABASE: update profiles set faith = jsonb
export function setFaith({ tradition = '', importance = '', opted = true } = {}) {
  if (!state.profile) return { error: true, message: 'Let us get to know you first.' };
  const faith = { tradition, importance, opted: !!opted, setAt: nowIso() };
  commit({ ...state, profile: { ...state.profile, faith } });
  track('faith_set');
  return { faith };
}
// A daily, tradition-flavored reflection prompt. Only for people who opted in
// and chose a tradition that wants it. Warm, never preachy, never a fake quote.
export function faithReflection() {
  const f = getFaith();
  if (!f || !f.opted || !f.tradition || f.tradition === 'secular' || f.tradition === 'private') return null;
  const lib = FAITH_PROMPTS[f.tradition] || FAITH_PROMPTS.spiritual;
  return { text: lib[dayIndex() % lib.length], tradition: f.tradition };
}

/* ---------------- CUSTOM DOMAINS (any goal gets a home) ---------------- */
// SUPABASE: insert into domains (user-scoped)
export function addCustomDomain({ name, emoji = '✨', color = 'var(--accent-600)', why = '' }) {
  if (!state.profile) return { error: true, message: 'Let us get to know you first.' };
  if (!name || !name.trim()) return { error: true, message: 'Name the area of life.' };
  const clean = name.trim();
  const dup = (state.profile.domains || []).find(d => d.name.toLowerCase() === clean.toLowerCase());
  if (dup) return { domain: dup };
  const id = 'x_' + clean.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 22) + '_' + uid().slice(0, 4);
  const domain = { id, name: clean, why, emoji, custom: true };
  const domains = [...(state.profile.domains || []), domain];
  const customDomains = [...(state.profile.customDomains || []), { id, emoji, color, bg: 'var(--accent-50)' }];
  commit({ ...state, profile: { ...state.profile, domains, customDomains } });
  track('domain_added');
  return { domain };
}

/* ---------------- EVENING REFLECTION (the second daily beat) ---------------- */
export const getReflections = () => state.reflections || [];
export const getTodayReflection = () => (state.reflections || []).find(r => r.date === todayStr());
// SUPABASE: upsert into reflections (one per day)
export function addReflection({ rating, gratitude = '', note = '' }) {
  const m = Number(rating);
  if (!(m >= 1 && m <= 5)) return { error: true, message: 'Rate the day 1 to 5.' };
  const date = todayStr();
  const existing = (state.reflections || []).find(r => r.date === date);
  const reflections = existing
    ? state.reflections.map(r => r.date === date ? { ...r, rating: m, gratitude: gratitude || r.gratitude, note: note || r.note } : r)
    : [...(state.reflections || []), { id: uid(), date, rating: m, gratitude, note, at: nowIso() }];
  commit({ ...state, reflections });
  // Fold gratitude into the journal so the record compounds and Aria can read it back.
  if (!existing && gratitude && gratitude.trim()) addJournal(`Grateful today: ${gratitude.trim()}`, 'reflection');
  track('reflection');
  return { reflection: (state.reflections || []).find(r => r.date === date), first: !existing };
}

// Consecutive days that had a check-in (exported so Today and Growth share one truth).
export function checkinStreak() {
  const days = new Set(state.checkins.map(c => c.date));
  const d = new Date();
  if (!days.has(isoDay(d))) d.setDate(d.getDate() - 1);
  let n = 0; while (days.has(isoDay(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
// Consecutive days closed with an evening reflection.
export function reflectionStreak() {
  const days = new Set((state.reflections || []).map(r => r.date));
  const d = new Date();
  if (!days.has(isoDay(d))) d.setDate(d.getDate() - 1);
  let n = 0; while (days.has(isoDay(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* THE DAILY RITUAL - the addictive core loop. Three rings to close each day:
   Check in (morning mood), Moves (the goals due today), Reflect (evening look
   back). A fully closed day is the streak that compounds. Gentle by design:
   a day with no goals still closes on check-in + reflect. */
export function dayProgress() {
  const t = todayStr();
  const checkedIn = !!getTodayCheckin();
  const active = state.goals.filter(g => g.status === 'active');
  const doneToday = active.filter(g => g.lastDoneAt && g.lastDoneAt.slice(0, 10) === t).length;
  const dueToday = active.filter(isGoalDueToday).length;
  const movesPlanned = doneToday + dueToday;
  const reflected = !!getTodayReflection();
  const movesValue = movesPlanned ? Math.min(1, doneToday / movesPlanned) : (checkedIn ? 1 : 0);
  const rings = [
    { key: 'checkin', label: 'Check in', done: checkedIn, value: checkedIn ? 1 : 0 },
    { key: 'moves', label: 'Moves', done: movesPlanned ? doneToday >= movesPlanned : checkedIn, value: movesValue, sub: movesPlanned ? `${doneToday}/${movesPlanned}` : '' },
    { key: 'reflect', label: 'Reflect', done: reflected, value: reflected ? 1 : 0 },
  ];
  const complete = rings.every(r => r.done);
  const pct = Math.round((rings.reduce((a, r) => a + r.value, 0) / rings.length) * 100);
  return { checkedIn, doneToday, movesPlanned, dueToday, reflected, rings, complete, pct };
}

// The ritual streak: consecutive days that were fully closed (checked in AND
// reflected). This is the number that should feel precious - the "don't break it".
export function ritualStreak() {
  const ci = new Set(state.checkins.map(c => c.date));
  const rf = new Set((state.reflections || []).map(r => r.date));
  const closed = (ds) => ci.has(ds) && rf.has(ds);
  const d = new Date();
  if (!closed(isoDay(d))) d.setDate(d.getDate() - 1); // today still in progress does not break it
  let n = 0; while (closed(isoDay(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// Variable reward: a surprise spark on a closed day, but only sometimes. Pass
// force=true to guarantee one (e.g. the very first fully-closed day).
export function maybeSpark(force = false) {
  if (!force && Math.random() > 0.4) return null;
  return SPARKS[Math.floor(Math.random() * SPARKS.length)];
}

/* ---------------- FEATURE ENGINE ---------------- */
export const getCreations = () => state.creations || [];
export const getCreation = (id) => (state.creations || []).find(c => c.id === id);
// SUPABASE: insert into creations
export function saveCreation({ featureId, title, markdown, inputs = {} }) {
  if (!markdown) return { error: true, message: 'Nothing to save yet.' };
  const creation = { id: uid(), featureId, title, markdown, inputs, at: nowIso() };
  commit({ ...state, creations: [creation, ...(state.creations || [])].slice(0, 200) });
  return { creation };
}
export function deleteCreation(id) {
  commit({ ...state, creations: (state.creations || []).filter(c => c.id !== id) });
  return { ok: true };
}

// A compact life-context string the feature engine sends to Aria so every
// generated plan/prayer/script is personal. Never leaves out the safety framing.
export function buildProfileText() {
  const p = state.profile;
  const lines = [];
  if (p) {
    lines.push(`Name: ${p.name}.`);
    if (p.summary) lines.push(`Who they are: ${p.summary}`);
    if (p.tone && TONES[p.tone]) lines.push(`They respond best to a ${TONES[p.tone].name} coaching tone (${TONES[p.tone].line}).`);
    if (Array.isArray(p.domains) && p.domains.length) lines.push('What matters to them: ' + p.domains.map(d => d.name).join(', ') + '.');
    if (p.faith && p.faith.opted && p.faith.tradition && !['secular', 'private'].includes(p.faith.tradition)) {
      const fl = (FAITH_TRADITIONS.find(t => t.id === p.faith.tradition) || {}).label || p.faith.tradition;
      lines.push(`Faith and values: ${fl}. Honor this gently when it fits, never preach, never assume.`);
    }
  }
  const active = state.goals.filter(g => g.status === 'active');
  if (active.length) lines.push('Current goals: ' + active.slice(0, 8).map(g => `${g.title}${g.streak ? ` (${g.streak} day streak)` : ''}`).join('; ') + '.');
  if (state.people.length) lines.push('People they care about: ' + state.people.slice(0, 8).map(pe => `${pe.name}${pe.relation ? ` (${pe.relation})` : ''}`).join(', ') + '.');
  const mt = moodTrend(5);
  if (mt) lines.push(`Recent mood average: ${mt.avg} out of 5 over ${mt.count} check-ins.`);
  return lines.join('\n');
}

// A real "Life Balance" score derived from actual engagement across their
// domains: are goals active and moving, are check-ins happening, are people
// being tended. Honest, not a vanity number.
export function lifeBalance() {
  const p = state.profile;
  const domains = (p && p.domains) || [];
  const perDomain = domains.map(d => {
    const goals = state.goals.filter(g => g.domainId === d.id && g.status === 'active');
    const streak = goals.reduce((a, g) => a + (g.streak || 0), 0);
    const recent = goals.some(g => g.lastDoneAt && (Date.now() - new Date(g.lastDoneAt).getTime()) < 4 * 86400000);
    // 0-100: having a goal (40) + recent action (35) + streak momentum (up to 25)
    let score = 0;
    if (goals.length) score += 40;
    if (recent) score += 35;
    score += Math.min(25, streak * 3);
    return { id: d.id, name: d.name, score: Math.round(score) };
  });
  const moodMt = moodTrend(7);
  const consistency = perDomain.length ? Math.round(perDomain.reduce((a, x) => a + x.score, 0) / perDomain.length) : 0;
  const overall = Math.round(consistency * 0.7 + (moodMt ? (moodMt.avg / 5) * 100 : 50) * 0.3);
  return { overall, perDomain, mood: moodMt };
}

/* ---------------- DEMO PERSONA ----------------
   Clearly the app's own seeded example (banner shows "demo life"), so the
   home surfaces are alive to explore before someone does the real interview. */
export function loadDemo() {
  const d = (n) => new Date(Date.now() - n * 86400000).toISOString();
  const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const demo = {
    ...blank(),
    profile: {
      demo: true,
      name: 'Jordan',
      summary: 'You are rebuilding, not starting over. The gym is not about the mirror for you, it is about feeling like yourself again after two years that took a lot. You miss your brother more than you say out loud, you have a book outline in a drawer that will not leave you alone, and when you are outside, everything gets quieter. You do not need a new life. You need yours back, one kept promise at a time.',
      domains: [
        { id: 'fitness', name: 'Getting my strength back', why: 'You said you stopped feeling like yourself.', firstGoal: 'Walk 20 minutes before work' },
        { id: 'family', name: 'My brother', why: 'Two years of silence you never wanted.', firstGoal: 'Send Danny one honest text this week' },
        { id: 'creativity', name: 'The book', why: 'The outline in the drawer keeps calling.', firstGoal: 'Write 200 words with morning coffee' },
        { id: 'nature', name: 'Outside time', why: 'It is where your head clears.', firstGoal: 'One trail walk every Saturday' },
      ],
      tone: 'coach',
      toneWhy: 'You move on structure and momentum, so I will keep the next rep in front of you.',
      belief: 'Anyone who keeps a 6 day walking streak through a week like yours is not stuck. You are already moving.',
      faith: { tradition: 'christian', importance: 'It steadies me', opted: true, setAt: d(21) },
      customDomains: [],
      createdAt: d(21),
      answers: [],
    },
    goals: [
      { id: 'g1', domainId: 'fitness', title: 'Walk 20 minutes before work', why: 'Feel like myself again', cadence: 'daily', streak: 6, best: 9, lastDoneAt: d(0.4), status: 'active', createdAt: d(21) },
      { id: 'g2', domainId: 'creativity', title: 'Write 200 words with morning coffee', why: 'The book will not write itself', cadence: 'daily', streak: 2, best: 5, lastDoneAt: d(1.2), status: 'active', createdAt: d(19) },
      { id: 'g3', domainId: 'family', title: 'Send Danny one honest text this week', why: 'Two years is long enough', cadence: 'weekly', streak: 1, best: 1, lastDoneAt: d(5), status: 'active', createdAt: d(14) },
      { id: 'g4', domainId: 'nature', title: 'One trail walk every Saturday', why: 'Where my head clears', cadence: 'weekly', streak: 3, best: 3, lastDoneAt: d(2), status: 'active', createdAt: d(20) },
    ],
    checkins: [
      { id: 'c1', date: day(6), mood: 2, note: 'Rough day at work.' },
      { id: 'c2', date: day(5), mood: 3, note: '' },
      { id: 'c3', date: day(4), mood: 3, note: 'Walk helped.' },
      { id: 'c4', date: day(3), mood: 4, note: 'Wrote 300 words, felt great.' },
      { id: 'c5', date: day(2), mood: 4, note: 'Trail day.' },
      { id: 'c6', date: day(1), mood: 3, note: 'Tired but steady.' },
    ],
    reflections: [
      { id: 'rf1', date: day(4), rating: 4, gratitude: 'The walk cleared my head.', note: 'Kept the promise even when I did not feel it.', at: d(4) },
      { id: 'rf2', date: day(3), rating: 4, gratitude: 'The writing flowed.', note: '', at: d(3) },
      { id: 'rf3', date: day(2), rating: 4, gratitude: 'Trail and quiet.', note: 'Left my phone in the car.', at: d(2) },
      { id: 'rf4', date: day(1), rating: 3, gratitude: 'Small steady day.', note: '', at: d(1) },
    ],
    journal: [
      { id: 'j1', at: d(6), text: 'Almost skipped the walk. Went anyway. That felt like the whole point.', source: 'user' },
      { id: 'j2', at: d(3), text: 'The chapter about the lake house basically wrote itself this morning. I forgot how good this feels.', source: 'user' },
      { id: 'j3', at: d(1), text: 'Saw a picture of Danny at the reunion. I was not there. Next year I will be.', source: 'user' },
    ],
    people: [
      { id: 'p1', name: 'Danny', relation: 'Brother', intent: 'Rebuild what we had before the fight', notes: '', lastTouch: d(5), createdAt: d(14) },
      { id: 'p2', name: 'Mom', relation: 'Mother', intent: 'Call more than I do', notes: 'Sundays are best.', lastTouch: d(3), createdAt: d(14) },
      { id: 'p3', name: 'Sam Ortiz', relation: 'Old friend', intent: 'Reconnect, it has been a year', notes: 'Moved to Denver.', lastTouch: d(30), createdAt: d(12) },
    ],
    wins: [
      { id: 'w1', at: d(21), title: 'Met Aria and mapped your life', detail: 'The day this started.', domainId: 'purpose' },
      { id: 'w2', at: d(12), title: '7 in a row: morning walks', detail: 'A streak milestone.', domainId: 'fitness' },
      { id: 'w3', at: d(5), title: 'Texted Danny first', detail: 'Two years of silence, broken by you.', domainId: 'family' },
      { id: 'w4', at: d(3), title: 'Chapter 3 drafted', detail: '1,100 words in one sitting.', domainId: 'creativity' },
    ],
    recs: [
      { id: 'r1', kind: 'book', title: 'Deep Work by Cal Newport', why: 'Your best writing days are the ones you protect. This is the manual for protecting them.', domainId: 'creativity', done: false, at: d(8) },
      { id: 'r2', kind: 'practice', title: 'Leave your phone home on the Saturday trail walk', why: 'You said outside is where your head clears. Let it.', domainId: 'nature', done: false, at: d(6) },
      { id: 'r3', kind: 'action', title: 'Ask Danny about the lake house', why: 'Shared ground is the easiest bridge.', domainId: 'family', done: true, at: d(5) },
    ],
    messages: [],
    settings: { theme: 'light', voiceOn: false },
  };
  commit(demo);
  return { ok: true };
}
