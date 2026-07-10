// Local adaptive interview engine - the honest fallback when /api/interview
// is unreachable (no key wired, offline dev). This is real branching logic
// over what the person actually says, not canned AI output: it senses
// domains from their words, follows the strongest thread with domain-specific
// follow-ups, and composes the profile from their own answers.

const DOMAIN_HINTS = {
  faith: ['faith', 'god', 'church', 'pray', 'spirit', 'bible', 'worship'],
  fitness: ['gym', 'strong', 'fit', 'weight', 'run', 'walk', 'exercise', 'shape', 'energy', 'body'],
  nutrition: ['eat', 'food', 'nutrition', 'diet', 'cook', 'meal', 'sugar'],
  mindset: ['anxious', 'anxiety', 'stress', 'mind', 'confidence', 'overthink', 'calm', 'focus', 'discipline', 'depress'],
  family: ['family', 'mom', 'dad', 'mother', 'father', 'brother', 'sister', 'son', 'daughter', 'kids', 'parent'],
  romance: ['wife', 'husband', 'partner', 'marriage', 'dating', 'love life', 'girlfriend', 'boyfriend'],
  friendship: ['friend', 'friends', 'lonely', 'reconnect', 'social'],
  relationships: ['relationship', 'people', 'coworker', 'connect'],
  career: ['job', 'work', 'career', 'business', 'boss', 'promotion', 'company'],
  money: ['money', 'debt', 'save', 'saving', 'finance', 'budget'],
  creativity: ['write', 'book', 'music', 'paint', 'create', 'art', 'build', 'project'],
  learning: ['learn', 'read', 'study', 'course', 'skill', 'school'],
  nature: ['nature', 'outside', 'outdoors', 'hike', 'trail', 'garden', 'mountains', 'ocean'],
  travel: ['travel', 'trip', 'see the world', 'visit', 'adventure'],
  purpose: ['purpose', 'meaning', 'direction', 'lost', 'why', 'fulfill'],
  recovery: ['drink', 'sober', 'quit', 'addiction', 'habit', 'smoking', 'clean'],
  health: ['sleep', 'health', 'doctor', 'pain', 'sick', 'tired'],
};

const FOLLOWUPS = {
  fitness: [
    { q: (a) => `When you picture feeling strong again, what is it really for?`, choices: ['Energy for my people', 'Confidence in my own skin', 'Proving I can keep a promise', 'Just feeling like me again'] },
    { q: () => `What usually breaks the streak when you try?`, choices: ['Mornings get away from me', 'I go too hard too fast', 'Nobody notices either way', 'Life just piles up'] },
  ],
  family: [
    { q: () => `Who in your family is on your mind the most right now?`, choices: ['A parent', 'A sibling', 'My kids', 'Someone I have lost touch with'] },
    { q: () => `If that relationship were easy again, what would it look like?`, choices: ['Regular calls', 'One honest conversation', 'Time together, no agenda', 'Forgiveness, both ways'] },
  ],
  romance: [
    { q: () => `What does your relationship need more of from you right now?`, choices: ['Time and attention', 'A hard conversation', 'Fun, honestly', 'Patience'] },
  ],
  friendship: [
    { q: () => `Is there a friend you keep meaning to reach back out to?`, choices: ['Yes, and I know exactly who', 'A few people, honestly', 'I need new friends too', 'It has been too long, it feels weird'] },
  ],
  career: [
    { q: () => `Is work something to fix, or something to build?`, choices: ['Fix - it is draining me', 'Build - I want more', 'Both, honestly', 'I want out entirely'] },
  ],
  creativity: [
    { q: () => `What is the thing you keep almost starting?`, choices: ['A book', 'Music or art', 'A business', 'Something with my hands'] },
    { q: () => `What has kept it in the drawer so far?`, choices: ['No time that is truly mine', 'Fear it will not be good', 'I do not know where to start', 'Life keeps interrupting'] },
  ],
  mindset: [
    { q: () => `When your head gets loud, what does it usually say?`, choices: ['You are behind', 'You will let them down', 'You always quit', 'It never really stops'] },
  ],
  faith: [
    { q: () => `What would stronger faith look like in a normal week for you?`, choices: ['A real daily practice', 'Being part of a community', 'Peace I can actually feel', 'Living what I believe'] },
  ],
  nature: [
    { q: () => `When did you last feel really clear-headed outside?`, choices: ['On a trail', 'Near water', 'Working in the yard', 'Too long ago'] },
  ],
  recovery: [
    { q: () => `What are you ready to leave behind?`, choices: ['Drinking', 'A habit that owns my evenings', 'The version of me that quits', 'I am not ready to say yet'] },
  ],
  purpose: [
    { q: () => `If nothing was in the way, what would you spend this year becoming?`, choices: ['Healthier and stronger', 'Closer to my people', 'Someone who finishes things', 'At peace'] },
  ],
  travel: [
    { q: () => `Where do you keep telling yourself you will go someday?`, choices: ['Somewhere wild', 'Back home', 'Overseas', 'Anywhere, with the right person'] },
  ],
  money: [
    { q: () => `What would money calm look like for you?`, choices: ['No debt hanging over me', 'A real cushion', 'Not fighting about it', 'Freedom to choose my work'] },
  ],
  health: [
    { q: () => `What does your body keep asking you for?`, choices: ['Real sleep', 'Movement', 'Better fuel', 'A doctor visit I keep skipping'] },
  ],
};

