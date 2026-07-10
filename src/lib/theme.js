// Light/dark toggle. Kindred defaults to warm light; dark is candlelight.
import { useEffect, useState } from 'react';

const KEY = 'kindred_theme';
let listeners = new Set();

export function getTheme() {
  try { return localStorage.getItem(KEY) || 'light'; } catch { return 'light'; }
}
export function applyTheme() {
  document.documentElement.setAttribute('data-theme', getTheme());
}
export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(KEY, next); } catch {}
  document.documentElement.setAttribute('data-theme', next);
  listeners.forEach(fn => fn(next));
}
export function useTheme() {
  const [t, setT] = useState(getTheme());
  useEffect(() => { const fn = (v) => setT(v); listeners.add(fn); return () => listeners.delete(fn); }, []);
  return t;
}
