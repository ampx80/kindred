// Kindred's engagement engine. It quietly turns every real action in the app
// into progress: XP and levels, a spark currency, daily and weekly quests,
// achievements, a session combo multiplier, streak-freeze tokens, and a daily
// reward. It listens to the telemetry bus (onTrack) so no page has to wire
// anything in, persists to localStorage, and broadcasts "moments" (level up,
// achievement unlocked, quest complete, sparks gained) that the UI celebrates.
import { useSyncExternalStore } from 'react';
import { onTrack } from './track.js';
import {
  XP_RULES, XP_DEFAULT, SPARK_RULES, SPARK_DEFAULT,
  levelForXp, xpForLevel, rankFor,
  DAILY_QUEST_POOL, WEEKLY_QUEST_POOL, ACHIEVEMENTS, REWARDS, pick,
} from './gameContent.js';

const KEY = 'kindred_game_v1';
const COMBO_WINDOW_MS = 90 * 1000;
const COMBO_MAX = 3;

// ---- date helpers ----------------------------------------------------------
function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function weekKey(d = new Date()) {
  const dt = new Date(d);
  const day = (dt.getDay() + 6) % 7; // Monday = 0
  dt.setDate(dt.getDate() - day);
  return dayKey(dt);
}
function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// ---- state -----------------------------------------------------------------
function blank() {
  return {
    xp: 0,
    sparks: 0,
    freezes: 0,
    counts: {},                 // lifetime tally per event name
    achievements: {},           // id -> unlocked ISO
    owned: {},                  // reward id -> true
    quests: null,               // { day, weekK, daily:[], weekly:[] }
    dailyClaimedOn: null,       // dayKey of last daily reward claim
    createdAt: new Date().toISOString(),
  };
}

let state = load();
let combo = { count: 0, at: 0 };   // session only, not persisted

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...blank(), ...JSON.parse(raw) };
  } catch {}
  return blank();
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

// ---- subscription (for useGame) --------------------------------------------
const subs = new Set();
function emit() { for (const fn of subs) { try { fn(); } catch {} } }
function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

// ---- moments (one-shot celebrations) ---------------------------------------
const momentSubs = new Set();
export function onGameMoment(fn) { momentSubs.add(fn); return () => momentSubs.delete(fn); }
function moment(type, data) { for (const fn of momentSubs) { try { fn({ type, ...data }); } catch {} } }