const GENERIC = [
  { q: (name) => `What is one thing that is genuinely hard right now, ${name}?`, choices: ['My energy is gone', 'A relationship is strained', 'I feel behind in life', 'I am fine, just restless'], probe: true },
  { q: () => `And what is one thing you are quietly proud of lately?`, choices: ['I kept showing up', 'I handled something hard', 'My people', 'Honestly, I am still looking'] },
  { q: () => `When you imagine a year from now going well, what is different?`, choices: ['I am stronger and lighter', 'The people around me feel closer', 'I made the thing I keep talking about', 'I feel calm for once'] },
  { q: () => `What usually gets in the way when you try to change something?`, choices: ['I start too big', 'No one holds me to it', 'Time disappears', 'I stop believing it matters'] },
];

const OPENER = { q: 'If the next year of your life went exactly the way you hope, what would be different?', choices: ['My body and energy', 'My closest relationships', 'My faith or inner peace', 'My work and what I am building', 'Something I want to create', 'Honestly, a bit of everything'] };

export function senseDomains(text) {
  const t = (text || '').toLowerCase();
  const hits = [];
  for (const [dom, words] of Object.entries(DOMAIN_HINTS)) {
    let score = 0;
    for (const w of words) if (t.includes(w)) score += 1;
    if (score) hits.push([dom, score]);
  }
  return hits.sort((a, b) => b[1] - a[1]).map(h => h[0]);
}

