// Aria's daily message - composed locally and deterministically from THEIR
// real data (profile, tone, mood trend, streaks, people, wins). Grounded, not
// generated: every clause traces to something in the store, so it works
// offline and never fabricates. Varies by day so it never feels canned.
import { getProfile, getGoals, moodTrend, peopleNeedingTouch, throwback, getTodayCheckin, isGoalDueToday } from './store.js';

const dayIdx = () => {
  const now = new Date();
  return now.getFullYear() * 366 + Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
};
const pick = (arr) => arr[dayIdx() % arr.length];

const OPENERS = {
  nurturer: ['Good to see you', 'Hey, no pressure today', 'I am glad you are here', 'Take a breath first'],
  coach: ['Alright, today is workable', 'Good, you showed up', 'Here is the shape of today', 'Let us keep the thing moving'],
  challenger: ['You know why you are here', 'No hiding today', 'Let us not waste this one', 'You said you wanted this'],
};

export function dailyMessage() {
  const p = getProfile();
  if (!p) return null;
  const tone = p.tone || 'coach';
  const parts = [];
  parts.push(`${pick(OPENERS[tone] || OPENERS.coach)}, ${p.name}.`);

  const mt = moodTrend();
  const today = getTodayCheckin();
  const goals = getGoals().filter(g => g.status === 'active');
  const due = goals.filter(isGoalDueToday);
  const hot = goals.filter(g => g.streak >= 3).sort((a, b) => b.streak - a.streak)[0];
  const cold = due.sort((a, b) => (a.lastDoneAt || '0').localeCompare(b.lastDoneAt || '0'))[0];
  const person = peopleNeedingTouch()[0];

  if (today && today.mood <= 2) {
    parts.push(tone === 'nurturer'
      ? 'You marked today as heavy. That is allowed. One small thing, done gently, still counts.'
      : tone === 'challenger'
        ? 'You logged a rough one. Rough days are where streaks are actually made - do the smallest version, but do it.'
        : 'You logged a low one today. Shrink the plan, keep the promise: the smallest version of one goal is enough.');
  } else if (mt && mt.avg >= 4) {
    parts.push(`Your week is trending good (${mt.avg} of 5). Spend that energy on purpose today.`);
  }

  if (hot) parts.push(`${hot.streak} in a row on "${hot.title}" - ${tone === 'challenger' ? 'do not be the one who breaks it.' : 'that is becoming who you are.'}`);
  if (cold && (!hot || cold.id !== hot.id)) parts.push(`"${cold.title}" is waiting on you today.`);
  if (person) parts.push(`And ${person.name} has not heard from you in a while. You said that mattered.`);

  const tb = throwback();
  if (tb && parts.length < 5) parts.push(`Remember, this was you: "${tb.text}"`);

  if (parts.length === 1) parts.push('Your slate is clean. Pick one thing that would make tonight feel earned.');
  return parts.join(' ');
}
