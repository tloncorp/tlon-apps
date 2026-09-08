import { expect } from '@playwright/test';
import { assessScrollReadingTrace } from '../../../packages/app/fixtures/scrollReadingTrace';
import {
  assessScrollReferenceTrace,
  type ScrollReferenceContract,
} from '../../../packages/app/fixtures/scrollReferenceTrace';
import {
  prepareUncachedReference,
  readReferenceSource,
  writeReferencePosts,
} from './helpers/scrollerReferenceScenario';
import {
  resolveReadingBlock,
  startScrollReadingTrace,
} from './helpers/scrollReading';
import {
  expectBottomPinned,
  expectValidScrollTrace,
  settlePostScroller,
  startScrollTrace,
} from './helpers/scrollers';
import { testWithOptions } from './test-fixtures';

const test = testWithOptions({
  appReadyTimeoutMs: 60_000,
  e2eMode: false,
  createdGroupCleanup: true,
});
test.use({ actionTimeout: 10_000 });

for (const position of ['latest', 'history'] as const) {
  test(`uncached reference resolves and updates without moving the reading character (${position})`, async ({
    zodPage,
    browser,
  }, testInfo) => {
    test.setTimeout(240_000);
    const fixture = await prepareUncachedReference(
      zodPage,
      browser,
      position === 'history'
    );
    const { page, row, scroller } = fixture;
    const pending = 'Loading remote content...';
    const error = 'Content not available';
    const assessments: ReturnType<typeof assessScrollReferenceTrace>[] = [];
    const geometryFailures: string[] = [];
    try {
      await expect(row).toBeVisible();
      await expect(row.getByText(pending, { exact: true })).toBeVisible();
      expect(
        fixture.requests,
        'Actual uncached post-reference subscription must be held'
      ).toHaveLength(1);
      expect(fixture.requests[0].releasedAt).toBeUndefined();
      expect((fixture.source.essay as { author: string }).author).toBe('~zod');
      await settlePostScroller(scroller);
      const gap = await scroller.evaluate(
        (list) => list.scrollHeight - list.clientHeight - list.scrollTop
      );
      if (position === 'history') expect(gap).toBeGreaterThan(100);
      else expect(Math.abs(gap)).toBeLessThanOrEqual(1);
      const semantic = await resolveReadingBlock(row, fixture.paragraph);
      const rowHandle = await row.elementHandle();
      const rowId = await row.getAttribute('data-postid');
      if (!rowHandle || !rowId)
        throw new Error('Real reference post identity is unavailable');
      const start = fixture.paragraph.indexOf('reading');
      for (const phase of ['load', 'edit'] as const) {
        const label = `reference-${position}-${phase}`;
        const beforeText = phase === 'load' ? pending : fixture.first;
        const afterText = phase === 'load' ? fixture.first : fixture.second;
        const forbiddenTexts =
          phase === 'load' ? [error, fixture.second] : [error, pending];
        const geometry = await startScrollTrace(scroller, [rowId]);
        const reading = await startScrollReadingTrace(scroller, rowHandle, {
          blockSelector: semantic.selector,
          start,
          end: start + 1,
          observedTexts: [beforeText, afterText, ...forbiddenTexts],
          observedElements: ['.is_PostReferenceAuthorName'],
        });
        let stopped = false;
        let editWrite:
          | Awaited<ReturnType<typeof writeReferencePosts>>['transport']
          | undefined;
        try {
          expect(reading.baseline.point).not.toBeNull();
          const baselinePoint = reading.baseline.point!.fragment.presentation;
          expect(baselinePoint.connected && baselinePoint.displayed).toBe(true);
          expect(baselinePoint.opacity).toBeGreaterThanOrEqual(0.99);
          expect(
            baselinePoint.rect.height - baselinePoint.clip.height,
            'Required reading character is fully exposed before the action'
          ).toBeLessThanOrEqual(1);
          expect(
            baselinePoint.rect.width - baselinePoint.clip.width
          ).toBeLessThanOrEqual(1);
          await reading.wait(220);
          await geometry.mark(`${label}:start`);
          const actionTime = await page.evaluate(() => performance.now());
          if (phase === 'load') fixture.release();
          else {
            const edited = await writeReferencePosts(
              fixture.request,
              fixture.sourceChannel,
              [[{ inline: [fixture.second] }]],
              fixture.id,
              page
            );
            editWrite = edited.transport;
          }
          await expect(row.getByText(afterText, { exact: true })).toBeVisible({
            timeout: 10_000,
          });
          await expect(row.getByText(beforeText, { exact: true })).toHaveCount(
            0
          );
          const terminalTime = await reading.markTerminal();
          await geometry.mark(`${label}:terminal-state`);
          await reading.wait(1020);
          await reading.freeze();
          const geometryTrace = await geometry.stop(
            testInfo,
            `${label}-geometry`
          );
          const trace = await reading.stop(testInfo, `${label}-reading-raw`);
          stopped = true;
          const referenceContract: ScrollReferenceContract = {
            authorSelector: '.is_PostReferenceAuthorName',
            authorLabel: '~zod',
            beforeText,
            afterText,
            forbiddenTexts,
            actionTime,
            reading: {
              scope: fixture.preparation.scope,
              rowId,
              blockSelector: semantic.selector,
              revision: {
                id: `reference-reader-${rowId}`,
                text: fixture.paragraph,
              },
              point: {
                start,
                end: start + 1,
                x: reading.baseline.point!.relativeX,
                y: reading.baseline.point!.relativeY,
                tolerancePx: 1,
              },
              coverage: {
                startTime: reading.baseline.time,
                endTime: terminalTime + 1000,
                maxGapMs: 100,
                maxMeasurementDurationMs: 32,
              },
              terminalTime,
            },
          };
          const assessment = assessScrollReferenceTrace(
            trace,
            referenceContract,
            assessScrollReadingTrace
          );
          assessments.push(assessment);
          const containingAfter = await readReferenceSource(
            fixture.request,
            fixture.destination,
            fixture.paragraph,
            page
          );
          await testInfo.attach(`${label}-proof`, {
            contentType: 'application/json',
            body: JSON.stringify({
              trace,
              contract: referenceContract,
              assessment,
              requests: fixture.requests,
              source: fixture.source,
              sourceChannel: fixture.sourceChannel,
              sourceId: fixture.id,
              containingEssay: fixture.story,
              containingBefore: fixture.containingBefore,
              containingAfter,
              editWrite,
              preparation: {
                ...fixture.preparation,
                browser: browser.version(),
                channel: 'chromium',
                headed: testInfo.project.use.headless === false,
                assets: 'Vite development assets',
              },
              clockDomains: {
                transport: 'Date.now milliseconds',
                capture: 'performance.now milliseconds',
              },
            }),
          });
          // Preserve a detected load violation while still observing the
          // independent source-edit phase; every failure is asserted below.
          try {
            expectValidScrollTrace(geometryTrace);
            if (position === 'latest') expectBottomPinned(geometryTrace);
          } catch (error) {
            geometryFailures.push(`${label}: ${String(error)}`);
          }
        } finally {
          if (!stopped) {
            await reading.freeze();
            await geometry
              .stop(testInfo, `${label}-geometry-incomplete`)
              .catch(() => {});
            await reading
              .stop(testInfo, `${label}-reading-incomplete`)
              .catch(() => {});
          }
        }
      }
      const committed = await readReferenceSource(
        fixture.request,
        fixture.sourceChannel,
        fixture.second,
        page
      );
      expect(String(committed.seal.id).replace(/\./g, '')).toBe(
        fixture.id.replace(/\./g, '')
      );
      await testInfo.attach(`reference-${position}-committed-edit`, {
        contentType: 'application/json',
        body: JSON.stringify(committed),
      });
      await testInfo.attach(`reference-${position}-final`, {
        contentType: 'image/png',
        body: await page.screenshot(),
      });
      await rowHandle.dispose();
      for (const assessment of assessments)
        expect(assessment.verdict, JSON.stringify(assessment)).toBe('PASS');
      expect(geometryFailures).toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });
}
