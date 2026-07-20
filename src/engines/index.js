// The Life Engine registry. Engines are deep, domain-specific modules Aria uses
// to equip a person for their actual life: Scripture and prayer for the faithful,
// programmed training for the athlete, a reading engine for the reader, role
// insight for the professional, and many more. A person runs several at once.
//
// AUTO-DISCOVERY: every file in ./defs/*.{js,jsx} that default-exports an engine
// definition is registered automatically. This lets many engines be built in
// parallel with zero edits to this file (no merge conflicts, nothing to wire).
//
// ENGINE DEFINITION SHAPE (default export of each def file):
//   {
//     id: 'faith',                      // unique, url-safe
//     name: 'Faith and Scripture',
//     tagline: 'Walk the day with Scripture, prayer, and quiet strength.',
//     emoji: '\u{1F54A}',
//     color: 'var(--sky)', bg: 'var(--sky-bg)',
//     keywords: ['faith','bible','prayer',...],   // for matching to a profile
//     domains: ['faith','purpose'],               // domain ids this maps to
//     match?: (profile, ctx) => number,           // optional 0..1 override score
//     blurb?: 'longer description',
//     tools: [
//       { id, name, desc, icon,
//         feature?: {...FeatureRunner config...},  // a generative tool
//         Component?: ReactComponent,              // a bespoke content tool
//       }, ...
//     ],
//     Home?: ReactComponent,             // optional custom engine landing
//     daily?: (ctx) => ({ title, body, cta?, toolId? }),  // "walk through the day"
//     ariaContext?: (profile) => string, // extra context for Aria
//   }

const modules = import.meta.glob('./defs/*.{js,jsx}', { eager: true });

function coerce(mod) {
  const e = mod && (mod.default || mod.engine);
  if (!e || !e.id || !e.name) return null;
  return {
    tools: [],
    keywords: [],
    domains: [],
    emoji: '\u2728',
    color: 'var(--accent-600)',
    bg: 'var(--accent-50)',
    ...e,
  };
}

export const ALL_ENGINES = Object.values(modules)
  .map(coerce)
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

export const getEngine = (id) => ALL_ENGINES.find(e => e.id === id) || null;
export const getTool = (engineId, toolId) => {
  const e = getEngine(engineId);
  return e ? (e.tools || []).find(t => t.id === toolId) || null : null;
};

// Build a lowercase haystack of everything we know about a person.
function profileHaystack(profile) {
  if (!profile) return '';
  const parts = [profile.name, profile.summary, profile.belief];
  if (Array.isArray(profile.domains)) for (const d of profile.domains) { parts.push(d.name, d.id, d.firstGoal, d.why); }
  if (profile.faith && profile.faith.tradition) parts.push('faith spiritual ' + profile.faith.tradition);
  return parts.filter(Boolean).join(' ').toLowerCase();
}

// Score one engine against a profile (0..1). Uses an optional match() override,
// then keyword hits, domain overlap, and goal-title hits.
export function scoreEngine(engine, profile, goals = []) {
  if (typeof engine.match === 'function') {
    try { const s = engine.match(profile, { goals }); if (typeof s === 'number') return Math.max(0, Math.min(1, s)); } catch {}
  }
  const hay = profileHaystack(profile) + ' ' + goals.map(g => (g.title || '') + ' ' + (g.why || '')).join(' ').toLowerCase();
  let score = 0;
  const kw = engine.keywords || [];
  let hits = 0;
  for (const k of kw) { if (k && hay.includes(String(k).toLowerCase())) hits++; }
  if (kw.length) score += Math.min(0.7, hits * 0.18);
  const domainIds = (profile && Array.isArray(profile.domains)) ? profile.domains.map(d => d.id) : [];
  const dOverlap = (engine.domains || []).filter(d => domainIds.includes(d)).length;
  if (dOverlap) score += Math.min(0.4, dOverlap * 0.2);
  return Math.max(0, Math.min(1, score));
}

// Ranked engines for a profile: [{ engine, score }], best first.
export function matchEngines(profile, goals = []) {
  return ALL_ENGINES
    .map(engine => ({ engine, score: scoreEngine(engine, profile, goals) }))
    .sort((a, b) => b.score - a.score);
}

// The engines we would auto-suggest turning on (a decent fit), best first.
export function suggestedEngines(profile, goals = [], min = 0.25) {
  return matchEngines(profile, goals).filter(x => x.score >= min).map(x => x.engine);
}
