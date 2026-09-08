import { expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  assessScrollNavigationTrace,
  assessPendingNavigationTrace,
  type ScrollNavigationPlan,
  type ScrollNavigationTrace,
} from '../../../packages/app/fixtures/scrollNavigationTrace';
import * as helpers from './helpers';
import { postId, send } from './helpers/scrollerContentScenario';
import {
  readNavigationAnchor,
  startScrollNavigationTrace,
} from './helpers/scrollNavigation';
import { resolvePostScroller, settlePostScroller } from './helpers/scrollers';
import {
  preparePendingNavigation,
  readNavigationQueries,
} from './helpers/scrollPendingNavigation';
import { testWithOptions } from './test-fixtures';
import { returnOnThreadRoute } from './helpers/scrollImmediateBack';
import { assessPendingThreadShell } from './helpers/threadLoadingShell';

const test = testWithOptions({
  appReadyTimeoutMs: 60_000,
  e2eMode: false,
  createdGroupCleanup: true,
});
test.describe('Actual continuous channel and thread navigation', () => {
  for (const cancel of [false, true]) {
    test(
      cancel
        ? 'immediate Back supersedes thread opening before its first reveal'
        : 'channel to thread and return preserve the first reveal and entire journey',
      async ({ zodPage: page, browser }, testInfo) => {
        test.setTimeout(300_000);
        await page.setViewportSize({ width: 1280, height: 800 });
        await helpers.createGroup(page);
        await helpers.navigateToChannel(page, 'General');
        const prefix = `Navigation ${randomUUID().slice(0, 8)}`;
        const texts = Array.from({ length: 24 }, (_, index) =>
          `${prefix} channel ${index}: ${'Original reading text stays in its place. '.repeat(1 + (index % 3))}`.trim()
        );
        const row = (text: string) =>
          page.locator('[data-postid]:visible').filter({
            has: page.getByTestId('Post').getByText(text, { exact: true }),
          });
        const channelRows: Record<string, string> = {};
        for (const text of texts) {
          await send(page, text, false, 30_000);
          // The real composer sends one terminal ASCII space in its wire
          // inline (preserved in r1's channel-action-2 request). Declare that
          // exact serialized text; never trim or infer a revision during capture.
          channelRows[await postId(row(text))] = `${text} `;
        }
        const channelRoute = new URL(page.url()).pathname;
        const parentText = texts[5];
        const parentId = Object.keys(channelRows).find(
          (id) => channelRows[id] === `${parentText} `
        )!;
        await helpers.startThread(page, parentText);
        const threadRoute = new URL(page.url()).pathname;
        expect(threadRoute).not.toBe(channelRoute);
        expect(decodeURIComponent(threadRoute)).toContain(
          `/post/~zod/${parentId}`
        );
        const threadRows: Record<string, string> = {
          [parentId]: `${parentText} `,
        };
        const replies = Array.from({ length: 18 }, (_, index) =>
          `${prefix} reply ${index}: ${'Thread text has an exact committed identity. '.repeat(1 + (index % 3))}`.trim()
        );
        let newestId = '';
        for (const text of replies) {
          await send(page, text, true, 30_000);
          newestId = await postId(row(text));
          threadRows[newestId] = `${text} `;
        }
        await settlePostScroller(
          await resolvePostScroller(row(replies.at(-1)!))
        );
        await page.goBack();
        await expect(page).toHaveURL((url) => url.pathname === channelRoute);
        const parent = row(parentText);
        await parent.scrollIntoViewIfNeeded();
        const scroller = await resolvePostScroller(parent);
        await settlePostScroller(scroller);
        // Establish the reading witness through an actual wheel, before capture.
        const box = await scroller.boundingBox();
        if (!box) throw new Error('Conversation viewport unavailable');
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        const offset = await parent.evaluate(
          (node, list) =>
            node.getBoundingClientRect().top -
            (list.getBoundingClientRect().top + list.clientTop + 100),
          scroller
        );
        await page.mouse.wheel(0, offset);
        await settlePostScroller(scroller);
        const baseline = await readNavigationAnchor(parent, `${parentText} `);
        expect(baseline.bottomGap).toBeGreaterThan(100);
        await expect(
          parent.getByText('18 replies', { exact: true })
        ).toBeVisible();
        await page.bringToFront();
        const preparation = await page.evaluate(async () => {
          const frameTimes: number[] = [],
            start = performance.now();
          while (performance.now() - start < 1000) {
            await new Promise(requestAnimationFrame);
            frameTimes.push(performance.now());
          }
          const runtime = window as Window & {
            TLON_IS_E2E?: boolean;
            ship?: string;
            __vite_plugin_react_preamble_installed__?: boolean;
          };
          return {
            origin: location.origin,
            route: location.pathname,
            normalFlags: runtime.TLON_IS_E2E !== true,
            ship: runtime.ship,
            developmentAssets:
              runtime.__vite_plugin_react_preamble_installed__ === true ||
              performance
                .getEntriesByType('resource')
                .some((entry) => entry.name.includes('/@vite/client')),
            frameTimes,
            declaredAt: performance.now(),
          };
        });
        expect(preparation.normalFlags).toBe(true);
        expect(preparation.ship).toBe('zod');
        expect(preparation.origin).toBe('http://localhost:3000');
        const plan: ScrollNavigationPlan = {
          version: 1,
          declaredAt: preparation.declaredAt,
          initial: 'channel',
          scopes: {
            channel: {
              kind: 'channel',
              route: channelRoute,
              rows: channelRows,
              landing: {
                kind: 'anchor',
                rowId: parentId,
                top: baseline.top,
                pointTop: baseline.pointTop,
              },
            },
            thread: {
              kind: 'thread',
              route: threadRoute,
              rows: threadRows,
              landing: { kind: 'bottom', newestId },
            },
          },
          commands: [
            {
              id: 'open-thread',
              from: 'channel',
              to: 'thread',
              trigger: { kind: 'click', text: '18 replies' },
            },
            {
              id: 'return-channel',
              from: 'thread',
              to: 'channel',
              trigger: { kind: 'popstate' },
              ...(cancel ? { cancels: 'open-thread' } : {}),
            },
          ],
          maxGapMs: 100,
          maxMeasurementMs: 32,
          maxOutgoingMs: 250,
          completionMs: 1000,
          quietTailMs: 1000,
          tolerancePx: 1,
        };
        await testInfo.attach('navigation-preparation', {
          body: JSON.stringify({
            ...preparation,
            browser: browser.version(),
            headed: testInfo.project.use.headless === false,
            viewport: { width: 1280, height: 800 },
            baseline,
            channelRows,
            threadRows,
            channelRoute,
            threadRoute,
          }),
          contentType: 'application/json',
        });
        await testInfo.attach('navigation-plan', {
          body: JSON.stringify(plan),
          contentType: 'application/json',
        });
        await testInfo.attach('navigation-before', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
        const capture = await startScrollNavigationTrace(
          page,
          plan,
          baseline.viewport
        );
        let raw!: ScrollNavigationTrace;
        try {
          await page.waitForTimeout(250);
          await capture.begin('open-thread');
          const trigger = parent.getByText('18 replies', { exact: true });
          if (cancel) {
            await returnOnThreadRoute(page, trigger, threadRoute, capture);
          } else {
            await trigger.click({ timeout: 10_000 });
            await capture.end('open-thread');
            await page.waitForTimeout(2000);
            await capture.begin('return-channel');
            await page.goBack({ timeout: 3000 });
            await capture.end('return-channel');
          }
          // Fixed capture deadline includes delayed callbacks even after a bad reveal.
          await page.waitForTimeout(2100);
        } finally {
          raw = await capture.stop();
          await testInfo.attach('navigation-raw', {
            body: JSON.stringify(raw),
            contentType: 'application/json',
          });
        }
        const assessment = assessScrollNavigationTrace(raw, plan);
        await testInfo.attach('navigation-assessment', {
          body: JSON.stringify(assessment),
          contentType: 'application/json',
        });
        await testInfo.attach('navigation-after', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
        expect(assessment.issues, JSON.stringify(assessment)).toEqual([]);
      }
    );
  }
  for (const kind of ['reply-sync', 'missing-parent'] as const) {
    test(
      kind === 'reply-sync'
        ? 'Back cancels a real pending reply sync after the cached parent reveals'
        : 'Back cancels a missing-parent reply reference before first thread content',
      async ({ zodPage: admin, browser }, testInfo) => {
        test.setTimeout(180_000);
        const fixture = await preparePendingNavigation(admin, browser, kind);
        // Reserve at least a minute after bounded setup for actions, raw drain and cleanup.
        test.setTimeout(240_000);
        const { page, row, proof } = fixture;
        try {
          const scroller = await resolvePostScroller(row);
          await settlePostScroller(scroller);
          const box = await scroller.boundingBox();
          if (!box)
            throw new Error('Original conversation viewport unavailable');
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          const offset = await row.evaluate(
            (node, list) =>
              node.getBoundingClientRect().top -
              list.getBoundingClientRect().top -
              list.clientTop -
              100,
            scroller
          );
          await page.mouse.wheel(0, offset);
          await settlePostScroller(scroller);
          const baseline = await readNavigationAnchor(row, fixture.anchorText);
          expect(baseline.bottomGap).toBeGreaterThan(100);
          await expect(
            row.getByText(fixture.triggerText, { exact: true })
          ).toBeVisible();
          const trigger =
            kind === 'missing-parent'
              ? row.locator('.is_ReferenceFrame').filter({
                  has: page.getByText(fixture.triggerText, { exact: true }),
                })
              : row.getByText(fixture.triggerText, { exact: true });
          await expect(trigger).toHaveCount(1, { timeout: 10_000 });
          await page.bringToFront();
          const preparation = await page.evaluate(async () => {
            const start = performance.now(),
              frameTimes: number[] = [];
            while (performance.now() - start < 1000) {
              await new Promise(requestAnimationFrame);
              frameTimes.push(performance.now());
            }
            const runtime = window as Window & {
              TLON_IS_E2E?: boolean;
              ship?: string;
              __vite_plugin_react_preamble_installed__?: boolean;
            };
            return {
              origin: location.origin,
              route: location.pathname,
              normalFlags: runtime.TLON_IS_E2E !== true,
              ship: runtime.ship,
              developmentAssets:
                runtime.__vite_plugin_react_preamble_installed__ === true ||
                performance
                  .getEntriesByType('resource')
                  .some((entry) => entry.name.includes('/@vite/client')),
              frameTimes,
              declaredAt: performance.now(),
            };
          });
          const threadRows =
            kind === 'reply-sync'
              ? { [proof.parentId]: proof.expectedRows[proof.parentId] }
              : proof.expectedRows;
          const newestId = Object.keys(threadRows)
            .sort((a, b) =>
              BigInt(a.replaceAll('.', '')) > BigInt(b.replaceAll('.', ''))
                ? 1
                : -1
            )
            .at(-1)!;
          const plan: ScrollNavigationPlan = {
            version: 1,
            declaredAt: preparation.declaredAt,
            initial: 'channel',
            scopes: {
              channel: {
                kind: 'channel',
                route: fixture.channelRoute,
                rows: fixture.channelRows,
                ...(fixture.textBlocks
                  ? { textBlocks: fixture.textBlocks }
                  : {}),
                landing: {
                  kind: 'anchor',
                  rowId: baseline.rowId,
                  top: baseline.top,
                  pointTop: baseline.pointTop,
                },
              },
              thread: {
                kind: 'thread',
                route: fixture.threadRoute,
                rows: threadRows,
                landing: { kind: 'bottom', newestId },
              },
            },
            commands: [
              {
                id: 'open-thread',
                from: 'channel',
                to: 'thread',
                trigger: {
                  kind: 'click',
                  ...(kind === 'missing-parent'
                    ? {
                        reference: {
                          rowId: baseline.rowId,
                          text: fixture.triggerText,
                        },
                      }
                    : { text: fixture.triggerText }),
                },
              },
              {
                id: 'return-channel',
                from: 'thread',
                to: 'channel',
                trigger: { kind: 'popstate' },
                ...(kind === 'reply-sync'
                  ? { cancelsPending: 'open-thread' }
                  : { cancels: 'open-thread' }),
              },
            ],
            maxGapMs: 100,
            maxMeasurementMs: 32,
            maxOutgoingMs: 250,
            completionMs: 1000,
            quietTailMs: 1000,
            tolerancePx: 1,
          };
          await testInfo.attach('navigation-preparation', {
            body: JSON.stringify({
              ...preparation,
              browser: browser.version(),
              headed: testInfo.project.use.headless === false,
              viewport: { width: 1280, height: 800 },
              baseline,
              channelRows: fixture.channelRows,
              threadRows,
              channelRoute: fixture.channelRoute,
              threadRoute: fixture.threadRoute,
              readerBackend: fixture.readerBackend,
            }),
            contentType: 'application/json',
          });
          await testInfo.attach('navigation-plan', {
            body: JSON.stringify(plan),
            contentType: 'application/json',
          });
          const capture = await startScrollNavigationTrace(
            page,
            plan,
            baseline.viewport
          );
          let raw: ScrollNavigationTrace | undefined;
          let actionError: unknown;
          let unavailable: string | undefined;
          try {
            await page.waitForTimeout(250);
            await capture.begin('open-thread');
            await trigger.click({ timeout: 10_000 });
            await capture.end('open-thread');
            await fixture.gate.requested();
            // This bounded dwell keeps the real transport pending long enough to
            // sample local-query completion and any visible blank/partial content.
            await page.waitForTimeout(200);
            proof.local = await readNavigationQueries(
              page,
              proof.parentId,
              proof.referenceReplyId
            );
            await capture.begin('return-channel');
            await page.goBack({ timeout: 3000 });
            await capture.end('return-channel');
            await page.waitForTimeout(200);
            fixture.gate.release();
            await fixture.gate.completed();
            await page.waitForTimeout(1200);
          } catch (error) {
            actionError = error;
          } finally {
            try {
              if (page.isClosed())
                unavailable = 'Page closed before capture drain';
              else raw = await capture.stop();
            } catch (error) {
              unavailable = String(error);
            }
            await testInfo.attach(
              raw ? 'navigation-raw' : 'navigation-capture-unavailable',
              {
                body: JSON.stringify(
                  raw ?? {
                    reason: unavailable ?? 'No raw capture',
                    at: Date.now(),
                  }
                ),
                contentType: 'application/json',
              }
            );
            await testInfo.attach('navigation-pending', {
              body: JSON.stringify(proof),
              contentType: 'application/json',
            });
          }
          if (actionError)
            await testInfo.attach('navigation-action-error', {
              body: JSON.stringify({
                message: String(actionError),
                at: Date.now(),
              }),
              contentType: 'application/json',
            });
          if (!raw)
            throw (
              actionError ??
              new Error(unavailable ?? 'Navigation capture unavailable')
            );
          const assessment = assessPendingNavigationTrace(raw, plan, proof);
          const shellAssessment =
            kind === 'missing-parent'
              ? assessPendingThreadShell(raw, plan, proof)
              : null;
          if (shellAssessment)
            await testInfo.attach('navigation-shell-assessment', {
              body: JSON.stringify(shellAssessment),
              contentType: 'application/json',
            });
          await testInfo.attach('navigation-assessment', {
            body: JSON.stringify(assessment),
            contentType: 'application/json',
          });
          if (!actionError && !page.isClosed())
            await testInfo.attach('navigation-after', {
              body: await page.screenshot({ timeout: 10_000 }),
              contentType: 'image/png',
            });
          if (actionError) throw actionError;
          expect(assessment.issues, JSON.stringify(assessment)).toEqual([]);
          if (shellAssessment)
            expect(
              shellAssessment.issues,
              JSON.stringify(shellAssessment)
            ).toEqual([]);
        } finally {
          await fixture.cleanup();
        }
      }
    );
  }
});
