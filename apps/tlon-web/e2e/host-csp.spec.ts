import { expect, test } from '@playwright/test';

import { ENFORCE_HOST_CSP, HOST_CSP_POLICY } from '../hostCsp';
import {
  HOST_CSP_VIOLATION_BOUND,
  HOST_CSP_VIOLATION_GLOBAL,
  type HostCspViolationSnapshot,
} from '../src/logic/hostCspViolations';
import shipManifest from './shipManifest.json';

/**
 * END-TO-END CONTROL for the host-page CSP violation listener.
 *
 * Everything else about this policy is measured somewhere else:
 * sandbox-posture/navigation.spec.ts proves a `frame-src` allowlist
 * BLOCKS self-navigation on three engines, and
 * src/logic/hostCspViolations.test.ts proves the collector sanitises and
 * bounds. Neither of them touches the actual app, the actual dev server,
 * or the actual Report-Only delivery.
 *
 * This file does. It runs against the same `vite` server the rest of the
 * e2e suite runs against, and answers the one question the other two
 * cannot: does a REAL violation of the REAL policy, delivered the real
 * way, reach the listener — as opposed to merely reaching the console,
 * which is where a CSP violation goes whether anything is listening or
 * not.
 *
 * It reads and writes no ship state — the app is simply loaded and left
 * alone — but it does load it AUTHENTICATED, on ~zod's stored session.
 * An unauthenticated load bounces to `/~/login` while the probes are
 * still running, and a page that navigated out from under the collector
 * cannot say anything about it.
 */

/** Not `'self'` and not https://tlon.network, so the policy must refuse it. */
const BLOCKED_ORIGIN = 'https://csp-probe.invalid';

/**
 * Rides along in the path and query of the framed URL. Under Report-Only
 * the frame is not blocked, so this is a URL the browser really does try
 * to resolve — `.invalid` is reserved (RFC 6761) and cannot resolve, so
 * nothing leaves the machine either way.
 */
const PAYLOAD_MARKER = 'exfil-marker-4c1d9b';

/**
 * The flag decides which delivery the page carries, and therefore what
 * the engine reports. Asserting the disposition the flag implies, rather
 * than hardcoding `report`, is what keeps this file honest across the
 * flip: hardcoded, it would fail the day the policy started enforcing,
 * and the temptation would be to loosen the assertion rather than read
 * it.
 */
const EXPECTED_DISPOSITION = ENFORCE_HOST_CSP ? 'enforce' : 'report';

/**
 * The policy as the PAGE received it, by whichever route the flag
 * selected. hostCsp.ts guarantees exactly one of the two is present;
 * this returns that one, and fails loudly on none or both.
 */
async function deliveredPolicy(
  page: import('@playwright/test').Page,
  response: import('@playwright/test').Response | null
) {
  const header = response?.headers()['content-security-policy-report-only'];
  const metas = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('content')));

  if (ENFORCE_HOST_CSP) {
    expect(header).toBeUndefined();
    expect(metas).toEqual([HOST_CSP_POLICY]);
    return metas[0];
  }
  expect(metas).toEqual([]);
  return header;
}

function snapshot(page: import('@playwright/test').Page) {
  return page.evaluate((key) => {
    const collector = (
      window as unknown as Record<
        string,
        { snapshot: () => HostCspViolationSnapshot } | undefined
      >
    )[key];
    return collector ? collector.snapshot() : null;
  }, HOST_CSP_VIOLATION_GLOBAL);
}

/**
 * Frames `count` URLs and waits for the violations to be delivered.
 * `securitypolicyviolation` is queued as a task, so the frames have to be
 * given a turn of the event loop before the collector is read.
 */