export function localNextQuestion({ name, exchanges }) {
  if (!exchanges.length) return { question: OPENER.q, choices: OPENER.choices, domainsSensed: [], toneSignal: 'coach', depth: 5, done: false, profile: null };

  const allText = exchanges.map(e => e.a).join(' \n ');
  const sensed = senseDomains(allText);
  const askedQs = new Set(exchanges.map(e => e.q));
  const n = exchanges.length;

  // tone: blunt short answers -> challenger; soft words -> nurturer; else coach
  const avgLen = allText.length / n;
  const soft = /(hard|scared|tired|lost|hurt|miss|lonely|overwhelm)/i.test(allText);
  const blunt = /(just tell me|let's go|no excuses|whatever it takes|straight)/i.test(allText) || avgLen < 14;
  const toneSignal = soft ? 'nurturer' : blunt ? 'challenger' : 'coach';

  const depth = Math.min(95, n * 13);
  const done = n >= 7 || (n >= 6 && sensed.length >= 3);

  if (done) {
    return { question: '', choices: [], domainsSensed: sensed, toneSignal, depth: 100, done: true, profile: composeProfile({ name, exchanges, sensed, toneSignal }) };
  }

  // Follow the strongest sensed thread that still has unasked follow-ups.
  for (const dom of sensed) {
    const fu = FOLLOWUPS[dom] || [];
    for (const f of fu) {
      const q = f.q(name);
      if (!askedQs.has(q)) return { question: q, choices: f.choices, domainsSensed: sensed, toneSignal, depth, done: false, profile: null };
    }
  }
  // Otherwise widen with an unasked generic probe.
  for (const g of GENERIC) {
    const q = g.q(name);
    if (!askedQs.has(q)) return { question: q, choices: g.choices, domainsSensed: sensed, toneSignal, depth, done: false, profile: null };
  }
  return { question: '', choices: [], domainsSensed: sensed, toneSignal, depth: 100, done: true, profile: composeProfile({ name, exchanges, sensed, toneSignal }) };
}

const DOMAIN_NAMES = {
  faith: 'A steadier faith', fitness: 'Getting your strength back', nutrition: 'Fuel that helps',
  mindset: 'A quieter mind', relationships: 'Closer relationships', family: 'Your family',
  friendship: 'Your friendships', romance: 'Your relationship', career: 'Work worth building',
  money: 'Money calm', creativity: 'The thing you want to make', learning: 'Always learning',
  nature: 'Time outside', travel: 'Seeing more of the world', purpose: 'A life that feels like yours',
  recovery: 'Leaving it behind', health: 'Your health', community: 'Your community',
};
const FIRST_GOALS = {
  faith: 'Five quiet minutes each morning', fitness: 'A 20 minute walk before the day starts',
  nutrition: 'One real, cooked meal a day', mindset: 'Write down the loud thought, once a day',
  relationships: 'One genuine check-in message a day', family: 'One honest text to family this week',
  friendship: 'Reach out to one old friend this week', romance: 'One undistracted hour together this week',
  career: 'One focused hour on what matters, daily', money: 'Track every dollar for one week',
  creativity: '200 words (or 20 minutes) with morning coffee', learning: '20 minutes of reading a day',
  nature: 'One walk outside every day, no phone', travel: 'Pick the place and set the date this week',
  purpose: 'One page: what a good year looks like', recovery: 'One day at a time, marked here',
  health: 'Lights out by 10:30 this week', community: 'Show up to one local thing this week',
};

function composeProfile({ name, exchanges, sensed, toneSignal }) {
  const top = (sensed.length ? sensed : ['purpose', 'mindset', 'relationships']).slice(0, 4);
  const quotes = exchanges.filter(e => e.a && e.a.length > 3).map(e => e.a);
  const q1 = quotes[0] ? quotes[0].replace(/[.]$/, '') : 'what you said';
  const domains = top.map((id) => ({
    id,
    name: DOMAIN_NAMES[id] || id,
    why: `It kept coming up in your own words.`,
    firstGoal: FIRST_GOALS[id] || 'One small rep this week',
  }));
  const toneWhyMap = {
    nurturer: 'You have been carrying a lot, so I will keep things gentle and small. No pressure, just presence.',
    coach: 'You move on structure and momentum, so I will keep the next rep in front of you.',
    challenger: 'You do not want it soft, so I will tell you the truth and hold you to your word.',
  };
  return {
    summary: `${name}, here is what I heard. When you said "${q1}", that was the center of it. The life you are after is not somebody else's - it is yours, with ${domains.slice(0, 3).map(d => d.name.toLowerCase()).join(', ')} pulled back to the middle. You do not need a reinvention. You need a rhythm you can keep, and someone who remembers what you said you wanted. That is what I am here for.`,
    domains,
    tone: toneSignal,
    toneWhy: toneWhyMap[toneSignal],
    belief: `You showed up and told the truth about your life today, ${name}. That is the hardest rep, and you already did it.`,
  };
}
