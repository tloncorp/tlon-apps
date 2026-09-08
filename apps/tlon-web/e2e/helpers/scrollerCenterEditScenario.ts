import {
  expect,
  type Page,
  type Browser,
  type TestInfo,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  centerEditPlan,
  centerEditBelowPlan,
  centerEditBelowTitle,
  centerEditTitle,
  replayCenterEditEvidence,
} from '../../../../scripts/scroll-stability-center-edit-evidence.mjs';
import type { ScrollReadingContract } from '../../../../packages/app/fixtures/scrollReadingTrace';
import * as helpers from '../helpers';
import { currentLocalChannel, post } from './scrollerContentScenario';
import { writeReferencePosts } from './scrollerReferenceScenario';
import { resolvePostScroller, settlePostScroller } from './scrollers';
import { resolveReadingBlock, startScrollReadingTrace } from './scrollReading';
import {
  finalizeCenterEditEvidence,
  performCenterEdit,
  readCenterEditWindow,
  recordCenterEditRequests,
  startCenterEditObserver,
} from './scrollerCenterEdit';

export async function runCenterEditScenario(
  page: Page,
  browser: Browser,
  testInfo: TestInfo,
  title = centerEditTitle
) {
  const token = randomUUID().slice(0, 8);
  const plan =
    title === centerEditTitle
      ? centerEditPlan(token)
      : title === centerEditBelowTitle
        ? centerEditBelowPlan(token)
        : (() => {
            throw new Error('Unknown center edit case title');
          })();
  await page.setViewportSize({ width: 1280, height: 800 });
  await helpers.createGroup(page);
  await helpers.navigateToChannel(page, 'General');
  const { channelId: channel } = currentLocalChannel(page);
  await writeReferencePosts(
    page.request,
    channel,
    plan.corpus.map((text) => [{ inline: [text] }])
  );
  await expect(post(page, plan.corpus.at(-1)!)).toBeVisible({
    timeout: 30_000,
  });
  const initialReader = post(page, plan.corpus[18]),
    initialEdited = post(page, plan.original);
  await expect(initialReader).toHaveCount(1);
  await expect(initialEdited).toHaveCount(1);
  const readerId = (await initialReader.getAttribute('data-postid'))!,
    editedId = (await initialEdited.getAttribute('data-postid'))!;
  const reader = page.locator(`[data-postid="${readerId}"]`);
  const edited = page.locator(`[data-postid="${editedId}"]`);
  const list = await resolvePostScroller(post(page, plan.corpus.at(-1)!));
  await settlePostScroller(list);
  const observer = await startCenterEditObserver(list, editedId);
  let reading: Awaited<ReturnType<typeof startScrollReadingTrace>> | undefined;
  let requests: ReturnType<typeof recordCenterEditRequests> | undefined;
  const proof: any = {
    plan,
    channel,
    readerId,
    editedId,
    errors: [],
    commits: [],
  };
  let capturedError: unknown;
  try {
    const bounds = await list.boundingBox();
    if (!bounds) throw new Error('List is unavailable');
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2
    );
    await page.mouse.wheel(0, -400);
    await settlePostScroller(list);
    for (let attempt = 0; attempt < 3; attempt++) {
      // Setup wheels can reveal an author/header and change child positions.
      // Reacquire exact declared text inside the same canonical post each time.
      const semantic = await resolveReadingBlock(reader, plan.corpus[18]);
      const delta = await reader.locator(semantic.selector).evaluate(
        (block, { list, start }) => {
          const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
          let node: Node | null,
            offset = 0;
          while ((node = walker.nextNode())) {
            const count = node.textContent?.length ?? 0;
            if (start < offset + count) {
              const range = document.createRange();
              range.setStart(node, start - offset);
              range.setEnd(node, start - offset + 1);
              return (
                range.getBoundingClientRect().top -
                (list.getBoundingClientRect().top + list.clientHeight / 2)
              );
            }
            offset += count;
          }
          throw new Error('Declared character is absent');
        },
        { list, start: plan.charStart }
      );
      if (Math.abs(delta) <= 1) break;
      await page.mouse.wheel(0, delta);
      await settlePostScroller(list);
    }
    let before: Awaited<ReturnType<typeof readCenterEditWindow>>;
    await expect
      .poll(
        async () => {
          before = await readCenterEditWindow(page, channel);
          const posts = Object.values(before.body.posts ?? {}) as any[];
          return (
            posts.length === 36 &&
            plan.corpus.every(
              (text) =>
                posts.filter((p) =>
                  isDeepStrictEqual(p.essay.content, [{ inline: [text] }])
                ).length === 1
            )
          );
        },
        { timeout: 10_000 }
      )
      .toBe(true);
    proof.before = before!;
    proof.preparation = await page.evaluate(() => ({
      scope: location.pathname,
      origin: location.origin,
      ship: (window as any).ship,
      e2eMode: (window as any).TLON_IS_E2E === true,
      timeOrigin: performance.timeOrigin,
      time: performance.now(),
      wall: Date.now(),
      resources: performance.getEntriesByType('resource').map((r) => r.name),
    }));
    proof.preparation.headed = testInfo.project.use.headless === false;
    proof.preparation.browser = browser.version();
    proof.preparation.viewport = page.viewportSize();
    expect(proof.preparation.e2eMode).toBe(false);
    const preparationObserver = await observer.snapshot();
    proof.wheel = preparationObserver.wheel;
    proof.preparation.wheelStartedAt = preparationObserver.startedAt;
    await observer.beginCapture();
    const semantic = await resolveReadingBlock(reader, plan.corpus[18]);
    const rowHandle = await reader.elementHandle();
    if (!rowHandle) throw new Error('Reader lost before capture');
    reading = await startScrollReadingTrace(list, rowHandle, {
      blockSelector: semantic.selector,
      start: plan.charStart,
      end: plan.charEnd,
    });
    const b = reading.baseline;
    if (!b.point) throw new Error('No baseline character');
    expect(
      Math.abs(b.point.relativeY - b.list.rect.height / 2)
    ).toBeLessThanOrEqual(24);
    expect(
      b.point.fragment.hits.every((h) => h.stack[0]?.relation === 'owner')
    ).toBe(true);
    expect(b.point.fragment.presentation.clip.height).toBe(
      b.point.fragment.presentation.rect.height
    );
    const initial = (await observer.snapshot()).frames[0];
    expect(initial.offset).toBeGreaterThan(200);
    expect(initial.extent - initial.height - initial.offset).toBeGreaterThan(
      200
    );
    expect(initial.edited.top).toBeGreaterThan(140);
    if (title === centerEditBelowTitle) {
      expect(initial.edited.top).toBeGreaterThan(b.point.relativeY);
      expect(initial.edited.top + initial.edited.height).toBeLessThan(
        initial.height
      );
    } else {
      expect(initial.edited.top + initial.edited.height).toBeLessThan(
        b.point.relativeY
      );
    }
    requests = recordCenterEditRequests(
      page,
      channel,
      proof.preparation.timeOrigin
    );
    // No geometric assertion occurs between edits, so a recorded first drift
    // does not starve the accepted second revision. Semantic prerequisites do.
    const expanded = await performCenterEdit(
      page,
      edited,
      list,
      channel,
      editedId,
      plan.original,
      plan.expanded,
      () =>
        requests!.waitForHeaders(0, editedId, [
          { inline: [plan.expanded + ' '] },
        ])
    );
    proof.commits.push(expanded);
    expect(expanded.height - initial.edited.height).toBeGreaterThanOrEqual(32);
    await observer.wait(100);
    const shrunk = await performCenterEdit(
      page,
      edited,
      list,
      channel,
      editedId,
      plan.expanded + ' ',
      plan.shrunk,
      () =>
        requests!.waitForHeaders(1, editedId, [{ inline: [plan.shrunk + ' '] }])
    );
    proof.commits.push(shrunk);
    expect(expanded.height - shrunk.height).toBeGreaterThanOrEqual(32);
    const terminal = await reading.markTerminal();
    proof.readingContract = {
      scope: reading.scope,
      rowId: readerId,
      blockSelector: semantic.selector,
      revision: { id: readerId + ':unchanged', text: plan.corpus[18] },
      point: {
        start: plan.charStart,
        end: plan.charEnd,
        x: b.point.relativeX,
        y: b.point.relativeY,
        tolerancePx: 1,
      },
      coverage: {
        startTime: b.time,
        endTime: terminal + 1000,
        maxGapMs: 100,
        maxMeasurementDurationMs: 32,
      },
      terminalTime: terminal,
    } satisfies ScrollReadingContract;
    await reading.wait(1000);
    // Stop both collectors before large transfer, backend read or serialization.
    await observer.freeze();
    await reading.freeze();
  } catch (error) {
    capturedError = error;
    proof.errors.push(String(error));
  } finally {
    await finalizeCenterEditEvidence({
      proof,
      observer,
      reading,
      requests,
      afterCapture: capturedError
        ? undefined
        : async () => {
            proof.after = await readCenterEditWindow(page, channel);
          },
      attach: (name, value) =>
        testInfo.attach(name, {
          body: JSON.stringify(value),
          contentType: 'application/json',
        }),
    });
  }
  if (capturedError) throw capturedError;
  // Runtime uses a local attempt envelope only for immediate feedback. An
  // importer must independently use enclosing Playwright startTime/duration.
  const assessment = replayCenterEditEvidence(proof, {
    title,
    startTime: new Date(proof.preparation.wall - 100).toISOString(),
    duration: Date.now() - proof.preparation.wall + 200,
  });
  await testInfo.attach('center-edit-reading-assessment', {
    body: JSON.stringify(assessment),
    contentType: 'application/json',
  });
  expect(assessment.verdict, JSON.stringify(assessment.issues)).toBe('PASS');
}
