import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  assessScrollContentTrace,
  type ScrollContentContract,
} from '../../../packages/app/fixtures/scrollContentTrace';

import {
  assessScrollChromeTrace,
  type ScrollChromeContract,
} from '../../../packages/app/fixtures/scrollChromeTrace';
import * as helpers from './helpers';
import { startScrollContentTrace } from './helpers/scrollContent';
import {
  startScrollChromeTrace,
  type BrowserChromeTrace,
} from './helpers/scrollChrome';
import {
  expectAnchorStable,
  expectBottomLanding,
  expectBottomPinned,
  expectScrollDirection,
  expectTargetLanding,
  expectValidScrollTrace,
  resolvePostScroller,
  settlePostScroller,
  startScrollTrace,
  type ScrollTrace,
  wheelToHistory,
} from './helpers/scrollers';
import {
  viewport,
  history,
  post,
  postId,
  send,
  loadingImagePng,
  readImageEssay,
  prepareDelayedImage,
} from './helpers/scrollerContentScenario';
import { testWithOptions } from './test-fixtures';

const test = testWithOptions({ appReadyTimeoutMs: 60_000, e2eMode: false });

// Continuous DOM evidence for AC-01/02/04/18. These are sampled browser
// geometry regressions, not a substitute for native/compositor frame pacing.
// Every product case uses real UI or test-local backend mutations and asserts its terminal state
// before observing a one-second quiet tail. No synthetic DOM mutation is used
// outside the explicitly named detector self-tests below.
// Desktop width with a short window height; mobile web is outside suite scope.
async function prepareHistory(page: Page, inThread = false) {
  // test-fixtures creates its own BrowserContext; test.use(viewport) alone
  // would silently leave this page at the default dimensions.
  await page.setViewportSize(viewport);
  await helpers.createGroup(page);
  await helpers.navigateToChannel(page, 'General');
  if (inThread) {
    await send(page, 'Scroll stability thread parent', false, 30_000);
    await helpers.startThread(page, 'Scroll stability thread parent');
  }
  // Seeding is setup, not a message-delivery latency assertion. Keep the
  // scenario send deadline unchanged while tolerating a cold local test ship.
  for (const text of history) await send(page, text, inThread, 30_000);
  await expect(page.getByTestId('ChatMessageDeliveryStatus')).toHaveCount(0);
  const scroller = await resolvePostScroller(post(page, history.at(-1)!));
  await settlePostScroller(scroller);
  return scroller;
}

// Exercise the actual presence agent and its subscription path. A local test
// ship can publish computing presence without running an external bot. The
// authenticated request context shares this test's browser cookies; a fresh
// Eyre channel is closed after every operation, and the scry confirms the
// mutation was applied (an HTTP PUT alone is only transport acknowledgement).
async function setComputingPresence(
  page: Page,
  active: boolean,
  observer: Page
) {
  const origin = new URL(page.url()).origin;
  expect(['http://localhost:3000', 'http://localhost:3002']).toContain(origin);
  const channelId = decodeURIComponent(
    new URL(page.url()).pathname.split('/channel/')[1] ?? ''
  ).replace(/\/$/, '');
  expect(channelId).toMatch(/^chat\/~[^/]+\/[^/]+$/);
  const context = `/channel/${channelId}`;
  const ship = await page.evaluate(() => (window as any).ship as string);
  expect(['zod', 'ten']).toContain(ship);
  const key = { context, ship: `~${ship}`, topic: 'computing' };
  const json = active
    ? {
        set: {
          key,
          disclose: [],
          timeout: null,
          display: {
            icon: null,
            text: 'Scroll stability computing',
            blob: JSON.stringify({
              protocol: 'tlon.computing-status.v1',
              thinking: true,
              toolCalls: [],
            }),
          },
        },
      }
    : { clear: key };
  const airlock = `${origin}/~/channel/scroller-${randomUUID()}`;
  try {
    const response = await page.request.put(airlock, {
      data: [
        {
          id: 1,
          action: 'poke',
          ship,
          app: 'presence',
          mark: 'presence-action-1',
          json,
        },
      ],
    });
    expect(response.ok(), 'Presence poke transport succeeded').toBe(true);
    await expect
      .poll(
        async () => {
          // The host excludes the sender from its fanout, so verify the
          // actual observer/host whose UI this test records.
          const observerOrigin = new URL(observer.url()).origin;
          expect(['http://localhost:3000', 'http://localhost:3002']).toContain(
            observerOrigin
          );
          const state = await observer.request.get(
            `${observerOrigin}/~/scry/presence/v1/init.json`
          );
          expect(state.ok(), 'Presence agent is available').toBe(true);
          const body = await state.json();
          expect(body).toHaveProperty('init');
          return Boolean(body.init[context]?.computing?.[`~${ship}`]);
        },
        { timeout: 10_000 }
      )
      .toBe(active);
  } finally {
    const closed = await page.request.post(airlock, {
      data: [{ id: 2, action: 'delete' }],
    });
    expect(closed.ok(), 'Test-owned presence airlock closed').toBe(true);
  }
}

async function expectFullyInViewport(
  row: Locator,
  scroller: Awaited<ReturnType<typeof resolvePostScroller>>,
  testInfo: TestInfo
) {
  let assertionError: unknown;
  try {
    // CSS scroll metrics round to integers while row rectangles retain subpixels.
    // Enforce the matrix's one-CSS-pixel bound directly, including each edge.
    await expect
      .poll(async () =>
        row.evaluate((element, list) => {
          const box = element.getBoundingClientRect();
          const viewport = list.getBoundingClientRect();
          if (!element.isConnected || box.width <= 0 || box.height <= 0)
            return Infinity;
          return Math.max(
            0,
            Math.max(0, viewport.top + list.clientTop) - box.top,
            box.bottom -
              Math.min(
                window.innerHeight,
                viewport.top + list.clientTop + list.clientHeight
              ),
            Math.max(0, viewport.left + list.clientLeft) - box.left,
            box.right -
              Math.min(
                window.innerWidth,
                viewport.left + list.clientLeft + list.clientWidth
              )
          );
        }, scroller)
      )
      .toBeLessThanOrEqual(1);
  } catch (error) {
    assertionError = error;
  }
  // Capture the terminal geometry before fixture cleanup can delete the group.
  // IntersectionObserver also detects clipping by intermediate ancestors.
  try {
    const handle = await row.elementHandle({ timeout: 1000 });
    if (!handle) throw new Error('Target missing during viewport diagnostics');
    const geometry = await handle.evaluate(async (element, list) => {
      const rect = (node: Element) => {
        const box = node.getBoundingClientRect();
        return {
          top: box.top,
          bottom: box.bottom,
          left: box.left,
          right: box.right,
          width: box.width,
          height: box.height,
        };
      };
      const target = rect(element);
      const listRect = rect(list);
      const viewport = {
        top: listRect.top + list.clientTop,
        bottom: listRect.top + list.clientTop + list.clientHeight,
        left: listRect.left + list.clientLeft,
        right: listRect.left + list.clientLeft + list.clientWidth,
      };
      const intersection = await new Promise<{
        ratio: number;
        top: number;
        bottom: number;
        left: number;
        right: number;
        width: number;
        height: number;
      }>((resolve, reject) => {
        const observer = new IntersectionObserver(([entry]) => {
          clearTimeout(deadline);
          observer.disconnect();
          const box = entry.intersectionRect;
          resolve({
            ratio: entry.intersectionRatio,
            top: box.top,
            bottom: box.bottom,
            left: box.left,
            right: box.right,
            width: box.width,
            height: box.height,
          });
        });
        const deadline = setTimeout(() => {
          observer.disconnect();
          reject(new Error('Viewport diagnostic observer did not return'));
        }, 1000);
        observer.observe(element);
      });
      return {
        postId: element.getAttribute('data-postid'),
        target,
        viewport,
        intersection,
        clipPixels: {
          top: Math.max(0, viewport.top - target.top),
          bottom: Math.max(0, target.bottom - viewport.bottom),
          left: Math.max(0, viewport.left - target.left),
          right: Math.max(0, target.right - viewport.right),
        },
        scrollTop: list.scrollTop,
        scrollHeight: list.scrollHeight,
        clientHeight: list.clientHeight,
        clientWidth: list.clientWidth,
        devicePixelRatio: window.devicePixelRatio,
      };
    }, scroller);
    await testInfo.attach('terminal-target-viewport', {
      body: JSON.stringify(geometry, null, 2),
      contentType: 'application/json',
    });
    await handle.dispose();
    expect(geometry.intersection.width).toBeGreaterThan(0);
    expect(geometry.intersection.height).toBeGreaterThan(0);
    expect(
      Math.max(
        0,
        geometry.intersection.top - geometry.target.top,
        geometry.target.bottom - geometry.intersection.bottom,
        geometry.intersection.left - geometry.target.left,
        geometry.target.right - geometry.intersection.right
      )
    ).toBeLessThanOrEqual(1);
  } catch (error) {
    assertionError ??= error;
    await testInfo.attach('terminal-target-viewport-error', {
      body: String(error),
      contentType: 'text/plain',
    });
  }
  if (assertionError) throw assertionError;
}

