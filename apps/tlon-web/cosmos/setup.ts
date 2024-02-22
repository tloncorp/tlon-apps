/*
 * This file sets up the cosmos environment. It's loaded by `cosmos.config.ts`
 * and is run before loading any other scripts or components.
 */
import useDocketState from '@/state/docket';
import useKilnState from '@/state/kiln';
import usePalsState from '@/state/pals';
import useSchedulerStore from '@/state/scheduler';
import '@/styles/cosmos.css';
// Since cosmos replaces `main.ts` we need to import styles here
import '@/styles/index.css';
import { rest, setupWorker } from 'msw';

import chargesResponse from './fixtures/charges.json';
import lagResponse from './fixtures/lag.json';
import palsResponse from './fixtures/pals.json';
import pikesResponse from './fixtures/pikes.json';

// Global properties
Object.defineProperty(window, 'ship', {
  writable: true,
  value: 'finned-palmer',
});
Object.defineProperty(window, 'our', {
  writable: true,
  value: '~finned-palmer',
});

// Set up service worker to mock api calls
const server = setupWorker(
  rest.get('/~/scry/docket/charges.json', (req, res, ctx) =>
    res(ctx.body(JSON.stringify(chargesResponse)))
  ),
  rest.get('/~/scry/hood/kiln/pikes.json', (req, res, ctx) =>
    res(ctx.body(JSON.stringify(pikesResponse)))
  ),
  rest.get('/~/scry/hood/kiln/lag.json', (req, res, ctx) =>
    res(ctx.body(JSON.stringify(lagResponse)))
  ),
  rest.get('/~/scry/pals/json.json', (req, res, ctx) =>
    res(ctx.body(JSON.stringify(palsResponse)))
  )
);

server
  .start({
    onUnhandledRequest: 'bypass',
    serviceWorker: {
      url: '/apps/groups/mockServiceWorker.js',
    },
  })
  .then(() => {
    // Run initializers after the mock service worker is setup so that they
    // receive mocked data.
    useKilnState.getState().initializeKiln();
    useDocketState.getState().fetchCharges();
    useSchedulerStore.getState().start(0);
    usePalsState.getState().fetchPals();
  })
  .catch((e) => console.log(e));
