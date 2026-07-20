// The Music engine. For the person whose life sounds better with an instrument
// in hand or the right record on: Aria builds real weekly practice plans, walks
// them through learning a specific song, makes theory feel simple and playable,
// and hands them listening tuned to the mood they are in. Four generative tools
// plus a self-contained, tap-tempo metronome. Warm, joyful, and personal.
import { useState, useEffect, useRef } from 'react';
import { Icon } from '../../components/icons.jsx';
import { Card, Button, Field, Input, Select, useToast } from '../../components/UI.jsx';
import { getProfile } from '../../lib/store.js';

// Shared voice + format tail stitched into every generative systemPrompt so the
// whole engine sounds like one musician friend who already knows this person.
const VOICE = `Write as Aria, a warm, encouraging music mentor who already knows this person from their profile. Speak to them directly as "you". No preamble, no restating the request, no sign-off.

Format rules (follow exactly):
- Return markdown only. No code fences.
- Use ## headings for sections and - bullets or numbered lists for anything with steps or blocks.
- Be specific and musical: name real notes, chords, intervals, and concrete minute counts, never vague filler.
- Encouraging and joyful, never a lecture. Meet them at the level they told you.
- Never reproduce copyrighted tablature, sheet music, or full lyrics. Describe how to approach the music in your own words instead.
- Use ASCII hyphen "-" only. Never use an em dash or an en dash anywhere.`;

/* -------------------------------------------------------------------------
   Metronome: a self-contained, tap-tempo click. BPM slider plus a tap-tempo
   button, a beats-per-measure selector with an accented downbeat, and a big
   pulsing dot. Audio is generated with the Web Audio API on a user gesture and
   the scheduling interval lives in a ref that is cleared on stop and unmount.
   Safe offline; if audio is unavailable it still pulses visually.
------------------------------------------------------------------------- */
const MET_CSS = `
.mus-met{display:flex;flex-direction:column;gap:1.2rem}
.mus-dot-wrap{display:grid;place-items:center;padding:.6rem 0}
.mus-dot{width:min(200px,62vw);aspect-ratio:1;border-radius:50%;display:grid;place-items:center;text-align:center;
  border:5px solid var(--sky,var(--line));background:var(--sky-bg,var(--n-100));
  transition:transform .08s ease,background .12s ease,border-color .12s ease}
.mus-dot.beat{transform:scale(1.06)}
.mus-dot.accent{background:var(--gold-bg);border-color:var(--gold)}
.mus-bpm{font-family:var(--font-display,inherit);font-weight:800;line-height:1;font-size:clamp(2.6rem,11vw,3.6rem);color:var(--ink)}
.mus-bpm-lbl{font-weight:650;text-transform:uppercase;letter-spacing:.04em;font-size:.78rem;color:var(--n-600)}
.mus-beats{display:flex;gap:.4rem;justify-content:center;flex-wrap:wrap}
.mus-pip{width:14px;height:14px;border-radius:50%;background:var(--n-100);border:1px solid var(--line);transition:transform .08s ease,background .08s ease}
.mus-pip.on{background:var(--sky);border-color:var(--sky);transform:scale(1.2)}
.mus-pip.on.acc{background:var(--gold);border-color:var(--gold)}
.mus-slider{width:100%;accent-color:var(--accent-600)}
.mus-row{display:flex;gap:.7rem;align-items:flex-end;flex-wrap:wrap}
@media (prefers-reduced-motion: reduce){.mus-dot,.mus-pip{transition:none}.mus-dot.beat{transform:none}}
`;

function clampBpm(v) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return 100;
  return Math.max(40, Math.min(240, n));
}

