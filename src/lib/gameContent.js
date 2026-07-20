// The content catalog for Kindred's engagement engine: the level ladder, how
// much XP and how many sparks each real action is worth, the pools daily and
// weekly quests are drawn from, the achievement set, and the spark shop. Pure
// data plus a few tiny helpers, so it is safe to expand without touching the
// engine. The engine (game.js) reads everything from here.

// ---- LEVEL LADDER ----------------------------------------------------------
// Warm rank names that escalate. Level is derived from total XP by the engine.
export const RANKS = [
  'Spark', 'Ember', 'Kindling', 'Glow', 'Flame', 'Beacon', 'Hearth',
  'Lantern', 'Firelight', 'Wildfire', 'Sunrise', 'Aurora', 'Meridian', 'North Star',
];
export function rankFor(level) {
  if (level <= 0) return RANKS[0];
  const idx = Math.min(RANKS.length - 1, Math.floor((level - 1) / 3));
  return RANKS[idx];
}
// Total XP needed to REACH a given level (level 1 = 0). Smooth, ever-steepening.
export function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.round(60 * (level - 1) + 12 * (level - 1) * (level - 1));
}
export function levelForXp(xp) {
  let lvl = 1;
  while (xpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}

// ---- XP + SPARKS PER ACTION ------------------------------------------------
// Keyed by the telemetry event name that fires in the app. Anything not listed
// still earns the small DEFAULT so every action feels rewarded.
export const XP_RULES = {
  today_beat_done: 18,
  checkin: 12,
  mood_checkin: 12,
  goal_done: 20,
  goal_done_tap: 0,          // paired with goal_done; avoid double count
  day_closed: 70,
  journal_saved: 16,
  reflection_saved: 20,
  rec_done: 16,
  rec_accept: 6,
  person_touch: 14,
  engine_activate: 12,
  engine_view: 4,
  feature_generated: 14,
  tool_generated: 14,
  milestone_celebrated: 30,
  quest_claimed: 0,          // reward handled directly
  profile_complete: 120,
};
export const XP_DEFAULT = 6;

export const SPARK_RULES = {
  day_closed: 5,
  goal_done: 2,
  reflection_saved: 2,
  journal_saved: 1,
  milestone_celebrated: 4,
  profile_complete: 15,
};
export const SPARK_DEFAULT = 1;

// ---- QUESTS ----------------------------------------------------------------
// Each quest advances when its `event` fires, up to `target`. Daily quests roll
// over each local day; weekly quests each Monday. The engine picks a handful.
export const DAILY_QUEST_POOL = [
  { id: 'd_checkin', title: 'Check in with yourself', desc: 'Log one mood check-in', icon: 'sun', event: 'checkin', target: 1, xp: 20, sparks: 2 },
  { id: 'd_mood', title: 'Name the feeling', desc: 'Record how you feel today', icon: 'heart', event: 'mood_checkin', target: 1, xp: 18, sparks: 2 },
  { id: 'd_move', title: 'Keep one promise', desc: 'Mark a goal done today', icon: 'check', event: 'goal_done', target: 1, xp: 25, sparks: 2 },
  { id: 'd_two_moves', title: 'Momentum', desc: 'Keep two promises today', icon: 'flame', event: 'goal_done', target: 2, xp: 40, sparks: 4 },
  { id: 'd_three_moves', title: 'On a roll', desc: 'Keep three promises today', icon: 'star', event: 'goal_done', target: 3, xp: 45, sparks: 5 },
  { id: 'd_reflect', title: 'Close the loop', desc: 'Write an evening reflection', icon: 'moon', event: 'reflection_saved', target: 1, xp: 25, sparks: 3 },
  { id: 'd_journal', title: 'One honest line', desc: 'Write a journal entry', icon: 'book', event: 'journal_saved', target: 1, xp: 20, sparks: 2 },
  { id: 'd_journal_two', title: 'Fill the page', desc: 'Write two journal entries', icon: 'book', event: 'journal_saved', target: 2, xp: 38, sparks: 4 },
  { id: 'd_engine', title: 'Go deeper', desc: 'Use one of your engines', icon: 'layers', event: 'feature_generated', target: 1, xp: 25, sparks: 3 },
  { id: 'd_engine_two', title: 'Build the day', desc: 'Use engines twice today', icon: 'sparkles', event: 'feature_generated', target: 2, xp: 42, sparks: 5 },
  { id: 'd_reach', title: 'Reach out', desc: 'Tend one relationship', icon: 'heart', event: 'person_touch', target: 1, xp: 22, sparks: 2 },
  { id: 'd_reach_two', title: 'Keep the thread', desc: 'Tend two relationships', icon: 'users', event: 'person_touch', target: 2, xp: 40, sparks: 4 },
  { id: 'd_pick', title: "Aria's pick", desc: 'Complete one recommendation', icon: 'target', event: 'rec_done', target: 1, xp: 22, sparks: 2 },
  { id: 'd_pick_two', title: 'Trust the nudge', desc: 'Complete two recommendations', icon: 'compass', event: 'rec_done', target: 2, xp: 40, sparks: 4 },
  { id: 'd_close', title: 'Land the day', desc: 'Close your day tonight', icon: 'moon', event: 'day_closed', target: 1, xp: 45, sparks: 5 },
  { id: 'd_mood_reflect', title: 'Feel and record', desc: 'Check your mood and reflect', icon: 'leaf', event: 'reflection_saved', target: 1, xp: 24, sparks: 3 },
];
export const WEEKLY_QUEST_POOL = [
  { id: 'w_close3', title: 'Three full days', desc: 'Close your day 3 times this week', icon: 'trophy', event: 'day_closed', target: 3, xp: 120, sparks: 15 },
  { id: 'w_close5', title: 'Steady hand', desc: 'Close your day 5 times this week', icon: 'sun', event: 'day_closed', target: 5, xp: 150, sparks: 18 },
  { id: 'w_moves10', title: 'Ten promises kept', desc: 'Mark 10 goals done this week', icon: 'check', event: 'goal_done', target: 10, xp: 130, sparks: 15 },
  { id: 'w_moves12', title: 'A dozen kept', desc: 'Mark 12 goals done this week', icon: 'flame', event: 'goal_done', target: 12, xp: 160, sparks: 18 },
  { id: 'w_reflect4', title: 'A reflective week', desc: 'Reflect 4 evenings', icon: 'moon', event: 'reflection_saved', target: 4, xp: 110, sparks: 12 },
  { id: 'w_journal6', title: 'Pages fill up', desc: 'Write 6 journal entries', icon: 'book', event: 'journal_saved', target: 6, xp: 120, sparks: 14 },
  { id: 'w_engines5', title: 'Explorer', desc: 'Use engines 5 times', icon: 'layers', event: 'feature_generated', target: 5, xp: 120, sparks: 14 },
  { id: 'w_people3', title: 'Woven closer', desc: 'Tend 3 relationships', icon: 'users', event: 'person_touch', target: 3, xp: 100, sparks: 12 },
  { id: 'w_recs5', title: 'Followed the map', desc: 'Complete 5 recommendations', icon: 'compass', event: 'rec_done', target: 5, xp: 115, sparks: 13 },
  { id: 'w_checkins6', title: 'Present all week', desc: 'Check in 6 days this week', icon: 'sun', event: 'checkin', target: 6, xp: 125, sparks: 15 },
];

// ---- ACHIEVEMENTS ----------------------------------------------------------
// test(ctx) -> boolean, where ctx = { counts, level, sparks, xp }. counts is a
// map of lifetime event tallies. rarity drives the color and the celebration.
export const RARITY = {
  common: { label: 'Common', color: 'var(--sage)', bg: 'var(--sage-bg)' },
  rare: { label: 'Rare', color: 'var(--sky)', bg: 'var(--sky-bg)' },
  epic: { label: 'Epic', color: 'var(--accent-600)', bg: 'var(--accent-50)' },
  legendary: { label: 'Legendary', color: 'var(--gold)', bg: 'var(--gold-bg)' },
};
export const ACHIEVEMENTS = [
  // ---- Common: easy first steps -------------------------------------------
  { id: 'first_step', name: 'First step', desc: 'Keep your very first promise', icon: 'check', rarity: 'common', test: (c) => (c.counts.goal_done || 0) >= 1 },
  { id: 'first_day', name: 'A day closed', desc: 'Close your first full day', icon: 'sun', rarity: 'common', test: (c) => (c.counts.day_closed || 0) >= 1 },
  { id: 'first_reflect', name: 'Looked back', desc: 'Write your first reflection', icon: 'moon', rarity: 'common', test: (c) => (c.counts.reflection_saved || 0) >= 1 },
  { id: 'first_journal', name: 'First page', desc: 'Write your first journal entry', icon: 'book', rarity: 'common', test: (c) => (c.counts.journal_saved || 0) >= 1 },
  { id: 'first_checkin', name: 'Said hello', desc: 'Log your first check-in', icon: 'sun', rarity: 'common', test: (c) => (c.counts.checkin || 0) >= 1 },
  { id: 'first_reach', name: 'Warm hello', desc: 'Tend your first relationship', icon: 'heart', rarity: 'common', test: (c) => (c.counts.person_touch || 0) >= 1 },
  { id: 'first_engine', name: 'Curious', desc: 'Use an engine for the first time', icon: 'layers', rarity: 'common', test: (c) => (c.counts.feature_generated || 0) >= 1 },
  { id: 'first_rec', name: 'Took the nudge', desc: 'Complete a recommendation', icon: 'target', rarity: 'common', test: (c) => (c.counts.rec_done || 0) >= 1 },
  { id: 'level_2', name: 'Warming up', desc: 'Reach level 2', icon: 'flame', rarity: 'common', test: (c) => c.level >= 2 },
  { id: 'level_3', name: 'Catching fire', desc: 'Reach level 3', icon: 'flame', rarity: 'common', test: (c) => c.level >= 3 },
  { id: 'engines_3', name: 'Equipped', desc: 'Turn on 3 engines', icon: 'layers', rarity: 'common', test: (c) => (c.counts.engine_activate || 0) >= 3 },
  { id: 'moves_5', name: 'Good for it', desc: 'Keep 5 promises', icon: 'check', rarity: 'common', test: (c) => (c.counts.goal_done || 0) >= 5 },
  { id: 'sparks_25', name: 'First sparks', desc: 'Bank 25 sparks', icon: 'sparkles', rarity: 'common', test: (c) => c.sparks >= 25 },

  // ---- Rare: sustained effort ---------------------------------------------
  { id: 'level_5', name: 'Burning bright', desc: 'Reach level 5', icon: 'flame', rarity: 'rare', test: (c) => c.level >= 5 },
  { id: 'moves_25', name: 'Kept your word', desc: 'Keep 25 promises', icon: 'check', rarity: 'rare', test: (c) => (c.counts.goal_done || 0) >= 25 },
  { id: 'days_7', name: 'A whole week', desc: 'Close 7 full days', icon: 'sun', rarity: 'rare', test: (c) => (c.counts.day_closed || 0) >= 7 },
  { id: 'reflect_10', name: 'Examined life', desc: 'Reflect 10 times', icon: 'moon', rarity: 'rare', test: (c) => (c.counts.reflection_saved || 0) >= 10 },
  { id: 'journal_10', name: 'Ink in the well', desc: 'Write 10 journal entries', icon: 'book', rarity: 'rare', test: (c) => (c.counts.journal_saved || 0) >= 10 },
  { id: 'people_5', name: 'Never alone', desc: 'Tend relationships 5 times', icon: 'heart', rarity: 'rare', test: (c) => (c.counts.person_touch || 0) >= 5 },
  { id: 'checkins_14', name: 'Two steady weeks', desc: 'Check in 14 times', icon: 'sun', rarity: 'rare', test: (c) => (c.counts.checkin || 0) >= 14 },
  { id: 'recs_10', name: 'Following the map', desc: 'Complete 10 recommendations', icon: 'compass', rarity: 'rare', test: (c) => (c.counts.rec_done || 0) >= 10 },
  { id: 'engines_10', name: 'Handy', desc: 'Use engines 10 times', icon: 'sparkles', rarity: 'rare', test: (c) => (c.counts.feature_generated || 0) >= 10 },
  { id: 'sparks_100', name: 'Spark hoard', desc: 'Bank 100 sparks', icon: 'sparkles', rarity: 'rare', test: (c) => c.sparks >= 100 },

  // ---- Epic: real commitment ----------------------------------------------
  { id: 'level_10', name: 'Beacon', desc: 'Reach level 10', icon: 'trophy', rarity: 'epic', test: (c) => c.level >= 10 },
  { id: 'level_15', name: 'Lighthouse', desc: 'Reach level 15', icon: 'star', rarity: 'epic', test: (c) => c.level >= 15 },
  { id: 'moves_50', name: 'Reliable', desc: 'Keep 50 promises', icon: 'check', rarity: 'epic', test: (c) => (c.counts.goal_done || 0) >= 50 },
  { id: 'days_14', name: 'Fortnight', desc: 'Close 14 full days', icon: 'sun', rarity: 'epic', test: (c) => (c.counts.day_closed || 0) >= 14 },
  { id: 'reflect_30', name: 'Deeply known', desc: 'Reflect 30 times', icon: 'moon', rarity: 'epic', test: (c) => (c.counts.reflection_saved || 0) >= 30 },
  { id: 'journal_30', name: 'A quiet library', desc: 'Write 30 journal entries', icon: 'book', rarity: 'epic', test: (c) => (c.counts.journal_saved || 0) >= 30 },
  { id: 'engine_power', name: 'Power user', desc: 'Use engines 20 times', icon: 'sparkles', rarity: 'epic', test: (c) => (c.counts.feature_generated || 0) >= 20 },
  { id: 'people_20', name: 'Well woven', desc: 'Tend relationships 20 times', icon: 'users', rarity: 'epic', test: (c) => (c.counts.person_touch || 0) >= 20 },
  { id: 'recs_25', name: 'True north', desc: 'Complete 25 recommendations', icon: 'compass', rarity: 'epic', test: (c) => (c.counts.rec_done || 0) >= 25 },
  { id: 'sparks_300', name: 'Rich in light', desc: 'Bank 300 sparks', icon: 'sparkles', rarity: 'epic', test: (c) => c.sparks >= 300 },

  // ---- Legendary: rare devotion -------------------------------------------
  { id: 'level_20', name: 'Aurora', desc: 'Reach level 20', icon: 'star', rarity: 'legendary', test: (c) => c.level >= 20 },
  { id: 'level_25', name: 'North star', desc: 'Reach level 25', icon: 'trophy', rarity: 'legendary', test: (c) => c.level >= 25 },
  { id: 'moves_100', name: 'Unstoppable', desc: 'Keep 100 promises', icon: 'trophy', rarity: 'legendary', test: (c) => (c.counts.goal_done || 0) >= 100 },
  { id: 'days_30', name: 'A month of showing up', desc: 'Close 30 full days', icon: 'trophy', rarity: 'legendary', test: (c) => (c.counts.day_closed || 0) >= 30 },
  { id: 'days_100', name: 'A hundred sunsets', desc: 'Close 100 full days', icon: 'sun', rarity: 'legendary', test: (c) => (c.counts.day_closed || 0) >= 100 },
  { id: 'reflect_100', name: 'Fully examined', desc: 'Reflect 100 times', icon: 'moon', rarity: 'legendary', test: (c) => (c.counts.reflection_saved || 0) >= 100 },
  { id: 'devoted', name: 'Devoted', desc: 'Reach level 20 and bank 500 sparks', icon: 'star', rarity: 'legendary', test: (c) => c.level >= 20 && c.sparks >= 500 },
];

// ---- SPARK SHOP ------------------------------------------------------------
// Cosmetic and utility unlocks bought with sparks. type drives what the owning
// UI does with it; the engine only tracks ownership and balance.
export const REWARDS = [
  { id: 'freeze_1', name: 'Streak freeze', desc: 'Protect your streak for one missed day', icon: 'sparkles', cost: 40, type: 'freeze', repeatable: true },
  { id: 'theme_dusk', name: 'Dusk theme', desc: 'A deep, calm evening palette', icon: 'moon', cost: 120, type: 'theme' },
  { id: 'theme_forest', name: 'Forest theme', desc: 'Grounded greens for focus', icon: 'leaf', cost: 120, type: 'theme' },
  { id: 'theme_sunrise', name: 'Sunrise theme', desc: 'Soft warmth for early mornings', icon: 'sun', cost: 140, type: 'theme' },
  { id: 'theme_starlit', name: 'Starlit theme', desc: 'Quiet indigo with a scatter of light', icon: 'star', cost: 160, type: 'theme' },
  { id: 'theme_hearth', name: 'Hearth theme', desc: 'Firelit ambers that feel like home', icon: 'flame', cost: 160, type: 'theme' },
  { id: 'aria_warm', name: 'Warmer Aria voice', desc: 'A softer voice for Aria', icon: 'heart', cost: 150, type: 'aria-voice' },
  { id: 'aria_calm', name: 'Calm Aria voice', desc: 'A slower, steadier tone for Aria', icon: 'leaf', cost: 170, type: 'aria-voice' },
  { id: 'aria_bright', name: 'Bright Aria voice', desc: 'A lighter, brighter tone for Aria', icon: 'sun', cost: 170, type: 'aria-voice' },
  { id: 'badge_founder', name: 'Founder badge', desc: 'A mark for the early days', icon: 'trophy', cost: 200, type: 'badge' },
  { id: 'badge_devoted', name: 'Devoted badge', desc: 'For showing up, again and again', icon: 'star', cost: 250, type: 'badge' },
  { id: 'badge_kindred', name: 'Kindred badge', desc: 'A quiet mark of belonging', icon: 'users', cost: 300, type: 'badge' },
  { id: 'badge_ember', name: 'Ember badge', desc: 'A small glow you carry with you', icon: 'flame', cost: 90, type: 'badge' },
  { id: 'badge_compass', name: 'Wayfinder badge', desc: 'For trusting the nudge and moving', icon: 'compass', cost: 110, type: 'badge' },
];

export function pick(arr, n, seed) {
  // Deterministic pick of n items from arr using a numeric seed (so a day's
  // quests are stable but rotate across days).
  const out = [];
  const pool = arr.slice();
  let s = seed || 1;
  while (out.length < Math.min(n, pool.length)) {
    s = (s * 9301 + 49297) % 233280;
    const idx = Math.floor((s / 233280) * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