async function frameBlockedUrls(
  page: import('@playwright/test').Page,
  urls: string[]
) {
  await page.evaluate(async (targets) => {
    for (const url of targets) {
      const frame = document.createElement('iframe');
      frame.style.display = 'none';
      frame.src = url;
      document.body.appendChild(frame);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, urls);
}

test.describe('host-page CSP', () => {
  test.use({ storageState: shipManifest['~zod'].authFile });

  test.beforeEach(async ({ page }) => {
    const response = await page.goto('/apps/groups/');
    // the delivery itself, asserted rather than assumed: if the policy
    // ever stops reaching the page, every other assertion in this file
    // passes vacuously
    expect(await deliveredPolicy(page, response)).toBe(HOST_CSP_POLICY);
    // the app has to have finished booting: the probes run in the page,
    // and a document navigation mid-probe would destroy the collector
    // being measured
    await page.waitForSelector('text=Home', { state: 'visible' });
    await page.waitForFunction(
      (key) => key in window,
      HOST_CSP_VIOLATION_GLOBAL
    );
  });

  test('a synthetic violation is collected exactly once, without its payload', async ({
    page,
  }) => {
    const target = `${BLOCKED_ORIGIN}/${PAYLOAD_MARKER}?stolen=${PAYLOAD_MARKER}#${PAYLOAD_MARKER}`;
    await frameBlockedUrls(page, new Array(20).fill(target));

    const collected = await snapshot(page);
    expect(collected).not.toBeNull();

    // ONE event for twenty identical violations, and the other nineteen
    // accounted for rather than silently gone
    expect(collected!.emitted).toBe(1);
    expect(collected!.records).toHaveLength(1);
    expect(collected!.dropped).toBe(19);
    expect(collected!.bound).toBe(HOST_CSP_VIOLATION_BOUND);

    const [record] = collected!.records;
    expect(record).toMatchObject({
      seq: 1,
      directive: 'frame-src',
      disposition: EXPECTED_DISPOSITION,
      policy: 'host-frame-src',
      blockedKind: 'origin',
      blockedScheme: 'https',
      blockedHost: 'csp-probe.invalid',
      blockedHostTruncated: false,
      blockedHostRewritten: false,
    });
    expect(record.blockedUriHash).toMatch(/^[0-9a-f]{8}$/);

    // the payload the framed URL carried appears nowhere in what was
    // collected — this is the property the whole sanitiser exists for
    expect(JSON.stringify(collected)).not.toContain(PAYLOAD_MARKER);
  });

  test('distinct violations stop at the bound', async ({ page }) => {
    await frameBlockedUrls(
      page,
      Array.from({ length: 20 }, (_, i) => `https://csp-probe-${i}.invalid/`)
    );

    const collected = await snapshot(page);
    expect(collected!.emitted).toBe(HOST_CSP_VIOLATION_BOUND);
    expect(collected!.records).toHaveLength(HOST_CSP_VIOLATION_BOUND);
    expect(collected!.dropped).toBe(20 - HOST_CSP_VIOLATION_BOUND);
    expect(collected!.records.map((r) => r.seq)).toEqual([1, 2, 3, 4, 5]);
  });

  test('an allowlisted origin produces no violation at all', async ({
    page,
  }) => {
    // the mechanism control. Without it, "no violations were collected"
    // during the Report-Only evidence run could equally mean the listener
    // is dead, so this frames the one non-'self' origin the policy DOES
    // allow — the account frame at ManageAccountScreen.tsx:94 — and
    // requires silence to be silence about that origin specifically,
    // while the test above proves the same listener does fire.
    //
    // The request is aborted at the network layer. CSP is evaluated in
    // the renderer BEFORE the request is issued, so the allow/refuse
    // decision under test is unchanged and the suite makes no live call
    // to tlon.network.
    await page.route('https://tlon.network/**', (route) => route.abort());
    await frameBlockedUrls(page, ['https://tlon.network/account']);

    const collected = await snapshot(page);
    expect(collected!.records).toEqual([]);
    expect(collected!.emitted).toBe(0);
    expect(collected!.dropped).toBe(0);
  });
});
