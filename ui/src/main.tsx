/* eslint-disable import/first */
// if (import.meta.env.VITE_ENABLE_WDYR) {
//   import.meta.glob('./wdyr.ts', { eager: true });
// }

/* eslint-disable */
import { EditorView } from 'prosemirror-view';

const oldUpdateState = EditorView.prototype.updateState;

EditorView.prototype.updateState = function updateState(state) {
  if (!(this as any).docView) {
    //return; // This prevents the matchesNode error on hot reloads
  }
  // (this as any).updateStateInner(state, this.state.plugins != state.plugins); //eslint-disable-line
  oldUpdateState.call(this, state);
};

import React from 'react';
import { render } from 'react-dom';
import { PostHogProvider } from 'posthog-js/react';
import App from './app';
import _api from './api';

import './styles/index.css';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import queryClient from './queryClient';
import indexedDBPersistor from './indexedDBPersistor';
import UpdateNotice from './components/UpdateNotice';

const IS_MOCK =
  import.meta.env.MODE === 'mock' || import.meta.env.MODE === 'staging';

if (IS_MOCK) {
  window.ship = 'finned-palmer';
  window.our = '~finned-palmer';
}

window.our = `~${window.ship}`;

const root = document.getElementById('app') as HTMLElement;
render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: indexedDBPersistor(`${window.our}-landscape`),
        buster: `${window.our}-landscape-4.0.1`,
      }}
    >
      <UpdateNotice />
      <PostHogProvider
        apiKey={import.meta.env.VITE_POSTHOG_KEY}
        options={{
          api_host: 'https://eu.posthog.com',
          opt_out_capturing_by_default: import.meta.env.DEV,
        }}
      >
        <App />
      </PostHogProvider>
    </PersistQueryClientProvider>
  </React.StrictMode>,
  root
);