async function recordMutation(
  scroller: Awaited<ReturnType<typeof resolvePostScroller>>,
  testInfo: TestInfo,
  label: string,
  action: (
    recording: Awaited<ReturnType<typeof startScrollTrace>>
  ) => Promise<void>,
  anchorIds: string[] = []
) {
  const recording = await startScrollTrace(scroller, anchorIds);
  let trace: Awaited<ReturnType<typeof recording.stop>>;
  try {
    await recording.mark(`${label}:start`);
    await action(recording);
    await recording.mark(`${label}:terminal-state`);
    await recording.settle(1000);
  } finally {
    // Attach even when the action or settling fails, preserving the first bad
    // frame rather than losing evidence behind a Playwright timeout.
    trace = await recording.stop(testInfo, label);
    await testInfo.attach(`${label}-summary`, {
      body: JSON.stringify(
        {
          sampleCount: trace.frames.length,
          coalescedSamples: trace.coalescedSamples ?? 0,
          errors: trace.errors,
          maxFrameGapMs: Math.max(
            0,
            ...trace.frames
              .slice(1)
              .map((frame, index) => frame.time - trace.frames[index].time)
          ),
          maxBottomGap: Math.max(
            0,
            ...trace.frames.map((frame) => Math.abs(frame.bottomGap))
          ),
        },
        null,
        2
      ),
      contentType: 'application/json',
    });
  }
  return trace;
}

const calibration = {
  annotation: {
    type: 'evidence-kind',
    description: 'scroller-detector-calibration',
  },
};

