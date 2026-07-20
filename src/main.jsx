import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ToastHost } from './components/UI.jsx';
import { initSync } from './lib/sync.js';
import { registerServiceWorker } from './lib/push.js';
import { initTracking } from './lib/track.js';
import { initNative, isNative } from './lib/native.js';
import { initGame } from './lib/game.js';
import { initAriaNudges } from './lib/ariaNudges.js';
import './index.css';

// Native shell (Capacitor iOS/Android): route API calls to production, theme the
// status bar, wire the back button and keyboard, add safe-area insets, register
// native push, and dismiss the splash. Inert on the web. Run this first so the
// API router is installed before anything fetches.
initNative();
// Durable layer: pull the server record on sign-in, push changes as they happen.
initSync();
// PWA: installable + offline shell + push receiver. On the web only; the native
// shell uses native push instead of a service worker.
if (!isNative()) registerServiceWorker();
// Telemetry: local return-visit signal + batched, content-free events to the
// server so the admin dashboard can see activation and engagement.
initTracking();
// Engagement engine: turns every real action into XP, levels, sparks, quests,
// and achievements. Must init after tracking so it hears the event bus.
initGame();
// Proactive, well-timed warmth from Aria so the app reaches out, not just waits.
initAriaNudges();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastHost>
        <App />
      </ToastHost>
    </BrowserRouter>
  </React.StrictMode>
);
