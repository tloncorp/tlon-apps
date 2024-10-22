// if (import.meta.env.VITE_ENABLE_WDYR) {
//   import.meta.glob('./wdyr.ts', { eager: true });
// }

/* eslint-disable */
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { EditorView } from '@tiptap/pm/view';
import { setupDb } from '@tloncorp/app/lib/webDb';
import { PostHogProvider } from 'posthog-js/react';
import React from 'react';
import { createRoot } from 'react-dom/client';
// At some point recently, we started getting a "regeneratorRuntime is not defined" error
// when running the app in development mode. This is a workaround for that issue.
// This is a temporary fix until we can figure out why this is happening.
// This was most likely caused by a recent dependency change.
import regeneratorRuntime from '@babel/runtime/regenerator';

import _api from './api';
import App from './app';
import indexedDBPersistor from './indexedDBPersistor';
import { analyticsClient, captureError } from './logic/analytics';
import queryClient from './queryClient';
import './styles/index.css';

window.regeneratorRuntime = regeneratorRuntime;

setupDb().then(() => {
  const oldUpdateState = EditorView.prototype.updateState;

  EditorView.prototype.updateState = function updateState(state) {
    if (!(this as any).docView) {
      //return; // This prevents the matchesNode error on hot reloads
    }
    // (this as any).updateStateInner(state, this.state.plugins != state.plugins); //eslint-disable-line
    oldUpdateState.call(this, state);
  };

  const IS_MOCK =
    import.meta.env.MODE === 'mock' || import.meta.env.MODE === 'staging';

  if (IS_MOCK) {
    window.ship = 'finned-palmer';
    window.our = '~finned-palmer';
  }

  window.our = `~${window.ship}`;

  window.addEventListener('error', (e) => {
    captureError('window', e.error);
  });

  const container = document.getElementById('app') as HTMLElement;
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: indexedDBPersistor(`${window.our}-landscape`),
          buster: `${window.our}-landscape-4.0.1`,
        }}
      >
        <PostHogProvider client={analyticsClient}>
          <App />
        </PostHogProvider>
      </PersistQueryClientProvider>
    </React.StrictMode>
  );
});
