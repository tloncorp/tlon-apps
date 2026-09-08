import { expect } from '@playwright/test';
import { assessInputPaint } from '../../../scripts/scroll-stability-input-paint.cjs';
import {
  assessScrollInputTrace,
  bindScrollInputDeliveries,
  SCROLL_INPUT_GROWTH_DRAFT as expanded,
  type ScrollInputContract,
  type ScrollInputState,
} from '../../../packages/app/fixtures/scrollInputTrace';
import * as helpers from './helpers';
import { startScrollInputTrace } from './helpers/scrollInput';
import {
  expectAnchorStable,
  expectBottomPinned,
  resolvePostScroller,
  settlePostScroller,
  startScrollTrace,
  wheelToHistory,
} from './helpers/scrollers';
import { testWithOptions } from './test-fixtures';

const test = testWithOptions({
  appReadyTimeoutMs: 60_000,
  e2eMode: false,
  createdGroupCleanup: true,
});

test.describe('Real composer input and geometry', () => {
  test.setTimeout(180_000);
  for (const position of ['end', 'near', 'deep'] as const) {
    const browsing = position !== 'end';
    const label =
      position === 'end'
        ? 'at latest'
        : position === 'near'
          ? 'while reading near the bottom'
          : 'while reading deep history';
    test(`exact draft growth and clear ${label}`, async ({
      zodPage: page,
    }, testInfo) => {
      expect(new URL(page.url()).origin).toBe('http://localhost:3000');
      await page.setViewportSize({ width: 1280, height: 800 });
      await helpers.createGroup(page);
      await helpers.navigateToChannel(page, 'General');
      for (let index = 0; index < (position === 'deep' ? 72 : 18); index++) {
        await helpers.sendMessage(
          page,
          `Input stability ${index}: ${'A variable height reading witness. '.repeat(2 + (index % 3))}`
        );
      }
      await expect(page.getByTestId('ChatMessageDeliveryStatus')).toHaveCount(
        0
      );
      const scroller = await resolvePostScroller(
        page.locator('[data-postid]').last()
      );
      await settlePostScroller(scroller);
      if (browsing) await wheelToHistory(page, scroller);
      const input = page.getByTestId('MessageInput');
      await input.focus();
      const inputHandle = await input.elementHandle();
      const sendHandle = await page
        .getByTestId('MessageInputSendButton')
        .elementHandle();
      expect(inputHandle).not.toBeNull();
      expect(sendHandle).not.toBeNull();
      const scope = new URL(page.url()).pathname;
      const expected = (draft: string): ScrollInputState => ({
        scopeKey: scope,
        inputId: 'MessageInput',
        draft,
        selection: { start: draft.length, end: draft.length },
        composing: false,
        focused: true,
        caretVisible: true,
        sendVisible: true,
        sendHitTestable: draft.length > 0,
      });
      // Freeze all semantic expectations before the first action. Absolute
      // phase boundaries later bind to delivered input events, never success.
      const plan = {
        before: expected(''),
        grown: expected(expanded),
        selected: {
          ...expected(expanded),
          selection: { start: 0, end: expanded.length },
        },
        cleared: expected(''),
      };
      await page.bringToFront();
      const preparation = await page.evaluate(async () => {
        const runtime = window as Window & {
          ship?: string;
          TLON_IS_E2E?: boolean;
        };
        const start = performance.now();
        const frameTimes: number[] = [];
        while (performance.now() - start < 2000) {
          await new Promise(requestAnimationFrame);
          frameTimes.push(performance.now());
        }
        return {
          frameTimes,
          origin: location.origin,
          scope: location.pathname,
          ship: runtime.ship,
          e2eMode: runtime.TLON_IS_E2E === true,
        };
      });
      expect(preparation.ship).toBe('zod');
      expect(preparation.e2eMode).toBe(false);
      const preparedPosition = await scroller.evaluate((list) => ({
        scrollTop: list.scrollTop,
        viewportHeight: list.clientHeight,
        bottomGap: list.scrollHeight - list.clientHeight - list.scrollTop,
      }));
      if (position === 'end')
        expect(Math.abs(preparedPosition.bottomGap)).toBeLessThanOrEqual(1);
      if (position === 'near') {
        expect(preparedPosition.bottomGap).toBeGreaterThan(1);
        expect(preparedPosition.bottomGap).toBeLessThanOrEqual(100);
      }
      if (position === 'deep')
        expect(preparedPosition.bottomGap).toBeGreaterThanOrEqual(
          2 * preparedPosition.viewportHeight
        );
      await testInfo.attach('composer-exact-preparation', {
        body: JSON.stringify({
          ...preparation,
          position,
          preparedPosition,
          plan,
          assets: 'Vite development assets',
          browser: testInfo.project.use.channel,
          headed: testInfo.project.use.headless === false,
        }),
        contentType: 'application/json',
      });
      await testInfo.attach('composer-exact-before', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
      const anchorId = browsing
        ? await scroller.evaluate((list) => {
            const viewport = list.getBoundingClientRect();
            const middle = (viewport.top + viewport.bottom) / 2;
            return [...list.querySelectorAll('[data-postid]')]
              .map((row) => ({
                id: row.getAttribute('data-postid'),
                rect: row.getBoundingClientRect(),
              }))
              .filter(
                ({ id, rect }) =>
                  id && rect.bottom > viewport.top && rect.top < viewport.bottom
              )
              .sort(
                (a, b) =>
                  Math.abs((a.rect.top + a.rect.bottom) / 2 - middle) -
                  Math.abs((b.rect.top + b.rect.bottom) / 2 - middle)
              )[0]?.id;
          })
        : null;
      if (browsing) expect(anchorId).toBeTruthy();
      const geometry = await startScrollTrace(
        scroller,
        anchorId ? [anchorId] : []
      );
      const inputs = await startScrollInputTrace(
        inputHandle!,
        sendHandle!,
        [
          { kind: 'input', payload: expanded },
          { kind: 'select-all', payload: 'ControlOrMeta+A' },
          { kind: 'input', payload: '' },
        ],
        process.env.SCROLLER_INPUT_PAINT === '1' ? page : undefined
      );
      let geometryTrace: Awaited<ReturnType<typeof geometry.stop>>;
      let inputTrace: Awaited<ReturnType<typeof inputs.stop>>;
      let plannedEnd = 0;
      try {
        await geometry.mark('composer-exact-geometry:start');
        await inputs.beginInput(0);
        await input.fill(expanded);
        await inputs.endInput(0);
        // A fixed hold exposes temporary corruption before clear. It is not
        // a poll that waits until a desired state appears.
        await page.waitForTimeout(350);
        await inputs.beginInput(1);
        await page.keyboard.press('ControlOrMeta+A');
        await inputs.endInput(1);
        // Keep the explicitly selected state observable before Delete.
        await page.waitForTimeout(150);
        await inputs.beginInput(2);
        await page.keyboard.press('Delete');
        await inputs.endInput(2);
        await geometry.mark('composer-exact-geometry:terminal-state');
        plannedEnd = await page.evaluate(() => performance.now() + 1300);
        await page.evaluate(async (end) => {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.max(0, end - performance.now()))
          );
        }, plannedEnd);
      } finally {
        // Stop both in parallel before transferring or serializing attachments.
        [geometryTrace, inputTrace] = await Promise.all([
          geometry.stop(),
          inputs.stop(),
        ]);
        await testInfo.attach('composer-exact-geometry', {
          body: JSON.stringify(geometryTrace),
          contentType: 'application/json',
        });
        await testInfo.attach('composer-exact-input-raw', {
          body: JSON.stringify({ plan, plannedEnd, inputTrace }),
          contentType: 'application/json',
        });
      }
      const expectedActions = [
        { id: 'input-1', kind: 'input' as const, payload: expanded },
        {
          id: 'select-all-1',
          kind: 'select-all' as const,
          payload: 'ControlOrMeta+A',
        },
        { id: 'input-2', kind: 'input' as const, payload: '' },
      ].map((action) => ({
        ...action,
        scopeKey: scope,
        inputId: 'MessageInput',
      }));
      const binding = bindScrollInputDeliveries({
        declaredAt: inputTrace.declaredAt,
        expected: expectedActions,
        dispatches: inputTrace.dispatches,
        events: inputTrace.actions,
        keyboard: inputTrace.keyboard,
      });
      await testInfo.attach('composer-exact-delivery-binding', {
        body: JSON.stringify(binding),
        contentType: 'application/json',
      });
      expect(binding.issues).toEqual([]);
      const delivered = binding.actions;
      const contract: ScrollInputContract = {
        version: 2,
        declaredAt: inputTrace.declaredAt,
        start: inputTrace.samples[0].time,
        end: plannedEnd,
        deferredThrough: plannedEnd - 1000,
        actions: expectedActions,
        phases: [
          {
            id: 'before',
            start: inputTrace.samples[0].time,
            end: delivered[0].time,
            expected: plan.before,
          },
          {
            id: 'grown',
            start: delivered[0].time,
            end: delivered[1].time,
            triggerActionId: 'input-1',
            expected: plan.grown,
          },
          {
            id: 'selected',
            start: delivered[1].time,
            end: delivered[2].time,
            triggerActionId: 'select-all-1',
            expected: plan.selected,
          },
          {
            id: 'cleared',
            start: delivered[2].time,
            end: plannedEnd,
            triggerActionId: 'input-2',
            expected: plan.cleared,
          },
        ],
      };
      if (inputTrace.paintedCaret) {
        await testInfo.attach('composer-exact-caret-paint-assessment', {
          body: JSON.stringify(
            assessInputPaint(inputTrace.paintedCaret, contract, inputTrace)
          ),
          contentType: 'application/json',
        });
      }
      const inputResult = assessScrollInputTrace({
        contract,
        samples: inputTrace.samples,
        actions: delivered,
      });
      await testInfo.attach('composer-exact-input-proof', {
        body: JSON.stringify({
          contract,
          raw: inputTrace,
          result: inputResult,
        }),
        contentType: 'application/json',
      });
      // Textareas do not expose their native caret range to the DOM collector.
      // Require exact semantic input, and retain caret qualification separately.
      expect(
        inputResult.semanticVerdict,
        JSON.stringify(inputResult.issues)
      ).toBe('PASS');
      if (browsing) {
        expectAnchorStable(geometryTrace, anchorId!);
      } else expectBottomPinned(geometryTrace);
    });
  }
});
