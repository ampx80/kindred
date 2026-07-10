# Kindred - What We Are Missing, and the Plan to Fix It

Deep-dive synthesis (2026-07-10). Sources: a deep-research pass (competitive
landscape, retention, monetization, regulation, web-vs-native, SEO viability)
plus build-level facts about our own v1. The research run got throttled mid
verification, so most external stats are DIRECTIONAL (single-source, reputable
but unadjudicated); the regulatory finding is HARD-CONFIRMED against primary
bill records. Confidence is tagged per item. No em-dash / en-dash anywhere.

--------------------------------------------------------------------------------

## The one-line verdict

v1 is a beautiful demo of the right idea. To become a category winner it has to
stop being a single-browser toy and become a system someone can trust with
their actual life: it must remember them across devices, be allowed to reach
them, be safe and legal to talk to, and eventually be paid for. The magic
(the adaptive interview) is proven; the foundation under it is not built yet.

--------------------------------------------------------------------------------

## Ranked list of what Kindred is missing (most existential first)

1. **Durable identity + cross-device persistence. EXISTENTIAL.**
   The entire moat is "the compounding life record that makes Aria know you
   forever." That record lives in one browser's localStorage. Clear the cache,
   switch phones, or lose the laptop and a person's whole life in the app is
   gone, with no account to restore it. You cannot sell "your partner through
   everything" on storage that evaporates. This is the single highest-risk gap
   and nothing else matters if it is not fixed. (Build fact, not research.)

2. **Safety + legal compliance. WAS P0 - v1 SHIPPED 2026-07-10.**
   CONFIRMED: New York's AI Companion Models law (GBL Article 47, in force Nov
   2025) and California SB 243 (in force Jan 2026) both cover a persistent,
   memory-grounded companion like Aria, have no small-business exemption, and
   carry AG enforcement up to $15,000/day. They require nonhuman disclosure and
   a crisis-detection + hotline-referral protocol. The APA health advisory sets
   the same baselines (AI disclaimers, self-harm interruption, 988 escalation)
   and warns that sycophancy + persistent memory can create dependency. We
   shipped crisis detection (deterministic + model), 988/741741/911 resources,
   AI disclosure at onboarding + in the dock + a 3h re-disclosure, and
   anti-sycophancy/anti-dependency prompt hardening. See "What shipped" below.
   Remaining: legal review for the exact jurisdictions we serve, minor
   handling, and watching the FTC 6(b) companion inquiry + new state laws.

3. **No way to reach the user (no push / notifications).**
   A daily companion that cannot knock on the door is fighting one-handed. The
   whole "motivates them every day" promise depends on a channel we do not
   have. Web push works now on Android and on iOS 16.4+ when the PWA is added
   to the home screen. Without it, day-2 return depends entirely on the user
   remembering us. (Sub-question the research could not adjudicate; treat push
   as necessary-but-unproven-magnitude. It is cheap enough to just build.)

4. **No accounts / auth.**
   No email or identity means: cannot return on another device, cannot capture
   a signup, cannot ever charge, cannot recover data. Blocks items 1, 3, and 5
   simultaneously. Should ship together with persistence.

5. **No monetization path.**
   DIRECTIONAL (RevenueCat + Adapty, converging): 82-90% of trial starts happen
   on day 0, onboarding-placed paywalls convert best, hard paywalls beat
   freemium ~5-6x, and Health & Fitness is the best-monetizing category with
   annual plans dominating (~61% of revenue) and high-priced annual plans
   worth ~4x cheap ones. Kindred's "this is you" profile reveal is the single
   highest-intent moment we will ever get, and right now it monetizes nothing.
   Validation: Tolan (same personality-interview-to-companion mechanic, paid,
   non-romantic) reportedly hit ~$12M ARR in months (company-reported).

