import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ToastHost } from './components/UI.jsx';
import { initSync } from './lib/sync.js';
import { registerServiceWorker } from './lib/push.js';
import { initTracking } from './lib/track.js';
import './index.css';

// Durable layer: pull the server record on sign-in, push changes as they happen.
initSync();
// PWA: installable + offline shell + push receiver. Safe no-op where unsupported.
registerServiceWorker();
// Telemetry: local return-visit signal + batched, content-free events to the
// server so the admin dashboard can see activation and engagement.
initTracking();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastHost>
        <App />
      </ToastHost>
    </BrowserRouter>
  </React.StrictMode>
);
