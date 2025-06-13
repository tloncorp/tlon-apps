// if (import.meta.env.VITE_ENABLE_WDYR) {
//   import.meta.glob('./wdyr.ts', { eager: true });
// }

/* eslint-disable */
// At some point recently, we started getting a "regeneratorRuntime is not defined" error
// when running the app in development mode. This is a workaround for that issue.
// This is a temporary fix until we can figure out why this is happening.
// This was most likely caused by a recent dependency change.
import regeneratorRuntime from '@babel/runtime/regenerator';
import { EditorView } from '@tiptap/pm/view';
import { ENABLED_LOGGERS } from '@tloncorp/app/constants';
import { loadConstants } from '@tloncorp/app/lib/constants';
import {
  AnalyticsEvent,
  addCustomEnabledLoggers,
  createDevLogger,
} from '@tloncorp/shared';
import { QueryClientProvider, queryClient } from '@tloncorp/shared/api';
import { PostHogProvider } from 'posthog-js/react';
import { createRoot } from 'react-dom/client';

import App from './app';
import { isElectron } from './electron-bridge';
import { analyticsClient, captureError } from './logic/analytics';
import './styles/index.css';

const logger = createDevLogger('main.tsx', false);

// Conditionally import the appropriate database implementation
const { setupDb } = isElectron()
  ? await import('@tloncorp/app/lib/electronDb')
  : await import('@tloncorp/app/lib/webDb');

loadConstants();
addCustomEnabledLoggers(ENABLED_LOGGERS);

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

  const container = document.getElementById('app') as HTMLElement;
  const root = createRoot(container);
  root.render(
    // Strict mode disabled as it breaks react-navigation on web
    // <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <PostHogProvider client={analyticsClient}>
        <App />
      </PostHogProvider>
    </QueryClientProvider>
    // </React.StrictMode>
  );
});
