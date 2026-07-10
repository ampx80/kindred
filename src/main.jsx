import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ToastHost } from './components/UI.jsx';
import { initSync } from './lib/sync.js';
import { registerServiceWorker } from './lib/push.js';
import { pingVisit } from './lib/analytics.js';
import './index.css';

// Durable layer: pull the server record on sign-in, push changes as they happen.
initSync();
// PWA: installable + offline shell + push receiver. Safe no-op where unsupported.
registerServiceWorker();
// Local, anonymous return-visit signal (no content leaves the device).
pingVisit();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastHost>
        <App />
      </ToastHost>
    </BrowserRouter>
  </React.StrictMode>
);
