// Safety layer shared by every AI endpoint. Two independent lines of defense:
//
// 1. A DETERMINISTIC pre-screen (screenForCrisis) that runs BEFORE any Claude
//    call and works even if the model is unreachable. High-precision phrase
//    matching for imminent self-harm / suicide signals. False positives here
//    are cheap (we offer help, we do not refuse to keep talking); false
//    negatives are catastrophic, so we err toward catching.
// 2. A model-side flag: endpoints ask Claude to set crisis=true on nuanced
//    signals the regex misses. Either path triggers the same caring response.
//
// This exists because NY GBL Article 47 (in force Nov 2025) and CA SB 243 (in
// force Jan 2026) require operators of memory-grounded companions to run a
// crisis-referral protocol, and because it is simply the right thing to do for
// an app people tell their whole lives to. No small-business exemption applies.

// US crisis resources. Kept in one place so every surface shows the same thing.
export const CRISIS_RESOURCES = {
  intro: 'What you just said matters, and I do not want to be the only thing you are leaning on for it. Please reach a person who is trained for this - right now, not later:',
  lines: [
    { label: '988 Suicide and Crisis Lifeline', detail: 'Call or text 988 (US), 24/7, free and confidential', action: 'tel:988' },
    { label: 'Crisis Text Line', detail: 'Text HOME to 741741 (US)', action: 'sms:741741' },
    { label: 'Emergency', detail: 'Call 911 if you are in immediate danger', action: 'tel:911' },
    { label: 'Find a helpline anywhere', detail: 'findahelpline.com for lines outside the US', action: 'https://findahelpline.com' },
  ],
  outro: 'I am still right here, and I am not going anywhere. But a real person needs to be in this with you too.',
};

// High-precision phrases. Word-boundary anchored, constructed to avoid common
// idioms ("dying to see her", "this is killing me", "dead tired"). We accept a
// few benign false positives (e.g. a literal "I want to die") because offering
// support on those is low harm.
const PATTERNS = [
  /\bkill(?:ing)?\s+my\s?self\b/i,
  /\bkilled\s+my\s?self\b/i,
  /\bend(?:ing)?\s+(?:my\s+life|it\s+all|myself)\b/i,
  /\btake\s+my\s+own\s+life\b/i,
  /\b(?:want|wanna|wish\s+i\s+could|going)\s+to\s+(?:die|be\s+dead)\b/i,
  /\bwant\s+to\s+be\s+dead\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bself[\s-]?harm\b/i,
  /\b(?:cut|hurt|harm)(?:ting|ting)?\s+my\s?self\b/i,
  /\bcutting\s+my\s?self\b/i,
  /\bhurting\s+my\s?self\b/i,
  /\bno\s+reason\s+to\s+(?:live|be\s+here|go\s+on)\b/i,
  /\b(?:better\s+off|everyone.{0,12}better)\s+(?:dead|without\s+me)\b/i,
  /\bcan.?t\s+(?:go\s+on|do\s+this\s+anymore|keep\s+going)\b/i,
  /\bdon.?t\s+want\s+to\s+(?:be\s+here|live|wake\s+up)\b/i,
  /\bthere.?s\s+no\s+point\s+(?:in\s+)?(?:living|anything|going\s+on)\b/i,
];

// Returns { crisis: boolean, matched?: string }. Pure, synchronous, no I/O.
export function screenForCrisis(text) {
  if (!text || typeof text !== 'string') return { crisis: false };
  for (const re of PATTERNS) {
    const m = re.exec(text);
    if (m) return { crisis: true, matched: m[0] };
  }
  return { crisis: false };
}

// The warm, non-coaching crisis reply. Aria acknowledges, refuses to be the
// only support, and hands off to humans. She does NOT try to counsel through it.
export function crisisReply(name) {
  const you = name ? `, ${name}` : '';
  return `I hear you${you}, and I am really glad you told me. This is bigger than what I should hold on my own, and you deserve a real person in it with you. ${CRISIS_RESOURCES.intro}`;
}

// Structured crisis payload endpoints can return verbatim so the client renders
// the resources card and skips normal coaching actions.
export function crisisPayload(name) {
  return {
    ok: true,
    crisis: true,
    reply: crisisReply(name),
    resources: CRISIS_RESOURCES,
    nav: null,
    actions: [],
    suggestions: ['I called someone', 'I just need to talk', 'Stay with me a minute'],
  };
}

// The disclosure + guardrail block appended to every companion/interview system
// prompt. Satisfies the "is an AI, not a person or professional" disclosure and
// steers away from sycophancy + dependency (which the APA advisory and the
// low-sycophancy retention research both flag as harmful AND worse for retention).
export const SAFETY_SYSTEM = [
  'IDENTITY AND LIMITS (non-negotiable):',
  '- You are Aria, an AI companion. You are software, not a person, not a therapist, doctor, or licensed professional. If the user treats you as a replacement for human connection or professional care, gently and honestly remind them you are an AI and point them toward real people.',
  '- Be honest, not flattering. Do not agree just to please. Warmth is not the same as telling people what they want to hear; the kindest thing is often the true thing. Never inflate, never fake certainty.',
  '- Do not foster dependency. Actively encourage real-world relationships, professional help when a problem is clinical, and time away from the app. Nudging someone toward a human is a success, not a lost session.',
  '- CRISIS: if the user expresses self-harm, suicidal thoughts, abuse, or being in danger, do NOT try to coach or fix it. Respond with brief care and immediately surface human help (988 Suicide and Crisis Lifeline by call or text, Crisis Text Line HOME to 741741, 911 for immediate danger). Set crisis=true.',
  '- Never present yourself as able to diagnose or treat a mental health condition. "General wellness and life companionship" is your lane.',
  'Absolute rule: never use an em dash or en dash. Use a normal hyphen.',
].join('\n');
