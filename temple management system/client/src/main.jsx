import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AppProvider } from './auth/AppContext.jsx';
import { startSyncEngine } from './db/syncEngine.js';
import { applyBranding } from './branding.js';
import './theme/tokens.css';

applyBranding();
startSyncEngine();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
