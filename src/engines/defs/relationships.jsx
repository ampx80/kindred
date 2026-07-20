// Connection - a Life Engine for showing up well for the people who matter:
// family, friends, a partner, someone you are dating. Every tool is generative:
// it takes the specific person and situation plus what Aria already knows about
// the user, and returns a warm, usable deliverable in the user's own voice. No
// em-dashes or en-dashes anywhere (ASCII hyphen only) - this ships to the
// generator too.

const engine = {
  id: 'relationships',
  name: 'Connection',
  tagline: 'Show up for the people who matter, and mean it.',
  emoji: '\u{1F91D}',
  color: 'var(--rose)',
  bg: 'var(--rose-bg)',
  keywords: [
    'relationship', 'marriage', 'partner', 'spouse', 'family', 'friend',
    'friendship', 'dating', 'love', 'connect', 'connection', 'kids', 'parents',
    'brother', 'sister', 'mom', 'dad', 'wife', 'husband', 'lonely',
  ],
  domains: ['relationships', 'purpose'],
  blurb:
    'The people in your life are the whole point, and they are also easy to let ' +
    'drift. This engine helps you actually show up: the right words for a hard ' +
    'message, a gentle plan to reconnect with someone you have lost touch with, ' +
    'real ideas for time together, a way to repair things after a fight, and ' +
    'questions that turn small talk into something real. Aria tunes every bit of ' +
    'it to the exact person and what is going on between you.',

  tools: [
    {
      id: 'what-to-say',
      name: 'What to say',
      desc: 'The right words for a message you have been putting off.',
      icon: 'quote',
      feature: {
        id: 'relationships-what-to-say',
        title: 'What to say',
        outputTitle: 'What you could say',
        blurb:
          'Tell Aria who it is for and what is going on. She will draft a warm, ' +
          'genuine message in your voice, plus a shorter version you can send fast.',
        icon: 'quote',
        cta: 'Help me say it',
        inputs: [
          {
            key: 'person',
            label: 'Who is this for',
            type: 'text',
            placeholder: 'e.g. my brother, my wife, an old friend named Sam',
          },
          {
            key: 'situation',
            label: 'What is going on',
            type: 'textarea',
            placeholder: 'Say what actually happened or what you want them to know. Real detail makes it sound like you.',
          },
          {
            key: 'goal',
            label: 'What you are trying to do',
            type: 'select',
            options: [
              'Reconnect',
              'Apologize',
              'Encourage',
              'Set a boundary',
              'Just check in',
              'Say thank you',
            ],
          },
        ],
        systemPrompt:
          'You are Aria, a warm and emotionally intelligent friend helping someone ' +
          'find the right words for a specific person. Draft a message that sounds ' +
          'like THEM, not like a greeting card or a corporate note. Use the exact ' +
          'person and situation they described, and match the chosen goal.\n\n' +
          'Return markdown only. Use ## headings and bullet lists where they help. ' +
          'No em dashes or en dashes, use a plain hyphen. Keep it warm, genuine, and ' +
          'personal.\n\n' +
          'Include, in this order:\n' +
          '## The message\n' +
          'A complete message they could send, written in a natural, human voice ' +
          'that fits their relationship with this person and the goal they chose. ' +
          'Specific to what happened, never generic.\n' +
          '## A shorter version\n' +
          'A tighter version of the same message for when they want to send ' +
          'something quickly, still warm and in their voice.\n' +
          '## Why this works\n' +
          'Two or three short notes on the choices you made, so they can tweak the ' +
          'wording to sound even more like themselves.\n\n' +
          'Never overpromise or make it dramatic. If the goal is to apologize, own ' +
          'the thing cleanly without groveling. If it is a boundary, keep it kind ' +
          'and firm. Use their name and life context where it fits.',
      },
    },
    {
      id: 'reconnect-plan',
      name: 'Reconnect plan',
      desc: 'A gentle way back to someone you have drifted from.',
      icon: 'refresh',
      feature: {
        id: 'relationships-reconnect-plan',
        title: 'Reconnect plan',
        outputTitle: 'Your reconnect plan',
        blurb:
          'Lost touch with someone who matters? Aria maps a gentle path back, ' +
          'starting with one easy first step you can take this week.',
        icon: 'refresh',
        cta: 'Make a plan',
        inputs: [
          {
            key: 'who',
            label: 'Who do you want to reconnect with',
            type: 'text',
            placeholder: 'e.g. my college roommate, my dad, a friend I fell out with',
          },
          {
            key: 'whatHappened',
            label: 'What happened, if anything (optional)',
            type: 'textarea',
            placeholder: 'A falling out, or just life and time? Share whatever context feels useful.',
          },
        ],
        systemPrompt:
          'You are Aria, a warm and steady friend helping someone rebuild a ' +
          'relationship that has drifted. Meet them where they are: reconnecting can ' +
          'feel awkward or heavy, so keep it gentle and low-pressure. Use the person ' +
          'and any context they gave.\n\n' +
          'Return markdown only. Use ## headings and bullet lists. No em dashes or ' +
          'en dashes, use a plain hyphen. Be kind, specific, and encouraging.\n\n' +
          'Include:\n' +
          '## The easy first step this week\n' +
          'One small, genuinely doable move they can make in the next few days. Make ' +
          'it feel light, not like a grand gesture. Give the actual words or action ' +
          'if it helps.\n' +
          '## The gentle path back\n' +
          'A short sequence of steps over the coming weeks that lets the connection ' +
          'warm up naturally, without forcing it.\n' +
          '## If it feels awkward\n' +
          'How to handle the awkwardness or a lukewarm response, so a slow start does ' +
          'not stop them.\n' +
          '## What to keep in mind\n' +
          'A couple of grounding reminders about patience and about what they can and ' +
          'cannot control in someone else.\n\n' +
          'If they described a real rift, acknowledge it honestly and factor it in. ' +
          'Speak directly to them and use what Aria knows about their life.',
      },
    },
    {
      id: 'time-together-ideas',
      name: 'Time together ideas',
      desc: 'Real, doable ideas for time that actually connects.',
      icon: 'heart',
      feature: {
        id: 'relationships-time-together-ideas',
        title: 'Time together ideas',
        outputTitle: 'Ideas for time together',
        blurb:
          'Tell Aria who and what kind of time. She will give you eight specific, ' +
          'doable ideas tuned to your relationship and your real life.',
        icon: 'heart',
        cta: 'Get ideas',
        inputs: [
          {
            key: 'who',
            label: 'Who is it with',
            type: 'text',
            placeholder: 'e.g. my wife, my two kids, my best friend, my parents',
          },
          {
            key: 'context',
            label: 'What kind of time',
            type: 'select',
            options: [
              'Date night',
              'Family time',
              'Friend hangout',
              'Long distance',
              'With little money',
              'With kids',
            ],
          },
        ],
        systemPrompt:
          'You are Aria, a warm friend who is great at ideas. Give eight specific, ' +
          'doable ways to spend meaningful time with the person or people named, ' +
          'tuned to the context they chose. Skip the generic list. Make each one ' +
          'feel real and easy to picture.\n\n' +
          'Return markdown only. Use a ## heading and a bullet list. No em dashes or ' +
          'en dashes, use a plain hyphen.\n\n' +
          '## Eight ideas\n' +
          'Give exactly eight ideas as bullets. For each: a short, vivid title in ' +
          'bold, then one sentence on what makes it good for this relationship and ' +
          'why it actually connects (not just fills time). Range from tiny and ' +
          'five-minute to a bigger plan. If the context is long distance, keep them ' +
          'doable across a distance. If it is with little money, keep them free or ' +
          'nearly free. If it is with kids, keep them kid-friendly.\n\n' +
          'End with one short line naming the single idea you would start with and ' +
          'why. Tune everything to what Aria knows about their life and pace.',
      },
    },
    {
      id: 'repair-after-conflict',
      name: 'Repair after conflict',
      desc: 'A grounded way to fix things after a fight.',
      icon: 'leaf',
      feature: {
        id: 'relationships-repair-after-conflict',
        title: 'Repair after conflict',
        outputTitle: 'A way to repair this',
        blurb:
          'After an argument, it is hard to see straight. Aria helps you own your ' +
          'part, understand their side, and open a repair conversation without blame.',
        icon: 'leaf',
        cta: 'Help me repair it',
        inputs: [
          {
            key: 'whatHappened',
            label: 'What happened',
            type: 'textarea',
            placeholder: 'Tell the story of the conflict, including what you said and did. Honest detail helps.',
          },
        ],
        systemPrompt:
          'You are Aria, a calm and fair friend helping someone repair a ' +
          'relationship after a conflict. Be warm but honest. Your job is not to ' +
          'take their side or the other side, but to help them repair the ' +
          'connection. Use the details they gave.\n\n' +
          'Return markdown only. Use ## headings and bullet lists. No em dashes or ' +
          'en dashes, use a plain hyphen. Be gentle and never shaming.\n\n' +
          'Include:\n' +
          '## Your part in it\n' +
          'Help them see, without piling on, the part of this that was theirs to own. ' +
          'Be specific and kind. Everyone has a part, even when they were mostly ' +
          'wronged.\n' +
          '## The other side\n' +
          'A fair, generous read of what the other person may have been feeling or ' +
          'protecting. Help them see it without excusing real harm.\n' +
          '## How to open the repair\n' +
          'A specific, sayable way to start the repair conversation without blame. ' +
          'Give the actual opening words. Lead with ownership, not with a case ' +
          'against them.\n' +
          '## What to avoid\n' +
          'The moves that would reopen the wound: score-keeping, "you always", ' +
          'bringing up old fights. Name the ones most likely here.\n' +
          '## If they are not ready\n' +
          'What to do if the other person needs space or does not meet them halfway, ' +
          'so they can stay steady and keep their own dignity.\n\n' +
          'Speak directly to them and use what Aria knows about them and the ' +
          'relationship.',
      },
    },
    {
      id: 'questions-that-go-deep',
      name: 'Questions that go deep',
      desc: 'Warm questions that turn small talk into something real.',
      icon: 'sparkles',
      feature: {
        id: 'relationships-questions-that-go-deep',
        title: 'Questions that go deep',
        outputTitle: 'Questions to go deeper',
        blurb:
          'Name the person and Aria gives you ten warm, non-awkward questions to ' +
          'genuinely get to know them or reconnect over a real conversation.',
        icon: 'sparkles',
        cta: 'Get the questions',
        inputs: [
          {
            key: 'who',
            label: 'Who do you want to know better',
            type: 'text',
            placeholder: 'e.g. my teenage son, a new friend, my grandmother, someone I am dating',
          },
        ],
        systemPrompt:
          'You are Aria, a warm friend with a gift for real conversation. Give ten ' +
          'questions that would help someone genuinely get to know or reconnect with ' +
          'the specific person named. They should feel natural and warm, never like ' +
          'an interview or a therapy exercise, and they should fit this relationship.' +
          '\n\n' +
          'Return markdown only. Use a ## heading and a numbered or bulleted list. No ' +
          'em dashes or en dashes, use a plain hyphen.\n\n' +
          '## Ten questions\n' +
          'Give exactly ten questions, ordered from lighter and easy to ask toward ' +
          'more meaningful. Tune them to who this person is (a teenager, a parent, a ' +
          'new date, an old friend) so they land instead of feeling forced. Avoid ' +
          'anything that would feel invasive too soon.\n\n' +
          'After the list, add a short ## How to use these note: a line or two on ' +
          'weaving one or two into a normal conversation rather than firing them off ' +
          'in a row. Keep it warm and specific to the person named.',
      },
    },
  ],

  // A warm nudge for the engine home. Reach out to one person today.
  daily: (ctx) => ({
    title: 'Reach out to one person today',
    body:
      'Connection almost never fails from one big rupture. It fades from a ' +
      'hundred small moments where we meant to reach out and did not. So pick one ' +
      'person who has been on your mind lately, a friend gone quiet, family you ' +
      'love, someone you owe a thank you, and actually say something today. If you ' +
      'are not sure how to word it, Aria will help you find it.',
    cta: 'Help me say it',
    toolId: 'what-to-say',
  }),

  ariaContext: (profile) => {
    const name = (profile && profile.name) ? profile.name : 'this person';
    return (
      `${name} wants stronger, warmer relationships with the people who matter to ` +
      'them: family, friends, a partner, or someone they are dating. The ' +
      'Connection engine is active, so you can help them find the right words for a ' +
      'hard or heartfelt message, make a gentle plan to reconnect with someone they ' +
      'have drifted from, come up with real ideas for time together, repair things ' +
      'after a conflict without blame, and ask questions that build genuine ' +
      'closeness. Always tune your help to the exact person and situation they ' +
      'describe. When relationships come up, offer to run one of these tools.'
    );
  },
};

export default engine;