function Metronome() {
  const toast = useToast();
  const profile = (() => { try { return getProfile(); } catch { return null; } })();
  const [bpm, setBpm] = useState(100);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(0); // 0-indexed current beat within the measure

  const intervalRef = useRef(null);
  const audioRef = useRef(null);
  const beatRef = useRef(0);
  const tapsRef = useRef([]);

  // Lazily create (or resume) the AudioContext on a real user gesture.
  const ensureAudio = () => {
    try {
      if (!audioRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        audioRef.current = new Ctx();
      }
      if (audioRef.current.state === 'suspended') audioRef.current.resume();
      return audioRef.current;
    } catch {
      return null;
    }
  };

  const click = (accent) => {
    const ctx = audioRef.current;
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = accent ? 1500 : 900;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.32, ctx.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {
      /* no-op: audio is a bonus, the visual pulse still runs */
    }
  };

  // The heartbeat. Held in a ref so a bpm change cleanly restarts the timer.
  useEffect(() => {
    if (!running) return undefined;
    const period = 60000 / clampBpm(bpm);
    intervalRef.current = setInterval(() => {
      const next = beatRef.current % beatsPerMeasure;
      click(next === 0);
      setBeat(next);
      beatRef.current = next + 1;
    }, period);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); intervalRef.current = null; };
  }, [running, bpm, beatsPerMeasure]);

  // Belt and suspenders on unmount: stop the timer and close the audio context.
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    try { if (audioRef.current) audioRef.current.close(); } catch { /* ignore */ }
  }, []);

  const start = () => {
    ensureAudio();
    beatRef.current = 0;
    setBeat(0);
    setRunning(true);
  };
  const stop = () => {
    setRunning(false);
    beatRef.current = 0;
    setBeat(0);
  };
  const toggle = () => (running ? stop() : start());

  const nudge = (delta) => setBpm(b => clampBpm(b + delta));

  // Tap tempo: average the gaps between the last few taps, drop stale taps.
  const tap = () => {
    ensureAudio();
    const now = Date.now();
    const taps = tapsRef.current.filter(t => now - t < 2500);
    taps.push(now);
    tapsRef.current = taps.slice(-5);
    if (tapsRef.current.length >= 2) {
      const gaps = [];
      for (let i = 1; i < tapsRef.current.length; i += 1) gaps.push(tapsRef.current[i] - tapsRef.current[i - 1]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      if (avg > 0) setBpm(clampBpm(Math.round(60000 / avg)));
    }
    click(false);
  };

  const tempoWord = bpm < 66 ? 'Largo, slow and spacious'
    : bpm < 88 ? 'Andante, an easy walk'
      : bpm < 112 ? 'Moderato, a steady groove'
        : bpm < 152 ? 'Allegro, bright and moving'
          : 'Presto, fast and driving';

  return (
    <Card pad={24}>
      <style>{MET_CSS}</style>
      <div className="mus-met">
        <div className="col" style={{ gap: '.2rem' }}>
          <h2 style={{ margin: 0 }}>Metronome</h2>
          <p className="muted" style={{ margin: 0 }}>
            Set a tempo or tap it out{profile && profile.name ? `, ${String(profile.name).split(' ')[0]}` : ''}. The downbeat lands gold so you always feel beat one.
          </p>
        </div>

        <div className="mus-dot-wrap">
          <div className={`mus-dot${running ? ' beat' : ''}${running && beat === 0 ? ' accent' : ''}`}
            role="img" aria-label={`Metronome at ${bpm} beats per minute, ${beatsPerMeasure} beats per measure`}>
            <div className="col" style={{ gap: '.15rem' }}>
              <span className="mus-bpm">{bpm}</span>
              <span className="mus-bpm-lbl">BPM</span>
            </div>
          </div>
        </div>

        <div className="mus-beats" aria-hidden>
          {Array.from({ length: beatsPerMeasure }).map((_, i) => (
            <span key={i} className={`mus-pip${running && beat === i ? ' on' : ''}${i === 0 ? ' acc' : ''}`} />
          ))}
        </div>

        <p className="muted t-sm center" style={{ margin: 0 }}>{tempoWord}</p>

        <Field label={`Tempo: ${bpm} BPM`}>
          <input className="mus-slider" type="range" min={40} max={240} step={1}
            value={bpm} onChange={e => setBpm(clampBpm(e.target.value))}
            aria-label="Tempo in beats per minute" />
        </Field>

        <div className="mus-row">
          <Button variant="ghost" size="sm" onClick={() => nudge(-5)} aria-label="Slower by 5"><Icon name="chevronLeft" size={16} /> 5</Button>
          <Button variant="ghost" size="sm" onClick={() => nudge(-1)} aria-label="Slower by 1"><Icon name="chevronLeft" size={16} /> 1</Button>
          <Button variant="ghost" size="sm" onClick={() => nudge(1)} aria-label="Faster by 1">1 <Icon name="chevronRight" size={16} /></Button>
          <Button variant="ghost" size="sm" onClick={() => nudge(5)} aria-label="Faster by 5">5 <Icon name="chevronRight" size={16} /></Button>
          <div style={{ flex: 1, minWidth: 140 }}>
            <Field label="Beats per measure">
              <Select value={String(beatsPerMeasure)} onChange={e => setBeatsPerMeasure(Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 4)))}>
                <option value="2">2 / 4</option>
                <option value="3">3 / 4</option>
                <option value="4">4 / 4</option>
                <option value="5">5 / 4</option>
                <option value="6">6 / 8</option>
              </Select>
            </Field>
          </div>
        </div>

        <div className="row gap-2 center wrap">
          {running
            ? <Button variant="warm" onClick={toggle}><Icon name="moon" size={17} /> Stop</Button>
            : <Button variant="primary" onClick={toggle}><Icon name="flame" size={17} /> Start</Button>}
          <Button variant="ghost" onClick={tap}><Icon name="target" size={16} /> Tap tempo</Button>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------------- */

