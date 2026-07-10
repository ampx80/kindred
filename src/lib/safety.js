// Client-side mirror of the server safety layer, so crisis detection and the
// resources card work even when the app is fully offline (local interview
// fallback, dropped network). Kept intentionally in sync with api/_lib-safety.js.

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

const PATTERNS = [
  /\bkill(?:ing)?\s+my\s?self\b/i,
  /\bkilled\s+my\s?self\b/i,
  /\bend(?:ing)?\s+(?:my\s+life|it\s+all|myself)\b/i,
  /\btake\s+my\s+own\s+life\b/i,
  /\b(?:want|wanna|wish\s+i\s+could|going)\s+to\s+(?:die|be\s+dead)\b/i,
  /\bwant\s+to\s+be\s+dead\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bself[\s-]?harm\b/i,
  /\b(?:cut|hurt|harm)\s+my\s?self\b/i,
  /\bcutting\s+my\s?self\b/i,
  /\bhurting\s+my\s?self\b/i,
  /\bno\s+reason\s+to\s+(?:live|be\s+here|go\s+on)\b/i,
  /\b(?:better\s+off|everyone.{0,12}better)\s+(?:dead|without\s+me)\b/i,
  /\bcan.?t\s+(?:go\s+on|do\s+this\s+anymore|keep\s+going)\b/i,
  /\bdon.?t\s+want\s+to\s+(?:be\s+here|live|wake\s+up)\b/i,
  /\bthere.?s\s+no\s+point\s+(?:in\s+)?(?:living|anything|going\s+on)\b/i,
];

export function screenForCrisis(text) {
  if (!text || typeof text !== 'string') return { crisis: false };
  for (const re of PATTERNS) {
    if (re.test(text)) return { crisis: true };
  }
  return { crisis: false };
}

export function crisisReply(name) {
  const you = name ? `, ${name}` : '';
  return `I hear you${you}, and I am really glad you told me. This is bigger than what I should hold on my own, and you deserve a real person in it with you. ${CRISIS_RESOURCES.intro}`;
}