6. **Sycophancy + dependency calibration. v1 STARTED 2026-07-10.**
   DIRECTIONAL: a controlled study found LOW-sycophancy companions retain
   BETTER and improve wellbeing, contradicting the "flattery retains" instinct;
   a 39-study PRISMA review catalogs five real harm vectors (dependence,
   displacement of human relationships, addiction/compulsivity, privacy
   exploitation, commercial persuasion). Our streaks, quiet-counters, and
   always-docked chat sit directly on those vectors. We hardened the prompts
   today; the deeper work (non-punitive streak design, usage-awareness nudges,
   leaning the People feature toward real human reconnection) is Phase 3.

7. **Growth thesis risk: mass programmatic SEO in wellness is now a trap.**
   The research could not adjudicate this, but the direction is clear and it
   cuts AGAINST the current plan: wellness/nutrition is YMYL (the harshest
   E-E-A-T scrutiny), Google's scaled-content-abuse policy now targets exactly
   "tens of thousands of programmatic pages," and AI Overviews are eating
   informational search traffic. 10k-50k thin generated pages is a high-odds
   path to a penalty AND to building for a traffic source that is shrinking.
   The growth budget should move (see Phase 4). This is a strategy correction,
   not a bug.

8. **No retention instrumentation.** We cannot see D1/D30, activation, or where
   people drop. We are flying blind on the exact metric that defines success in
   this category. Cheap to add, and everything above should be measured.

9. **Voice output.** Aria listens (mic input works) but never speaks. Tolan's
   warmth is largely its voice. A spoken daily message is a strong differentiator
   and mostly a front-end lift (Web Speech synthesis, later a real TTS voice).

10. **Data export + mental-privacy controls.** The APA calls for a "right to
    mental privacy" over inferred emotional states - which is literally our
    inferred-coaching-tone feature. Give people export + delete + a plain-English
    view of what Aria has inferred. Trust feature and likely future law.

--------------------------------------------------------------------------------

## The phased build plan

### Phase 0 - Safe and legal to talk to. DONE 2026-07-10.
Shipped this session. Kindred is now defensible to operate.

### Phase 1 - "It survives you." SHIPPED 2026-07-10.
Done this session. The existential risk is closed: your life now lives on the
server, not only in one browser.
- Email + password accounts via our own /api (scrypt + HMAC token, node:crypto
  only - no client anon key or email provider needed yet; magic link is a later
  upgrade). `api/auth.js`, `api/_lib-account.js`.
- Durable record: `kindred_accounts` + `kindred_states` (the store is one JSON
  blob, so sync = push/pull that blob). `api/state.js`, `api/_lib-db.js`
  (postgres, pooler URL, prepare:false for pgbouncer). Client `lib/account.js` +
  `lib/sync.js`: pull on sign-in (server wins if it holds a real life, else local
  seeds the server), debounced push on every change.
- PWA installable (manifest + service worker, never caches /api) + web push
  (VAPID) + a daily nudge cron. Local-first stays the anonymous default.
- VERIFIED in production: signup, cross-device restore (pushed a life, logged in
  fresh, it all came back), wrong-password 401, duplicate 409, cascade delete,
  live bundle hash == source. Gotcha fixed: Supabase direct `db.*` host is
  deprecated for serverless (ENOTFOUND on Vercel); must use the pooler URL.

### Phase 1 (original notes) - persistence + reach + accounts
- **Auth:** magic-link / email (Supabase Auth). Low-friction, no passwords.
- **Persistence:** migrate the local-first store to Supabase (`kindred_*`
  tables). The store already carries `// SUPABASE:` notes on every read/write,
  so signatures do not change - it is a body swap behind a flag. Local-first
  stays as the offline cache; the server becomes the source of truth once
  signed in. Migrate a local session into the account on first sign-in so
  nobody loses their demo-turned-real life.
- **PWA + web push:** manifest, service worker, installable, web push. One
  daily nudge grounded in their data (reuse `daily.js`), respectful cadence,
  easy off switch. This is the retention engine.
- **LDS capture:** wire `captureSignupToLDS` once auth exists (studio standard).
- Exit test: sign in on phone, add a goal, clear the browser, sign in again,
  the goal is there; a daily push arrives and deep-links into Today.