// ---- derived snapshot ------------------------------------------------------
export function snapshot() {
  const level = levelForXp(state.xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const intoLevel = state.xp - base;
  const span = Math.max(1, next - base);
  return {
    xp: state.xp,
    level,
    rank: rankFor(level),
    intoLevel,
    span,
    toNext: Math.max(0, next - state.xp),
    pct: Math.min(1, intoLevel / span),
    sparks: state.sparks,
    freezes: state.freezes,
    combo: comboMultiplier(),
    achievements: state.achievements,
    owned: state.owned,
    counts: state.counts,
    quests: ensureQuests(),
    canClaimDaily: state.dailyClaimedOn !== dayKey(),
  };
}

// keep a stable cached snapshot object for useSyncExternalStore
let snap = snapshot();
function refresh() { snap = snapshot(); emit(); }

export function getGame() { return snap; }
export function useGame() {
  return useSyncExternalStore(subscribe, () => snap, () => snap);
}

// ---- combo -----------------------------------------------------------------
function comboMultiplier() {
  if (!combo.count) return 1;
  if (Date.now() - combo.at > COMBO_WINDOW_MS) return 1;
  return 1 + Math.min(COMBO_MAX - 1, combo.count - 1) * 0.5; // 1x, 1.5x, 2x
}
function bumpCombo() {
  const now = Date.now();
  if (now - combo.at > COMBO_WINDOW_MS) combo = { count: 1, at: now };
  else combo = { count: Math.min(COMBO_MAX, combo.count + 1), at: now };
}
export function comboState() {
  const active = Date.now() - combo.at <= COMBO_WINDOW_MS && combo.count > 1;
  return { count: combo.count, multiplier: comboMultiplier(), active, at: combo.at };
}

// ---- quests ----------------------------------------------------------------
function freshQuestList(pool, count, seedBase) {
  return pick(pool, count, seedBase).map(q => ({ id: q.id, progress: 0, done: false, claimed: false }));
}
function ensureQuests() {
  const dk = dayKey();
  const wk = weekKey();
  if (!state.quests || state.quests.day !== dk || state.quests.weekK !== wk) {
    const prev = state.quests || {};
    state.quests = {
      day: dk,
      weekK: wk,
      daily: (prev.day === dk && prev.daily) ? prev.daily : freshQuestList(DAILY_QUEST_POOL, 3, dayNumber(dk) + 7),
      weekly: (prev.weekK === wk && prev.weekly) ? prev.weekly : freshQuestList(WEEKLY_QUEST_POOL, 3, dayNumber(wk) + 3),
    };
    persist();
  }
  return state.quests;
}
function questDef(id) {
  return DAILY_QUEST_POOL.find(q => q.id === id) || WEEKLY_QUEST_POOL.find(q => q.id === id) || null;
}
function advanceQuests(eventName) {
  const q = ensureQuests();
  let changed = false;
  for (const list of [q.daily, q.weekly]) {
    for (const item of list) {
      const def = questDef(item.id);
      if (!def || item.done || def.event !== eventName) continue;
      item.progress = Math.min(def.target, item.progress + 1);
      if (item.progress >= def.target) { item.done = true; moment('quest', { quest: def }); }
      changed = true;
    }
  }
  if (changed) persist();
}
export function claimQuest(id) {
  const q = ensureQuests();
  const item = [...q.daily, ...q.weekly].find(x => x.id === id);
  const def = questDef(id);
  if (!item || !def || !item.done || item.claimed) return { ok: false };
  item.claimed = true;
  addXpInternal(def.xp || 0, { source: 'quest' });
  state.sparks += (def.sparks || 0);
  persist(); refresh();
  moment('quest_claimed', { quest: def });
  return { ok: true, xp: def.xp, sparks: def.sparks };
}

// ---- xp + level ------------------------------------------------------------
function addXpInternal(amount, meta = {}) {
  if (!amount) return;
  const before = levelForXp(state.xp);
  state.xp += Math.round(amount);
  const after = levelForXp(state.xp);
  if (after > before) {
    moment('levelup', { level: after, rank: rankFor(after), from: before });
    state.sparks += 10 * (after - before); // level-up spark bonus
  }
}
export function awardXp(amount, meta) { addXpInternal(amount, meta); persist(); refresh(); moment('xp', { amount }); }

// ---- sparks + rewards ------------------------------------------------------
export function addSparks(n) { state.sparks = Math.max(0, state.sparks + n); persist(); refresh(); }
export function spendSparks(n) {
  if (state.sparks < n) return false;
  state.sparks -= n; persist(); refresh(); return true;
}
export function ownsReward(id) { return !!state.owned[id]; }
export function buyReward(id) {
  const r = REWARDS.find(x => x.id === id);
  if (!r) return { ok: false, reason: 'not-found' };
  if (!r.repeatable && state.owned[id]) return { ok: false, reason: 'owned' };
  if (state.sparks < r.cost) return { ok: false, reason: 'poor' };
  state.sparks -= r.cost;
  if (r.type === 'freeze') state.freezes += 1;
  else state.owned[id] = true;
  persist(); refresh();
  moment('reward', { reward: r });
  return { ok: true, reward: r };
}

// ---- streak freeze ---------------------------------------------------------
export function grantFreeze(n = 1) { state.freezes += n; persist(); refresh(); }
export function useFreeze() {
  if (state.freezes <= 0) return false;
  state.freezes -= 1; persist(); refresh(); return true;
}

// ---- daily reward ----------------------------------------------------------
const DAILY_TIERS = [
  { sparks: 5, xp: 10 }, { sparks: 6, xp: 12 }, { sparks: 8, xp: 14 },
  { sparks: 10, xp: 18 }, { sparks: 12, xp: 20 }, { sparks: 15, xp: 24 }, { sparks: 20, xp: 30 },
];
export function claimDailyReward() {
  const dk = dayKey();
  if (state.dailyClaimedOn === dk) return { ok: false };
  // Reward scales with a rolling login-day streak stored on the state.
  const last = state._dailyDay || null;
  const consecutive = last && dayNumber(dk) - dayNumber(last) === 1 ? (state._dailyStreak || 0) + 1 : 1;
  state._dailyDay = dk; state._dailyStreak = consecutive;
  const tier = DAILY_TIERS[Math.min(DAILY_TIERS.length - 1, consecutive - 1)];
  state.dailyClaimedOn = dk;
  state.sparks += tier.sparks;
  addXpInternal(tier.xp, { source: 'daily' });
  // Every 7th day, gift a streak freeze.
  const gotFreeze = consecutive % 7 === 0;
  if (gotFreeze) state.freezes += 1;
  persist(); refresh();
  moment('daily', { ...tier, day: consecutive, freeze: gotFreeze });
  return { ok: true, ...tier, day: consecutive, freeze: gotFreeze };
}

// ---- achievements ----------------------------------------------------------
function checkAchievements() {
  const ctx = { counts: state.counts, level: levelForXp(state.xp), sparks: state.sparks, xp: state.xp };
  let unlocked = null;
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id]) continue;
    let ok = false;
    try { ok = !!a.test(ctx); } catch {}
    if (ok) { state.achievements[a.id] = new Date().toISOString(); unlocked = a; moment('achievement', { achievement: a }); }
  }
  if (unlocked) persist();
}

// ---- the event handler -----------------------------------------------------
function handle(name, props) {
  if (!name || name === 'page_view' || name === 'app_open') return;
  // tally
  state.counts[name] = (state.counts[name] || 0) + 1;

  // xp with combo (only "doing" events bump the combo)
  const baseXp = (name in XP_RULES) ? XP_RULES[name] : XP_DEFAULT;
  const doing = baseXp >= 12;
  if (doing) bumpCombo();
  const mult = comboMultiplier();
  addXpInternal(baseXp * (doing ? mult : 1));

  // sparks
  const sp = (name in SPARK_RULES) ? SPARK_RULES[name] : SPARK_DEFAULT;
  if (sp) state.sparks += sp;

  advanceQuests(name);
  checkAchievements();
  persist();
  refresh();
}

let started = false;
export function initGame() {
  if (started || typeof window === 'undefined') return;
  started = true;
  ensureQuests();
  refresh();
  onTrack(handle);
}
