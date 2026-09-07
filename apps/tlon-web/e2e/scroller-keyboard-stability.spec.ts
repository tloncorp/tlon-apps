import { runPendingSendScenario } from './helpers/scrollerPendingSendScenario';
import { expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  assessScrollKeyboardTrace,
  createKeyboardPlan,
  type KeyboardBackend,
  type KeyboardTrace,
} from '../../../packages/app/fixtures/scrollKeyboardTrace';
import * as helpers from './helpers';
import { currentLocalChannel, post } from './helpers/scrollerContentScenario';
import { writeReferencePosts } from './helpers/scrollerReferenceScenario';
import {
  keyboardEssayText,
  recordKeyboardSends,
  startKeyboardTrace,
} from './helpers/scrollKeyboard';
import { resolvePostScroller, settlePostScroller } from './helpers/scrollers';
import { testWithOptions } from './test-fixtures';

const test = testWithOptions({ appReadyTimeoutMs: 60_000, e2eMode: false });
test.setTimeout(180_000);
for (const position of ['latest', 'history'] as const) {
  test(`real keyboard edits, selection, undo and Enter routing (${position})`, async ({
    zodPage: page,
    browser,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await helpers.createGroup(page);
    await helpers.navigateToChannel(page, 'General');
    const { channelId, origin } = currentLocalChannel(page);
    expect(origin).toBe('http://localhost:3000');
    const seed = Array.from(
      { length: 36 },
      (_, i) =>
        `Keyboard reading ${i}: ${'An unchanged visible conversation witness. '.repeat(2 + (i % 3))}`
    );
    await writeReferencePosts(
      page.request,
      channelId,
      seed.map((text) => [{ inline: [text] }])
    );
    await expect(post(page, seed.at(-1)!)).toBeVisible({ timeout: 30_000 });
    let list: Awaited<ReturnType<typeof resolvePostScroller>>;
    await expect
      .poll(
        async () => {
          try {
            list = await resolvePostScroller(post(page, seed.at(-1)!));
            return true;
          } catch {
            return false;
          }
        },
        { timeout: 15000 }
      )
      .toBe(true);
    await settlePostScroller(list!);
    const input = page.getByTestId('MessageInput');
    await input.click();
    await expect(input).toHaveValue('');
    const wheel: { time: number; deltaY: number; trusted: boolean }[] = [];
    await list!.evaluate((el) => {
      (el as HTMLElement & { __keyboardWheel?: unknown[] }).__keyboardWheel =
        [];
      el.addEventListener(
        'wheel',
        (e) => {
          (
            el as HTMLElement & { __keyboardWheel: unknown[] }
          ).__keyboardWheel.push({
            time: e.timeStamp,
            deltaY: e.deltaY,
            trusted: e.isTrusted,
          });
        },
        { passive: true }
      );
    });
    if (position === 'history') {
      const box = await list!.boundingBox();
      if (!box) throw new Error('Missing list');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -500);
      await settlePostScroller(list!);
    }
    wheel.push(
      ...(await list!.evaluate(
        (el) =>
          (el as HTMLElement & { __keyboardWheel: typeof wheel })
            .__keyboardWheel
      ))
    );
    const anchorId = await list!.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return [...el.querySelectorAll<HTMLElement>('[data-postid]')]
        .map((r) => ({
          id: r.dataset.postid!,
          rect: r.getBoundingClientRect(),
        }))
        .filter((r) => r.rect.bottom > b.top && r.rect.top < b.bottom)
        .sort(
          (a, c) =>
            Math.abs(
              (a.rect.top + a.rect.bottom) / 2 - (b.top + b.bottom) / 2
            ) -
            Math.abs((c.rect.top + c.rect.bottom) / 2 - (b.top + b.bottom) / 2)
        )[0]?.id;
    });
    expect(anchorId).toBeTruthy();
    await page.bringToFront();
    const preparation = await page.evaluate(async () => {
      const start = performance.now();
      while (performance.now() - start < 2000)
        await new Promise(requestAnimationFrame);
      return {
        scope: location.pathname,
        origin: location.origin,
        ship: (window as unknown as { ship: string }).ship,
        e2eMode:
          (window as unknown as { TLON_IS_E2E: boolean }).TLON_IS_E2E === true,
        platform: navigator.platform,
        timeOrigin: performance.timeOrigin,
        capturedAt: performance.now(),
        wallTime: Date.now(),
      };
    });
    expect(preparation.ship).toBe('zod');
    expect(preparation.e2eMode).toBe(false);
    const plan = createKeyboardPlan(
      preparation.scope,
      randomUUID().slice(0, 8),
      preparation.platform.startsWith('Mac') ? 'Meta' : 'Control',
      position,
      anchorId!
    );
    const inputHandle = await input.elementHandle();
    const sendHandle = await page
      .getByTestId('MessageInputSendButton')
      .elementHandle();
    if (!inputHandle || !sendHandle)
      throw new Error('Missing real composer controls');
    const sends = recordKeyboardSends(
      page,
      preparation.scope,
      preparation.timeOrigin
    );
    const capture = await startKeyboardTrace(
      inputHandle,
      sendHandle,
      list!,
      plan
    );
    let trace: KeyboardTrace;
    try {
      await page.waitForTimeout(220);
      for (const [index, step] of plan.steps.entries()) {
        await capture.begin(index);
        await page.keyboard.press(step.key);
        await capture.end(index);
        if (index < plan.steps.length - 1) await page.waitForTimeout(120);
      }
      await capture.finish();
    } finally {
      trace = await capture.stop();
      sends.stop();
      await testInfo.attach(`keyboard-${position}-raw`, {
        contentType: 'application/json',
        body: JSON.stringify({
          trace,
          preparation: {
            ...preparation,
            browser: browser.version(),
            headed: true,
            assets: 'Vite development assets',
          },
          wheel,
          transportErrors: sends.errors,
          requests: sends.requests,
        }),
      });
    }
    let backend: KeyboardBackend | undefined;
    let backendError: string | undefined;
    let rawBackend: unknown;
    let backendRead: unknown;
    try {
      await expect
        .poll(
          async () => {
            const url = `${origin}/~/scry/channels/v5/${channelId}/posts/newest/50/post.json`;
            const started = await page.evaluate(() => ({
              time: performance.now(),
              wall: Date.now(),
            }));
            const response = await page.request.get(url);
            if (!response.ok()) return false;
            rawBackend = await response.json();
            const completed = await page.evaluate(() => ({
              time: performance.now(),
              wall: Date.now(),
            }));
            backendRead = {
              url,
              status: response.status(),
              started,
              completed,
            };
            const posts = Object.values(
              (rawBackend as { posts: Record<string, any> }).posts
            ).filter((p: any) =>
              keyboardEssayText(p.essay)?.includes(plan.token)
            );
            backend = {
              channel: channelId,
              posts: posts.map((p: any) => ({
                id: String(p.seal.id),
                author: p.essay.author,
                text: keyboardEssayText(p.essay)!,
                essay: p.essay,
              })),
              requests: sends.requests,
            };
            return posts.length > 0;
          },
          { timeout: 10_000 }
        )
        .toBe(true);
    } catch (error) {
      backendError = String(error);
    }
    const assessment = assessScrollKeyboardTrace(trace!, plan, backend);
    await testInfo.attach(`keyboard-${position}-proof`, {
      contentType: 'application/json',
      body: JSON.stringify({
        trace: trace!,
        plan,
        preparation: {
          ...preparation,
          browser: browser.version(),
          headed: true,
          assets: 'Vite development assets',
        },
        wheel,
        requests: sends.requests,
        backend,
        rawBackend,
        backendRead,
        backendError,
        transportErrors: sends.errors,
        assessment,
      }),
    });
    expect(sends.errors).toEqual([]);
    expect(assessment.verdict, JSON.stringify(assessment)).toBe('PASS');
  });
}

// One real pending-send/READ handoff; the original keyboard plans stay unchanged.
test('pending Enter send cannot reclaim latest after deliberate upward scrolling', async ({
  zodPage: page,
  browser,
}, testInfo) => {
  await runPendingSendScenario(page, browser, testInfo);
});