### Phase 2 - "It pays." (monetization at the moment of maximum intent)
- Paywall at the **profile reveal** (the day-0, highest-intent moment). Show the
  synthesized "this is you," then gate the ongoing companion + full history
  behind a **7-day free trial**, annual anchor around **$69-99/yr** with a
  monthly option, per H&F benchmarks. Keep the interview + reveal free (that is
  the hook and the demo).
- Stripe (web billing, no App Store 30% - a real edge of being web-first).
- Design first-30-day value hard: ~30% of annual subs cancel in month one, so
  the daily message + streak momentum has to land fast.
- Instrument install -> interview-complete -> trial -> paid.

### Phase 3 - "It retains, safely, at depth."
- Non-punitive streaks (streak forgiveness, no shame on a missed day - punitive
  streaks are a documented harm vector and they churn).
- Tune the inferred tone system deliberately away from sycophancy (retention AND
  safety win together here).
- Anti-dependency nudges: celebrate real-world reconnection (lean the People
  feature harder), gentle usage-awareness, "go be with a person" as a success.
- Voice output for the daily message and companion.
- Real retention analytics (D1/D7/D30, cohort curves).

### Phase 4 - "It grows." (the right channel, not the doomed one)
- **Kill the 10k-page plan.** Replace with a small set of genuinely deep,
  credibly-authored cornerstone guides (real E-E-A-T) plus GEO / answer-engine
  optimization so Kindred is what the AI engines cite.
- Build the growth loop native to a companion: shareable "this is you" cards,
  referral, and the reconnection-message feature as an organic surface (people
  literally send Kindred-drafted texts to friends - that is distribution).
- App Store presence via a PWA wrapper or thin native shell once retention is
  proven, to unlock native push reliability and discovery.

--------------------------------------------------------------------------------

## What shipped in this deep-dive session (Phase 0)

- `api/_lib-safety.js` + `src/lib/safety.js` (client mirror) - deterministic
  crisis phrase screen (11/11 on the test set: catches "want to die",
  "kill myself", "no reason to live", "suicidal", "cutting myself"; ignores
  idioms like "this is killing me", "dying to see her", "dead tired"), the
  shared 988 / Crisis Text Line / 911 / findahelpline resources, and the
  safety/disclosure system-prompt block.
- Two independent lines of defense: the deterministic screen runs BEFORE any
  Claude call (works even if the API is down), plus a model-side `crisis` flag
  for nuanced phrasing. Either path returns care + resources and skips coaching.
- `src/components/CrisisCard.jsx` - the warm resources card with real
  tap-to-call links, rendered inline in the dock and onboarding, and reachable
  any time from a new "real help" affordance in the dock header.
- AI disclosure at onboarding ("I'm an AI companion, not a person"), in the
  dock header, and re-surfaced every 3 hours of continuous engagement (NY law).
- Companion + interview system prompts hardened: honest self-identification as
  AI, no sycophancy, active anti-dependency, no diagnosing/treating.
- Verified: 11/11 crisis unit tests, clean build, no dashes, live bundle hash
  match, live `/api/companion` returns crisis + 988 on a real signal and normal
  grounded coaching on an idiom ("work is killing me, dying to get to the gym").

--------------------------------------------------------------------------------

## Caveats on the evidence

The research run hit a session limit during verification, so 22 of 25 claims
could not be adversarially adjudicated - they rest on single reputable sources
(RevenueCat, Adapty, APA, peer-reviewed studies) and are DIRECTIONAL. Only the
NY/CA legal finding is hard-confirmed (against primary bill records). Two stats
from a secondary article were REFUTED (a "700% growth" and a "48.7% of adults"
figure), so that source's numbers are suspect. Whole sub-questions came back
empty: competitor churn postmortems (Replika/Pi/Woebot), exact D1/D30 norms,
web-vs-native push magnitude, and 2026 programmatic-SEO viability - the Phase 4
pivot is a reasoned call, not a proven one. A re-run of the research (after the
limit resets) should close those gaps before we bet real money on Phase 4.