test.describe('Scroller detector self-tests', calibration, () => {
  for (const fault of ['healthy', 'child-hidden', 'ancestor-hidden'] as const) {
    test(`content collector observes a real held image lifecycle (${fault})`, async ({
      page,
    }, testInfo) => {
      const src = `http://scroller.test/${randomUUID()}.png`;
      const caption = 'Content collector calibration';
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let requested = false;
      let fulfillment: Promise<void> | undefined;
      const route = (request: import('@playwright/test').Route) => {
        requested = true;
        fulfillment = gate.then(() =>
          request.fulfill({
            status: 200,
            contentType: 'image/png',
            body: loadingImagePng,
          })
        );
        return fulfillment;
      };
      await page.route(src, route);
      let content:
        | Awaited<ReturnType<typeof startScrollContentTrace>>
        | undefined;
      try {
        await page.setContent(
          `<main id="content-list" style="height:500px;width:700px;overflow:auto"><div style="height:600px"></div><article data-postid="content-calibration"><span>${caption}</span><div data-expoimage="true" style="width:600px;height:300px;overflow:hidden"><img src="${src}" style="width:600px;height:300px;display:block"></div></article></main>`,
          { waitUntil: 'domcontentloaded' }
        );
        await expect.poll(() => requested).toBe(true);
        const scroller = await page.$('main');
        if (!scroller) throw new Error('Missing content calibration scroller');
        const row = (await page
          .locator('[data-postid="content-calibration"]')
          .elementHandle())!;
        await scroller.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        content = await startScrollContentTrace(scroller, row, src, caption);
        await content.wait(250);
        const releaseTime = await content.mark('response-release');
        release();
        await expect.poll(content.decoded).toBe(true);
        const terminalTime = await content.mark('terminal-ready');
        if (fault !== 'healthy') {
          await content.wait(100);
          const target =
            fault === 'child-hidden'
              ? page.locator('img')
              : page.locator('[data-postid]');
          await target.evaluate((element) => {
            element.style.opacity = '0';
          });
          await content.wait(50);
          await target.evaluate((element) => {
            element.style.opacity = '1';
          });
        }
        await content.wait(1000);
        const raw = await content.stop(testInfo, `content-collector-${fault}`);
        const contract: ScrollContentContract = {
          scope: content.scope,
          rowId: 'content-calibration',
          src,
          caption,
          releaseTime,
          terminalTime,
          coverage: {
            startTime: raw.samples[0].time,
            endTime: terminalTime + 1000,
            maxGapMs: 100,
            maxMeasurementDurationMs: 32,
          },
        };
        content = undefined;
        const result = assessScrollContentTrace(raw, contract);
        await testInfo.attach(`content-collector-${fault}-result`, {
          body: JSON.stringify(result),
          contentType: 'application/json',
        });
        expect(result.verdict, JSON.stringify(result)).toBe(
          fault === 'healthy' ? 'PASS' : 'FAIL'
        );
        if (fault !== 'healthy')
          expect(
            result.issues.some((issue) => issue.code === 'hidden-image-element')
          ).toBe(true);
      } finally {
        if (content)
          await content.stop(testInfo, `content-collector-${fault}-aborted`);
        release();
        await fulfillment?.catch(() => undefined);
        await page.unroute(src, route);
      }
    });
  }

  async function specimen(page: Page) {
    await page.setContent(
      '<div style="height:100px;overflow-y:auto"><div data-postid="anchor" style="height:40px">anchor</div><div style="height:1000px">overflow</div></div>'
    );
    return resolvePostScroller(page.locator('[data-postid="anchor"]'));
  }

  test('rejects a transient jump even when the final anchor returns', async ({
    page,
  }, testInfo) => {
    const scroller = await specimen(page);
    const recording = await startScrollTrace(scroller, ['anchor']);
    await scroller.evaluate(async (element) => {
      element.scrollTop = 30;
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      element.scrollTop = 0;
    });
    await recording.settle();
    const trace = await recording.stop(testInfo);
    expect(trace.frames.at(-1)!.anchors.anchor.top).toBe(0);
    expect(() => expectAnchorStable(trace, 'anchor')).toThrow('Anchor drift');
  });

  test('rejects an anchor missing for one frame even when it returns', async ({
    page,
  }, testInfo) => {
    const scroller = await specimen(page);
    const recording = await startScrollTrace(scroller, ['anchor']);
    await scroller.evaluate(async (element) => {
      const row = element.querySelector('[data-postid="anchor"]')!;
      row.removeAttribute('data-postid');
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      row.setAttribute('data-postid', 'anchor');
    });
    const trace = await recording.stop(testInfo);
    expect(
      trace.errors.some((error) => error.includes('Expected one anchor'))
    ).toBe(true);
    expect(() => expectValidScrollTrace(trace)).toThrow();
  });

  test('rejects non-overflowing and hidden wrappers', async ({ page }) => {
    await page.setContent(
      '<div style="height:100px;overflow-y:auto"><div data-postid="anchor">short</div></div>'
    );
    await expect(
      resolvePostScroller(page.locator('[data-postid="anchor"]'))
    ).rejects.toThrow('overflow');
    await page.setContent(
      '<div style="height:100px;overflow:hidden"><div data-postid="anchor" style="height:1000px">hidden</div></div>'
    );
    await expect(
      resolvePostScroller(page.locator('[data-postid="anchor"]'))
    ).rejects.toThrow('No scrollable ancestor');
  });

  test('rejects stable but incorrect bottom and target landings', async ({
    page,
  }, testInfo) => {
    const scroller = await specimen(page);
    await scroller.evaluate((element) => {
      element.scrollTop = 20;
    });
    const recording = await startScrollTrace(scroller, ['anchor']);
    await recording.settle(1000);
    const trace = await recording.stop(testInfo);
    expect(() => expectBottomLanding(trace)).toThrow('Bottom gap');
    expect(() => expectTargetLanding(trace, 'anchor')).toThrow(
      'Target landing error'
    );
  });

  test('coalesces identical clock samples but rejects changed geometry at the same instant', async ({
    page,
  }, testInfo) => {
    const scroller = await specimen(page);
    const clock = await page.evaluateHandle(() => {
      const original = performance.now.bind(performance);
      const descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
      let frozen: number | undefined;
      Object.defineProperty(performance, 'now', {
        configurable: true,
        value: () => frozen ?? Math.floor(original() / 50) * 50,
      });
      return {
        freeze() {
          frozen = Math.floor(original() / 50) * 50;
        },
        restore() {
          if (descriptor) Object.defineProperty(performance, 'now', descriptor);
          else delete (performance as any).now;
        },
      };
    });
    try {
      const stable = await startScrollTrace(scroller, ['anchor']);
      await stable.settle(300);
      const positive = await stable.stop(testInfo, 'coalesced-stable-clock');
      expectValidScrollTrace(positive);
      expect(positive.coalescedSamples).toBeGreaterThan(0);
      await clock.evaluate((value) => value.freeze());
      const changing = await startScrollTrace(scroller, ['anchor']);
      await scroller.evaluate(async (element) => {
        for (let index = 1; index <= 8; index++) {
          element.scrollTop = index * 2;
          await new Promise(requestAnimationFrame);
        }
      });
      const negative = await changing.stop(
        testInfo,
        'same-clock-changed-geometry'
      );
      expect(negative.frames.length).toBeGreaterThanOrEqual(6);
      expect(() => expectValidScrollTrace(negative)).toThrow(
        'Frame timestamps must advance'
      );
    } finally {
      await clock.evaluate((value) => value.restore());
      await clock.dispose();
    }
  });

  test('chrome capture detects a brief ancestor-opacity flash despite a stable wrapper', async ({
    page,
  }, testInfo) => {
    await page.setContent(
      `<div id="list" style="width:400px;height:100px;overflow:auto"><div data-postid="one" style="height:600px">Loaded content</div></div><div id="chrome-parent"><div data-testid="ScrollToBottomButton" style="width:48px;height:48px"><svg width="24" height="24"><path d="M0 0 L20 20" /></svg></div></div>`
    );
    const scroller = await resolvePostScroller(
      page.locator('[data-postid="one"]')
    );
    for (const flash of ['healthy', 'ancestor', 'child'] as const) {
      const capture = await startScrollChromeTrace(scroller, 'press-latest');
      await capture.wait(250);
      await page.getByTestId('ScrollToBottomButton').click();
      if (flash !== 'healthy')
        await page.evaluate(async (flash) => {
          const target =
            flash === 'ancestor'
              ? document.getElementById('chrome-parent')!
              : document.querySelector('svg')!;
          target.style.opacity = '0';
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
          target.style.opacity = '1';
        }, flash);
      await capture.wait(300);
      const trace = await capture.stop(testInfo, `chrome-detector-${flash}`);
      const startTime = trace.samples[0].time;
      const endTime = trace.samples.at(-1)!.time;
      const result = assessScrollChromeTrace(trace, {
        scope: capture.scope,
        coverage: {
          startTime,
          endTime,
          maxGapMs: 100,
          maxMeasurementDurationMs: 32,
        },
        action: { id: 'press-latest', startTime, endTime },
        phases: [
          {
            id: 'stable',
            startTime,
            endTime,
            loading: false,
            semanticState: 'list-visible',
            controls: [{ id: 'latest', kind: 'icon', visibility: 'visible' }],
          },
        ],
        transitions: [],
      });
      expect(trace.errors).toEqual([]);
      expect(result.verdict, JSON.stringify(result, null, 2)).toBe(
        flash !== 'healthy' ? 'FAIL' : 'PASS'
      );
      if (flash !== 'healthy')
        expect(
          trace.samples.some((sample) => !sample.controls[0].visible)
        ).toBe(true);
    }
  });

  test('rejects missing temporal coverage and mounted offscreen witnesses', () => {
    const trace: ScrollTrace = {
      errors: [],
      marks: [],
      frames: Array.from({ length: 70 }, (_, index) => ({
        time: index * 16,
        scrollTop: 0,
        scrollHeight: 1040,
        clientHeight: 100,
        viewportTop: 0,
        viewportBottom: 100,
        bottomGap: 940,
        anchors: { anchor: { top: 0, bottom: 40, height: 40 } },
      })),
    };
    expectAnchorStable(trace, 'anchor');
    expectTargetLanding(trace, 'anchor');
    expect(() => expectScrollDirection(trace, 'down')).toThrow(
      'Requested scroll made no progress'
    );
    const reversing = {
      ...trace,
      frames: trace.frames.map((frame, index) => ({
        ...frame,
        scrollTop: index >= 40 ? 10 : index >= 20 ? 20 : 0,
      })),
    };
    expect(() => expectScrollDirection(reversing, 'down')).toThrow(
      'Scroll reversed direction'
    );
    const sparse = {
      ...trace,
      frames: trace.frames.map((frame, index) => ({
        ...frame,
        time: frame.time + (index >= 40 ? 500 : 0),
      })),
    };
    expect(() => expectValidScrollTrace(sparse)).toThrow(
      'Insufficient geometry evidence'
    );
    const offscreen = {
      ...trace,
      frames: trace.frames.map((frame) => ({
        ...frame,
        anchors: { anchor: { top: 200, bottom: 240, height: 40 } },
      })),
    };
    expect(() => expectAnchorStable(offscreen, 'anchor')).toThrow(
      'Reading anchor left the viewport'
    );
    expect(() => expectTargetLanding(offscreen, 'anchor')).toThrow(
      'Landing target is below the viewport'
    );
  });
});

