// Aria's spoken voice. Uses the browser SpeechSynthesis API (no dependency, no
// cost) so Aria can read her daily message and replies aloud. Tolan's warmth is
// largely its voice; this is the cheap first step toward that. Picks a warm,
// natural English voice when the platform offers one. A real neural TTS voice is
// a later upgrade; the call sites do not change.
let preferred = null;

function pickVoice() {
  if (preferred) return preferred;
  const voices = window.speechSynthesis?.getVoices?.() || [];
  if (!voices.length) return null;
  const want = ['Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Karen', 'Moira', 'Serena'];
  for (const name of want) {
    const v = voices.find(x => x.name === name);
    if (v) { preferred = v; return v; }
  }
  preferred = voices.find(v => /en[-_]US/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang)) || voices[0];
  return preferred;
}

export function speechAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text, { rate = 0.98, pitch = 1.02 } = {}) {
  if (!speechAvailable() || !text) return;
  try {
    window.speechSynthesis.cancel();   // never stack utterances
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 600));
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = rate; u.pitch = pitch;
    window.speechSynthesis.speak(u);
  } catch {}
}

export function stopSpeaking() {
  if (speechAvailable()) { try { window.speechSynthesis.cancel(); } catch {} }
}

// Voices load async on some browsers; warm the cache.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => { preferred = null; pickVoice(); };
}