const engine = {
  id: 'music',
  name: 'Music',
  tagline: 'Play more, hear more, and grow your ear.',
  emoji: '\u{1F3B5}',
  color: 'var(--sky)',
  bg: 'var(--sky-bg)',
  keywords: ['music', 'guitar', 'piano', 'sing', 'singing', 'instrument', 'practice', 'song', 'songs', 'band', 'drums', 'bass', 'produce', 'producer', 'theory', 'violin', 'ukulele'],
  domains: ['creativity', 'learning', 'rest'],
  blurb: 'A musician in your corner. Aria builds a weekly practice plan that balances technique, repertoire, and ear training, walks you through learning any song, makes theory click on your own instrument, and hands you listening tuned to your mood. Plus a built-in tap-tempo metronome for the woodshed.',

  match: (profile) => {
    try {
      const hay = [
        profile && profile.name,
        profile && profile.about,
        profile && profile.bio,
        profile && Array.isArray(profile.interests) ? profile.interests.join(' ') : '',
        profile && Array.isArray(profile.goals) ? profile.goals.join(' ') : '',
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay) return 0;
      return engine.keywords.reduce((score, k) => (hay.includes(k) ? score + 1 : score), 0);
    } catch {
      return 0;
    }
  },

  tools: [
    {
      id: 'practice-plan',
      name: 'Practice plan',
      desc: 'A weekly plan balancing technique, repertoire, ear, and fun.',
      icon: 'target',
      feature: {
        id: 'music-practice-plan',
        title: 'Practice plan',
        outputTitle: 'Your practice week',
        blurb: 'Tell me your instrument, level, and minutes a day, and I will build a week that actually moves you forward.',
        icon: 'target',
        cta: 'Build my practice',
        inputs: [
          { key: 'instrument', label: 'Your instrument', type: 'text', placeholder: 'e.g. guitar, piano, voice, drums, violin' },
          { key: 'level', label: 'Where you are', type: 'select', options: ['Beginner', 'Some experience', 'Intermediate', 'Advanced'] },
          { key: 'minutesPerDay', label: 'Minutes per day', type: 'select', options: ['10', '20', '30', '45'] },
        ],
        systemPrompt: `${VOICE}

Build a weekly practice plan for this person on their instrument, scaled to their level and the exact minutes per day they chose. Every day's blocks must add up to that daily time. Balance four ingredients across the week: technique, repertoire (real playing of songs or pieces), ear training, and pure fun so they keep coming back.

## Your week at a glance
- One short, warm paragraph naming their instrument, level, and the daily time, and how this week grows their ear and their hands together.

## Daily blocks
For each of the 7 days use a "## Day N" heading and a numbered list of concrete blocks. Each block has a label, a minute count, and a specific what-to-do (for example, "Technique - 8 min: chromatic warmup, one string at a time, slow and even"). Cover technique, repertoire, and ear training across the week, and give at least one day a lighter "just play what you love" block. Make the minutes sum to their chosen daily total every day. It is fine to make one day a rest or light day.

## Ear training this week
- 2 to 3 simple ear exercises they can do at their level (for example, matching pitch, naming intervals, or playing back a short phrase by ear).

## How to know it is working
- One line on the small win to watch for by the end of the week.`,
      },
    },

    {
      id: 'learn-song',
      name: 'Learn this song',
      desc: 'A step-by-step way into any song, section by section.',
      icon: 'sparkles',
      feature: {
        id: 'music-learn-song',
        title: 'Learn this song',
        outputTitle: 'How to learn it',
        blurb: 'Name a song and your instrument, and I will map the smart way in: sections, the hard parts, and a practice loop.',
        icon: 'sparkles',
        cta: 'Map the song',
        inputs: [
          { key: 'song', label: 'The song (title and artist if you have it)', type: 'text', placeholder: 'e.g. Blackbird by The Beatles' },
          { key: 'instrument', label: 'Your instrument', type: 'text', placeholder: 'e.g. guitar, piano, voice' },
        ],
        systemPrompt: `${VOICE}

Help this person learn the song they named on their instrument. Do not reproduce any tablature, chord charts, sheet music, or lyrics. Instead describe, in your own words, the smart order to learn it and how to practice it. If you are unsure of the exact song, give the same approach in general terms and say so in one short line.

## The shape of the song
- Describe the sections in order (for example, intro, verse, chorus, bridge) and roughly how they feel and relate, so they know the map before they play.

## Start here
- The single easiest section to learn first and why starting there builds momentum.

## The hard parts
- A bulleted list of the trickiest spots to expect on their instrument, each with a plain-language approach to get past it (slow it down, isolate it, break the motion into steps).

## Your practice loop
- A short numbered routine they can repeat: learn a section slow, loop the hard bar, speed up gradually, then stitch sections together. Give concrete rep counts or minute suggestions.

## When it clicks
- One line on the sign they are ready to play it start to finish.`,
      },
    },

    {
      id: 'theory-simple',
      name: 'Theory made simple',
      desc: 'A plain, playable explanation of any theory topic.',
      icon: 'book',
      feature: {
        id: 'music-theory-simple',
        title: 'Theory made simple',
        outputTitle: 'Theory, made simple',
        blurb: 'Name a topic and I will explain it in plain, musical language with things you can try right now on your instrument.',
        icon: 'book',
        cta: 'Explain it simply',
        inputs: [
          { key: 'topic', label: 'The topic', type: 'text', placeholder: 'e.g. keys, chord progressions, modes, the circle of fifths' },
        ],
        systemPrompt: `${VOICE}

Explain the music theory topic they asked about in plain, friendly language, always tied back to sound and to their instrument. Assume no jargon they have not earned; define any term the first time you use it. Never make it feel like a textbook.

## The idea in plain words
- Two or three short sentences that make the core idea click, using a simple analogy if it helps.

## Why it matters when you play
- A bullet or two on what this actually lets them do or hear once they get it.

## Try it right now
- A numbered list of small, concrete things to play or hum to feel the idea in their hands and ears (for example, "play C then G and notice how G wants to pull back home to C"). Keep each step doable in under a minute.

## A next step
- One line pointing to the natural thing to explore once this one lands.`,
      },
    },

    {
      id: 'listening-mood',
      name: 'Listening for your mood',
      desc: 'A discovery list of artists and albums for how you feel.',
      icon: 'heart',
      feature: {
        id: 'music-listening-mood',
        title: 'Listening for your mood',
        outputTitle: 'Your listening list',
        blurb: 'Tell me the mood and I will hand you real artists, albums, and pieces to explore, with a starting track for each.',
        icon: 'heart',
        cta: 'Find me a listen',
        inputs: [
          { key: 'mood', label: 'The mood you are in', type: 'select', options: ['Focus', 'Energy', 'Calm', 'Nostalgia', 'Discover something new'] },
          { key: 'likes', label: 'Artists or sounds you already love (optional)', type: 'text', placeholder: 'e.g. Bon Iver, classic soul, lo-fi, film scores' },
        ],
        systemPrompt: `${VOICE}

Build a discovery listening list tuned to the mood they chose. If they named things they already love, use that taste to steer the picks toward artists or pieces they will likely connect with, while still stretching their ear a little. Use only real, well-known artists, albums, and pieces; never invent a name and never fabricate links or URLs, just names.

## For a ${'{{mood}}'} kind of day
- One warm sentence framing what this batch of listening is going for.

## Explore these
- A list of about 6 entries. For each, give on its own lines: the artist or album or piece in bold, a one-line "why" that connects it to the mood (and their taste if they shared it), and a "Start with:" line naming one specific track or movement to play first. Do not include links; names only.

## If you want to go further
- One or two lines on a direction to wander next if a pick lands, so the discovery keeps going.`,
      },
    },

    {
      id: 'metronome',
      name: 'Metronome',
      desc: 'A built-in tap-tempo click with an accented downbeat.',
      icon: 'refresh',
      Component: Metronome,
    },
  ],

  daily: (ctx) => ({
    title: 'Ten minutes with sound today',
    body: 'Music gives back fast. Ten honest minutes on your instrument, or one album you have never really sat with, is enough to feel more like yourself. Want a plan? I can build a practice week that already knows what each day is for.',
    cta: 'Plan my practice',
    toolId: 'practice-plan',
  }),

  ariaContext: (profile) => {
    const name = (profile && profile.name) ? String(profile.name).split(' ')[0] : 'this person';
    return `${name} loves music, both playing and listening. You can build weekly practice plans that balance technique, repertoire, ear training, and fun; walk them through learning a specific song step by step without reproducing copyrighted tab or lyrics; explain theory in plain, playable language; and suggest real artists and albums to listen to for the mood they are in. When practice, an instrument, a song, theory, or "what should I listen to" comes up, lean on the Music engine and make it joyful and specific to them.`;
  },
};

export default engine;