test.describe('Real conversation geometry', () => {
  test.setTimeout(180000);
  test.use({ actionTimeout: 10_000 });

  for (const inThread of [false, true]) {
    test(`${inThread ? 'thread' : 'channel'} own send from history lands at latest and stays there`, async ({
      zodPage: page,
    }, testInfo) => {
      const scroller = await prepareHistory(page, inThread);
      await wheelToHistory(page, scroller);
      await expect(post(page, history[0])).toBeInViewport();
      const text = `${inThread ? 'Thread' : 'Channel'} send after browsing history`;
      const trace = await recordMutation(
        scroller,
        testInfo,
        'send-from-history',
        async () => {
          await send(page, text, inThread);
          await expectFullyInViewport(post(page, text), scroller, testInfo);
          await expect(post(page, history[0])).not.toBeInViewport();
        }
      );
      expectBottomLanding(trace);
      expectScrollDirection(trace, 'down');
    });
  }

  for (const browsing of [false, true]) {
    test(`composer growth and clear ${browsing ? 'preserve reading anchor' : 'remain pinned to latest'}`, async ({
      zodPage: page,
    }, testInfo) => {
      const scroller = await prepareHistory(page);
      if (browsing) await wheelToHistory(page, scroller);
      const anchor = await postId(post(page, history[0]));
      const input = page.getByTestId('MessageInput');
      const originalHeight = (await input.boundingBox())!.height;
      const trace = await recordMutation(
        scroller,
        testInfo,
        'composer-growth-clear',
        async () => {
          await input.fill(
            'Growing draft\nsecond line\nthird line\nfourth line\nfifth line\nsixth line'
          );
          await expect
            .poll(async () => (await input.boundingBox())!.height)
            .toBeGreaterThan(originalHeight);
          await input.fill('');
          await expect
            .poll(async () => (await input.boundingBox())!.height)
            .toBe(originalHeight);
        },
        browsing ? [anchor] : []
      );
      if (browsing) expectAnchorStable(trace, anchor);
      else expectBottomPinned(trace);
      expect(
        Math.min(...trace.frames.map((frame) => frame.clientHeight))
      ).toBeLessThan(trace.frames[0].clientHeight);
      expect(trace.frames.at(-1)!.clientHeight).toBe(
        trace.frames[0].clientHeight
      );
    });
  }

  test('hover and action menu preserve the reading position and content extent', async ({
    zodPage: page,
  }, testInfo) => {
    const scroller = await prepareHistory(page);
    await wheelToHistory(page, scroller);
    const row = post(page, history[2]);
    const anchor = await postId(row);
    const trace = await recordMutation(
      scroller,
      testInfo,
      'hover-menu',
      async () => {
        await row.hover();
        await row.getByTestId('MessageActionsTrigger').click();
        await expect(page.getByTestId('ChatMessageActions')).toBeVisible();
        // The product explicitly supports trigger-button dismissal. The first
        // run separately retained the observed non-dismissing Escape behavior.
        await row.getByTestId('MessageActionsTrigger').click();
        await expect(page.getByTestId('ChatMessageActions')).toBeHidden();
      },
      [anchor]
    );
    expectAnchorStable(trace, anchor);
    expect(new Set(trace.frames.map((frame) => frame.scrollHeight)).size).toBe(
      1
    );
  });

  test('latest button lands at the reachable bottom', async ({
    zodPage: page,
  }, testInfo) => {
    const scroller = await prepareHistory(page);
    await wheelToHistory(page, scroller);
    const trace = await recordMutation(
      scroller,
      testInfo,
      'latest-button',
      async () => {
        await page.getByTestId('ScrollToBottomButton').click();
        await expectFullyInViewport(
          post(page, history.at(-1)!),
          scroller,
          testInfo
        );
      }
    );
    expectBottomLanding(trace);
    expectScrollDirection(trace, 'down');
  });

  for (const reducedMotion of [false, true]) {
    test(`latest control appears and disappears without extra flashes (${reducedMotion ? 'reduced' : 'normal'} motion)`, async ({
      zodPage: page,
    }, testInfo) => {
      await page.emulateMedia({
        reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
      });
      // Reanimated reads reduced motion when the app initializes.
      await page.reload();
      const scroller = await prepareHistory(page);
      // Repeat the full lifecycle: a successful first press must not leave the
      // pressed flag latched or prevent a later deliberate scroll from revealing it.
      for (let cycle = 0; cycle < 2; cycle++) {
        const name = `latest-control-${reducedMotion ? 'reduced' : 'normal'}-${cycle}`;
        await expectFullyInViewport(
          post(page, history.at(-1)!),
          scroller,
          testInfo
        );
        expect(
          Math.abs(
            await scroller.evaluate(
              (list) => list.scrollHeight - list.clientHeight - list.scrollTop
            )
          ),
          'Initial phase must actually be at the legal end'
        ).toBeLessThanOrEqual(1);
        const chrome = await startScrollChromeTrace(scroller, 'press-latest');
        let raw: BrowserChromeTrace;
        let contract: ScrollChromeContract | undefined;
        const times: Record<string, number> = {};
        try {
          await chrome.wait(250);
          times.reveal = await chrome.mark('reveal-request');
          await wheelToHistory(page, scroller);
          await chrome.wait(250);
          times.visible = await chrome.mark('history-window');
          await chrome.wait(300);
          times.press = await chrome.mark('press-request');
          const geometry = await recordMutation(
            scroller,
            testInfo,
            name,
            async () => {
              await page.getByTestId('ScrollToBottomButton').click();
              // The 200 ms hide animation starts when smooth scrolling crosses
              // the visibility threshold, not when the latest click is sent.
              // Observe the real interaction gate before its bounded fade;
              // never wait for opacity itself and hide a flicker in a poll.
              await expect(page.getByTestId('ScrollToBottomButton')).toHaveCSS(
                'pointer-events',
                'none',
                { timeout: 1000 }
              );
              times.eligibility = await chrome.mark('hide-eligibility');
              await chrome.wait(250);
              times.hidden = await chrome.mark('landed-window');
              await expectFullyInViewport(
                post(page, history.at(-1)!),
                scroller,
                testInfo
              );
              times.terminal = await chrome.mark('terminal-ready');
            }
          );
          expectBottomLanding(geometry);
          expectScrollDirection(geometry, 'down');
        } finally {
          raw = await chrome.stop(testInfo, `${name}-chrome-raw`);
          if (
            [
              'reveal',
              'visible',
              'press',
              'eligibility',
              'hidden',
              'terminal',
            ].every((key) => Number.isFinite(times[key])) &&
            raw.samples.length
          ) {
            const startTime = raw.samples[0].time;
            const endTime = times.terminal + 1000;
            const phase = (
              id: string,
              startTime: number,
              endTime: number,
              visibility: 'hidden' | 'visible'
            ) => ({
              id,
              startTime,
              endTime,
              loading: false,
              semanticState: 'list-visible',
              controls: [{ id: 'latest', kind: 'icon', visibility }],
            });
            contract = {
              scope: chrome.scope,
              coverage: {
                startTime,
                endTime,
                maxGapMs: 100,
                maxMeasurementDurationMs: 32,
              },
              action: {
                id: 'press-latest',
                startTime: times.press,
                endTime: times.hidden,
              },
              phases: [
                phase('at-end', startTime, times.reveal, 'hidden'),
                phase('in-history', times.visible, times.press, 'visible'),
                phase('landed', times.hidden, endTime, 'hidden'),
              ],
              transitions: [
                {
                  from: 'at-end',
                  to: 'in-history',
                  startTime: times.reveal,
                  endTime: times.visible,
                  opacity: reducedMotion ? 'instant' : 'monotonic',
                },
                {
                  from: 'in-history',
                  to: 'landed',
                  startTime: times.press,
                  endTime: times.hidden,
                  opacity: reducedMotion ? 'instant' : 'monotonic',
                },
              ],
            };
          }
          await testInfo.attach(`${name}-chrome-proof`, {
            body: JSON.stringify({ trace: raw, contract }),
            contentType: 'application/json',
          });
        }
        expect(raw.errors).toEqual([]);
        expect(
          contract,
          'Every planned control phase must actually run'
        ).toBeDefined();
        expect(times.visible - times.reveal).toBeLessThanOrEqual(1000);
        expect(times.hidden - times.press).toBeLessThanOrEqual(1000);
        expect(
          raw.marks.find((mark) => mark.id === 'hide-eligibility')
        ).toMatchObject({
          scope: chrome.scope,
          sameControl: true,
          pointerEvents: 'none',
        });
        expect(times.hidden - times.eligibility).toBeGreaterThanOrEqual(200);
        const result = assessScrollChromeTrace(raw, contract!);
        expect(result.issues, JSON.stringify(result, null, 2)).toEqual([]);
      }
    });
  }

  test('same-channel post reference lands centered on the selected post', async ({
    zodPage: page,
  }, testInfo) => {
    const scroller = await prepareHistory(page);
    await wheelToHistory(page, scroller);
    const anchor = await postId(post(page, history[2]));
    await helpers.quoteReply(page, history[2], 'Reference navigation reply');
    await expect(post(page, 'Reference navigation reply')).toBeInViewport();
    await settlePostScroller(scroller);
    const trace = await recordMutation(
      scroller,
      testInfo,
      'reference-target',
      async () => {
        // Reference.Body intentionally disables pointer events; click its
        // actual pressable frame instead of the nested quoted text node.
        const reference = post(page, 'Reference navigation reply')
          .locator('.is_ReferenceFrame')
          .filter({ hasText: history[2] });
        await expect(reference).toHaveCount(1);
        await reference.click();
        await expect(
          page.locator(`[data-postid="${anchor}"]`)
        ).toBeInViewport();
      },
      [anchor]
    );
    expectTargetLanding(trace, anchor);
    expectScrollDirection(trace, 'up');
  });

  test('thread navigation eventually restores the same reading post and pixel offset', async ({
    zodPage: page,
  }, testInfo) => {
    const scroller = await prepareHistory(page);
    await wheelToHistory(page, scroller);
    const row = post(page, history[2]);
    const anchor = await postId(row);
    const before = await startScrollTrace(scroller, [anchor]);
    await before.settle();
    const baseline = await before.stop(testInfo, 'before-thread');
    expectAnchorStable(baseline, anchor);
    await helpers.startThread(page, history[2]);
    await send(page, 'Reply while preserving channel history', true);
    await helpers.navigateBack(page);
    await expect(row).toBeInViewport();
    const returnedScroller = await resolvePostScroller(row);
    const recording = await startScrollTrace(returnedScroller, [anchor]);
    await recording.settle(1000);
    const trace = await recording.stop(testInfo, 'after-thread');
    // Navigation can remount the list, so compare the first returned frame to
    // the pre-navigation stable-ID baseline, then every frame of its tail.
    expect(
      Math.abs(
        trace.frames[0].anchors[anchor].top -
          baseline.frames.at(-1)!.anchors[anchor].top
      )
    ).toBeLessThanOrEqual(1);
    expectAnchorStable(trace, anchor);
    await expect(post(page, history.at(-1)!)).not.toBeInViewport();
  });

  test('reaction insertion and removal preserve a preceding reading anchor', async ({
    zodPage: page,
  }, testInfo) => {
    const scroller = await prepareHistory(page);
    await wheelToHistory(page, scroller);
    const anchor = await postId(post(page, history[0]));
    const row = post(page, history[2]);
    const changedPostId = await postId(row);
    const trace = await recordMutation(
      scroller,
      testInfo,
      'reaction-resize',
      async () => {
        await helpers.reactToMessage(page, history[2]);
        const reaction = row.getByTestId('ReactionDisplay');
        await expect(reaction).toBeVisible();
        await reaction.click();
        await expect(reaction).toHaveCount(0);
      },
      [anchor, changedPostId]
    );
    expectAnchorStable(trace, anchor);
    expect(
      Math.abs(
        trace.frames.at(-1)!.scrollHeight - trace.frames[0].scrollHeight
      ),
      'Reaction removal restores content extent'
    ).toBeLessThanOrEqual(1);
    const heights = trace.frames.map(
      (frame) => frame.anchors[changedPostId].height
    );
    expect(Math.max(...heights)).toBeGreaterThan(heights[0]);
    expect(Math.abs(heights.at(-1)! - heights[0])).toBeLessThanOrEqual(1);
    expect(
      Math.max(...trace.frames.map((frame) => frame.scrollHeight))
    ).toBeGreaterThan(trace.frames[0].scrollHeight);
  });

  test('editing a visible message to grow and shrink preserves history', async ({
    zodPage: page,
  }, testInfo) => {
    const scroller = await prepareHistory(page);
    // The 1280x500 desktop first run exposed an offscreen Edit menu item.
    // Use a viewport with room for the real action menu for this resize case.
    await page.setViewportSize({ ...viewport, height: 800 });
    await settlePostScroller(scroller);
    await wheelToHistory(page, scroller);
    const anchor = await postId(post(page, history[0]));
    const changedPostId = await postId(post(page, history[2]));
    const expanded =
      `Edited tall message: ${'A growing post must retain the reader position. '.repeat(16)}`.trim();
    const trace = await recordMutation(
      scroller,
      testInfo,
      'edit-growth-shrink',
      async () => {
        await helpers.editMessage(page, history[2], expanded);
        await expect(post(page, expanded)).toBeVisible();
        await helpers.editMessage(page, expanded, 'Edited short message');
        await expect(post(page, 'Edited short message')).toBeVisible();
      },
      [anchor, changedPostId]
    );
    expectAnchorStable(trace, anchor);
    const heights = trace.frames.map(
      (frame) => frame.anchors[changedPostId].height
    );
    expect(Math.max(...heights), 'Edited row actually grows').toBeGreaterThan(
      heights[0]
    );
    expect(heights.at(-1)!, 'Edited row actually shrinks').toBeLessThan(
      Math.max(...heights)
    );
    expect(
      Math.max(...trace.frames.map((frame) => frame.scrollHeight))
    ).toBeGreaterThan(trace.frames[0].scrollHeight);
  });

  test('quoted attachment preview keeps the reading anchor while composer resizes', async ({
    zodPage: page,
  }, testInfo) => {
    const scroller = await prepareHistory(page);
    await wheelToHistory(page, scroller);
    const anchor = await postId(post(page, history[0]));
    const trace = await recordMutation(
      scroller,
      testInfo,
      'quote-preview',
      async () => {
        await helpers.longPressMessage(page, history[2]);
        await page.getByText('Quote', { exact: true }).click();
        // The reference is an actual composer attachment, loaded through the
        // production reference loader. It requires no external upload service.
        await expect(page.getByText('Chat Post')).toBeVisible();
        await expect(page.getByText(history[2], { exact: true })).toHaveCount(
          2
        );
      },
      [anchor]
    );
    expectAnchorStable(trace, anchor);
    expect(
      Math.min(...trace.frames.map((frame) => frame.clientHeight))
    ).toBeLessThan(trace.frames[0].clientHeight);
  });

  test('viewport height changes retain the bottom edge', async ({
    zodPage: page,
  }, testInfo) => {
    const scroller = await prepareHistory(page);
    const originalViewportHeight = await scroller.evaluate(
      (element) => element.clientHeight
    );
    const trace = await recordMutation(
      scroller,
      testInfo,
      'viewport-resize',
      async () => {
        await page.setViewportSize({ ...viewport, height: 650 });
        await expect
          .poll(() => scroller.evaluate((element) => element.clientHeight))
          .toBeGreaterThan(originalViewportHeight);
        await page.setViewportSize(viewport);
        await expectFullyInViewport(
          post(page, history.at(-1)!),
          scroller,
          testInfo
        );
      }
    );
    expectBottomPinned(trace);
    expect(
      Math.max(...trace.frames.map((frame) => frame.clientHeight))
    ).toBeGreaterThan(trace.frames[0].clientHeight);
    expect(trace.frames.at(-1)!.clientHeight).toBe(
      trace.frames[0].clientHeight
    );
  });

  for (const browsing of [false, true]) {
    test(`remote append burst ${browsing ? 'holds history' : 'follows latest'}`, async ({
      zodPage,
      tenPage,
    }, testInfo) => {
      await prepareHistory(zodPage);
      await helpers.inviteMembersToGroup(zodPage, ['ten']);
      await helpers.acceptGroupInvite(tenPage, '~ten, ~zod');
      await helpers.navigateToChannel(tenPage, 'General');
      await helpers.navigateToChannel(zodPage, 'General');
      await tenPage.setViewportSize(viewport);
      await zodPage.bringToFront();
      const scroller = await resolvePostScroller(
        post(zodPage, history.at(-1)!)
      );
      await settlePostScroller(scroller);
      if (browsing) await wheelToHistory(zodPage, scroller);
      const anchor = await postId(post(zodPage, history[0]));
      const trace = await recordMutation(
        scroller,
        testInfo,
        'remote-burst',
        async () => {
          for (let index = 0; index < 5; index++) {
            const text = `Remote burst ${index}`;
            await send(tenPage, text);
            await expect(post(zodPage, text)).toBeVisible();
          }
          if (browsing)
            await expect(post(zodPage, 'Remote burst 4')).not.toBeInViewport();
          else
            await expectFullyInViewport(
              post(zodPage, 'Remote burst 4'),
              scroller,
              testInfo
            );
        },
        browsing ? [anchor] : []
      );
      if (browsing) expectAnchorStable(trace, anchor);
      else expectBottomPinned(trace);
    });
  }

  for (const browsing of [false, true]) {
    test(`computing presence show, clear, and reply handoff ${browsing ? 'preserve history' : 'stay pinned to latest'}`, async ({
      zodPage,
      tenPage,
    }, testInfo) => {
      await prepareHistory(zodPage);
      await helpers.inviteMembersToGroup(zodPage, ['ten']);
      await helpers.acceptGroupInvite(tenPage, '~ten, ~zod');
      await helpers.navigateToChannel(tenPage, 'General');
      await helpers.navigateToChannel(zodPage, 'General');
      await tenPage.setViewportSize(viewport);
      await zodPage.bringToFront();
      const scroller = await resolvePostScroller(
        post(zodPage, history.at(-1)!)
      );
      await settlePostScroller(scroller);
      if (browsing) await wheelToHistory(zodPage, scroller);
      const anchor = await postId(post(zodPage, history[0]));
      const thinking = zodPage.getByText('Scroll stability computing', {
        exact: true,
      });
      const heldThinking = zodPage.getByText('Thinking...', { exact: true });
      const initialExtent = await scroller.evaluate(
        (element) => element.scrollHeight
      );
      try {
        const trace = await recordMutation(
          scroller,
          testInfo,
          'computing-presence',
          async () => {
            await setComputingPresence(tenPage, true, zodPage);
            await expect(thinking).toBeVisible();
            await expect
              .poll(() => scroller.evaluate((element) => element.scrollHeight))
              .toBe(initialExtent + 52);
            await setComputingPresence(tenPage, false, zodPage);
            // A clear without a response deliberately retains the footer for
            // two seconds. Wait on the real disappearance, not a guessed delay.
            await expect(thinking).toHaveCount(0);
            await expect(heldThinking).toHaveCount(0);
            await expect
              .poll(() => scroller.evaluate((element) => element.scrollHeight))
              .toBe(initialExtent);
            await setComputingPresence(tenPage, true, zodPage);
            await expect(thinking).toBeVisible();
            await send(tenPage, 'Response before computing presence cleared');
            const response = post(
              zodPage,
              'Response before computing presence cleared'
            );
            await expect(response).toBeVisible();
            // This exercises response-before-clear ordering. The delivered
            // reply must consume the hold when presence is subsequently cleared.
            await expect(thinking).toBeVisible();
            await setComputingPresence(tenPage, false, zodPage);
            await expect(thinking).toHaveCount(0);
            await expect(heldThinking).toHaveCount(0);
            if (browsing) await expect(response).not.toBeInViewport();
            else await expectFullyInViewport(response, scroller, testInfo);
          },
          browsing ? [anchor] : []
        );
        if (browsing) expectAnchorStable(trace, anchor);
        else expectBottomPinned(trace);
        expect(
          Math.max(...trace.frames.map((frame) => frame.scrollHeight))
        ).toBeGreaterThanOrEqual(trace.frames[0].scrollHeight + 52);
      } finally {
        await setComputingPresence(tenPage, false, zodPage);
      }
    });
  }

  for (const mode of ['end', 'history', 'composer', 'wheel'] as const) {
    const title = {
      end: 'delayed image decode changes row height while latest stays pinned',
      history:
        'delayed image decode above the viewport preserves the reading anchor',
      composer:
        'delayed image decode and composer growth preserve the reading anchor',
      wheel:
        'delayed image decode during upward wheel scroll preserves user direction',
    }[mode];
    test(title, async ({ zodPage: page }, testInfo) => {
      const browsing = mode === 'history' || mode === 'composer';
      const fixture = await prepareDelayedImage(page, browsing);
      const { image, row, scroller, imagePostId, readerId } = fixture;
      const initialTop = await scroller.evaluate(
        (element) => element.scrollTop
      );
      const initialInputHeight = (await page
        .getByTestId('MessageInput')
        .boundingBox())!.height;
      const wheelDelta = Math.min(120, initialTop / 4);
      const label = `image-load-${mode}`;
      let beforeDecode!: { complete: boolean; width: number; height: number };
      let afterDecode!: { complete: boolean; width: number; height: number };
      try {
        const trace = await recordMutation(
          scroller,
          testInfo,
          label,
          async (recording) => {
            // Six stable pending frames prove this is an existing mounted row
            // awaiting real image bytes, not an image post inserted mid-capture.
            await recording.settle(200);
            await expect
              .poll(() =>
                image.evaluate(
                  (element: HTMLImageElement) => element.naturalWidth
                )
              )
              .toBe(0);
            expect(
              fixture.requests.every(
                (request) => request.releasedAt === undefined
              )
            ).toBe(true);
            if (mode === 'composer') {
              await page
                .getByTestId('MessageInput')
                .fill(
                  'Loading draft\nsecond line\nthird line\nfourth line\nfifth line\nsixth line'
                );
              await expect
                .poll(
                  async () =>
                    (await page.getByTestId('MessageInput').boundingBox())!
                      .height
                )
                .toBeGreaterThan(initialInputHeight);
              await recording.settle(200);
            }
            if (mode === 'wheel') {
              expect(wheelDelta).toBeGreaterThan(20);
              const box = (await scroller.boundingBox())!;
              await page.mouse.move(
                box.x + box.width / 2,
                box.y + box.height / 2
              );
              await page.mouse.wheel(0, -wheelDelta);
              await expect
                .poll(() => scroller.evaluate((element) => element.scrollTop))
                .toBeLessThan(initialTop - 20);
            }
            beforeDecode = await image.evaluate(
              (element: HTMLImageElement) => ({
                complete: element.complete,
                width: element.naturalWidth,
                height: element.naturalHeight,
              })
            );
            expect(beforeDecode.width).toBe(0);
            await recording.mark(`${label}:response-release`);
            fixture.releaseResponse();
            if (mode === 'wheel') {
              await page.mouse.wheel(0, -wheelDelta);
              await page.mouse.wheel(0, -wheelDelta);
            }
            await expect
              .poll(() =>
                image.evaluate((element: HTMLImageElement) => ({
                  complete: element.complete,
                  width: element.naturalWidth,
                  height: element.naturalHeight,
                }))
              )
              .toEqual({ complete: true, width: 2, height: 1 });
            await image.evaluate((element: HTMLImageElement) =>
              element.decode()
            );
            afterDecode = await image.evaluate((element: HTMLImageElement) => ({
              complete: element.complete,
              width: element.naturalWidth,
              height: element.naturalHeight,
            }));
            await expect
              .poll(async () =>
                Math.abs(
                  (await row.boundingBox())!.height - fixture.beforeRow.height
                )
              )
              .toBeGreaterThan(16);
            await recording.mark(`${label}:image-decoded`);
            if (mode === 'composer') {
              await page.getByTestId('MessageInput').fill('');
              await expect
                .poll(
                  async () =>
                    (await page.getByTestId('MessageInput').boundingBox())!
                      .height
                )
                .toBe(initialInputHeight);
            }
          },
          browsing ? [imagePostId, readerId] : [imagePostId]
        );
        const afterEssay = await readImageEssay(page, fixture.src);
        const afterImage = (await image.boundingBox())!;
        const afterRow = (await row.boundingBox())!;
        const sameMountedRow = await fixture.rowHandle.evaluate(
          (element) =>
            element.isConnected &&
            element ===
              document.querySelector(
                `[data-postid="${element.getAttribute('data-postid')}"]`
              )
        );
        await testInfo.attach(`${label}-loading-proof`, {
          body: JSON.stringify(
            {
              src: fixture.src,
              imagePostId,
              ...(browsing ? { readerId } : {}),
              beforeDecode,
              afterDecode,
              ...(mode === 'wheel'
                ? { wheel: { initialTop, wheelDelta, wheelCount: 3 } }
                : {}),
              requests: fixture.requests,
              beforeEssay: fixture.beforeEssay,
              afterEssay,
              beforeImage: fixture.beforeImage,
              afterImage,
              beforeRow: fixture.beforeRow,
              afterRow,
              sameMountedRow,
            },
            null,
            2
          ),
          contentType: 'application/json',
        });
        expect(
          afterEssay,
          'No post content mutation accompanied image decoding'
        ).toEqual(fixture.beforeEssay);
        expect(
          sameMountedRow,
          'The measured post remained mounted through decoding'
        ).toBe(true);
        expect(
          Math.abs(afterImage.height - fixture.beforeImage.height)
        ).toBeGreaterThan(16);
        expect(
          Math.abs(afterRow.height - fixture.beforeRow.height)
        ).toBeGreaterThan(16);
        const rowHeights = trace.frames.map(
          (frame) => frame.anchors[imagePostId].height
        );
        expect(
          Math.max(...rowHeights) - Math.min(...rowHeights),
          'Actual row height transition captured'
        ).toBeGreaterThan(16);
        expectValidScrollTrace(trace);
        if (browsing) expectAnchorStable(trace, readerId);
        else if (mode === 'end') expectBottomPinned(trace);
        else {
          expectScrollDirection(trace, 'up');
          const final = trace.frames.at(-1)!;
          expect(
            final.bottomGap,
            "The user's upward scroll keeps them in history"
          ).toBeGreaterThan(1);
          const expectedTop = Math.max(
            0,
            Math.min(
              initialTop - 3 * wheelDelta,
              final.scrollHeight - final.clientHeight
            )
          );
          expect(
            Math.abs(final.scrollTop - expectedTop),
            'Wheel displacement is preserved through decode'
          ).toBeLessThanOrEqual(1);
        }
        if (mode === 'composer') {
          expect(
            Math.min(...trace.frames.map((frame) => frame.clientHeight))
          ).toBeLessThan(trace.frames[0].clientHeight);
          expect(trace.frames.at(-1)!.clientHeight).toBe(
            trace.frames[0].clientHeight
          );
        }
      } finally {
        await fixture.cleanup();
        await fixture.rowHandle.dispose();
      }
    });
  }

  test('delayed image content remains exposed after decoding at latest', async ({
    zodPage: page,
  }, testInfo) => {
    const fixture = await prepareDelayedImage(page, false);
    const { scroller, image, row, imagePostId, caption } = fixture;
    const label = 'image-content-end';
    let available: { width: number; height: number };
    let content: Awaited<ReturnType<typeof startScrollContentTrace>>;
    try {
      // This controlled post has one image and no avatar image in its row. A
      // different setup is not silently interpreted as duplicate content.
      await expect(row.locator('img')).toHaveCount(1);
      available = await scroller.evaluate((list) => ({
        width: list.clientWidth,
        height: list.clientHeight,
      }));
      // Production constrains this known 2:1 decode to 600×300. Full exposure is
      // required only after establishing that this fixed desktop fixture fits.
      expect(available.width).toBeGreaterThanOrEqual(600);
      expect(available.height).toBeGreaterThanOrEqual(300);
      content = await startScrollContentTrace(
        scroller,
        fixture.rowHandle,
        fixture.src,
        caption
      );
    } catch (error) {
      await fixture.cleanup();
      await fixture.rowHandle.dispose();
      throw error;
    }
    let releaseTime = NaN;
    let terminalTime = NaN;
    let geometry: ScrollTrace | undefined;
    let beforeDecode:
      | { complete: boolean; width: number; height: number }
      | undefined;
    let afterDecode:
      | { complete: boolean; width: number; height: number }
      | undefined;
    let raw!: Awaited<ReturnType<typeof content.stop>>;
    let contract: ScrollContentContract | undefined;
    try {
      geometry = await recordMutation(
        scroller,
        testInfo,
        label,
        async (recording) => {
          await recording.settle(200);
          await content.wait(250);
          beforeDecode = await image.evaluate((element: HTMLImageElement) => ({
            complete: element.complete,
            width: element.naturalWidth,
            height: element.naturalHeight,
          }));
          expect(beforeDecode).toEqual({
            complete: false,
            width: 0,
            height: 0,
          });
          expect(fixture.requests.length).toBeGreaterThan(0);
          expect(
            fixture.requests.every(
              (request) => request.releasedAt === undefined
            )
          ).toBe(true);
          await recording.mark(`${label}:response-release`);
          releaseTime = await content.mark('response-release');
          fixture.releaseResponse();
          await expect.poll(content.decoded, { timeout: 10_000 }).toBe(true);
          afterDecode = await image.evaluate((element: HTMLImageElement) => ({
            complete: element.complete,
            width: element.naturalWidth,
            height: element.naturalHeight,
          }));
          expect(afterDecode).toEqual({ complete: true, width: 2, height: 1 });
          await expect
            .poll(async () =>
              Math.abs(
                (await row.boundingBox())!.height - fixture.beforeRow.height
              )
            )
            .toBeGreaterThan(16);
          await recording.mark(`${label}:image-decoded`);
          await expectFullyInViewport(image, scroller, testInfo);
          terminalTime = await content.mark('terminal-ready');
        },
        [imagePostId]
      );
      const afterEssay = await readImageEssay(page, fixture.src);
      const afterImage = (await image.boundingBox())!;
      const afterRow = (await row.boundingBox())!;
      const sameMountedRow = await fixture.rowHandle.evaluate(
        (element) =>
          element.isConnected &&
          element ===
            document.querySelector(
              `[data-postid="${element.getAttribute('data-postid')}"]`
            )
      );
      await testInfo.attach(`${label}-loading-proof`, {
        body: JSON.stringify({
          src: fixture.src,
          imagePostId,
          beforeDecode,
          afterDecode,
          scope: new URL(page.url()).pathname,
          origin: new URL(page.url()).origin,
          requests: fixture.requests,
          clockDomains: {
            route: 'Date.now milliseconds',
            content: 'performance.now milliseconds',
          },
          beforeEssay: fixture.beforeEssay,
          afterEssay,
          beforeImage: fixture.beforeImage,
          afterImage,
          beforeRow: fixture.beforeRow,
          afterRow,
          sameMountedRow,
          available,
        }),
        contentType: 'application/json',
      });
      expect(afterEssay).toEqual(fixture.beforeEssay);
      expect(sameMountedRow).toBe(true);
      expectBottomPinned(geometry);
    } finally {
      raw = await content.stop(testInfo, `${label}-content-raw`);
      if (
        Number.isFinite(releaseTime) &&
        Number.isFinite(terminalTime) &&
        raw.samples.length
      ) {
        contract = {
          scope: content.scope,
          rowId: imagePostId,
          src: content.src,
          caption,
          releaseTime,
          terminalTime,
          coverage: {
            startTime: raw.samples[0].time,
            endTime: terminalTime + 1000,
            maxGapMs: 100,
            maxMeasurementDurationMs: 32,
          },
        };
      }
      await testInfo.attach(`${label}-content-proof`, {
        body: JSON.stringify({ trace: raw, contract }),
        contentType: 'application/json',
      });
      await fixture.cleanup();
      await fixture.rowHandle.dispose();
    }
    expect(
      contract,
      'Held response, real decode and ready tail must all be exercised'
    ).toBeDefined();
    const result = assessScrollContentTrace(raw, contract!);
    expect(result.issues, JSON.stringify(result)).toEqual([]);
  });

  test('incoming reply clears thread unread state without moving the visible thread', async ({
    zodPage,
    tenPage,
  }, testInfo) => {
    await prepareHistory(zodPage);
    await helpers.inviteMembersToGroup(zodPage, ['ten']);
    await helpers.acceptGroupInvite(tenPage, '~ten, ~zod');
    await helpers.navigateToChannel(tenPage, 'General');
    await helpers.navigateToChannel(zodPage, 'General');
    const parentText = history.at(-1)!;
    await helpers.startThread(zodPage, parentText);
    for (let index = 0; index < 18; index++)
      await send(zodPage, `Read-state thread reply ${index}`, true, 30_000);
    const scroller = await resolvePostScroller(
      post(zodPage, 'Read-state thread reply 17')
    );
    await settlePostScroller(scroller);
    const tenParent = post(tenPage, parentText);
    await expect(tenParent.getByTestId('ThreadUnreadDot')).toBeVisible();
    await tenParent.getByText('18 replies', { exact: true }).click();
    await expect(post(tenPage, 'Read-state thread reply 17')).toBeVisible();
    await zodPage.bringToFront();
    const trace = await recordMutation(
      scroller,
      testInfo,
      'thread-read-update',
      async () => {
        await send(
          tenPage,
          'Incoming reply while the thread is being read',
          true
        );
        await expectFullyInViewport(
          post(zodPage, 'Incoming reply while the thread is being read'),
          scroller,
          testInfo
        );
      }
    );
    expectBottomPinned(trace);
    await helpers.navigateBack(zodPage);
    const zodParent = post(zodPage, parentText);
    await expect(
      zodParent.getByText('19 replies', { exact: true })
    ).toBeVisible();
    await expect(zodParent.getByTestId('ThreadUnreadDot')).toHaveCount(0);
  });
});
