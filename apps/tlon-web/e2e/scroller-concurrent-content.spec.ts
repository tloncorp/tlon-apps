import { expect } from '@playwright/test';
import { startWebAssetCapture } from './helpers/scrollerWebAssets';
import { assessProductionAssets } from '../../../scripts/scroll-stability-web-assets.cjs';
import {
  assessConcurrentContentEvidence,
  type ConcurrentContentProof,
} from '../../../packages/app/fixtures/scrollConcurrentContentTrace';
import { assessScrollReadingTrace } from '../../../packages/app/fixtures/scrollReadingTrace';
import { prepareConcurrentContent } from './helpers/scrollerConcurrentContentScenario';
import { startScrollContentTrace } from './helpers/scrollContent';
import { startScrollChromeTrace } from './helpers/scrollChrome';
import {
  resolveReadingBlock,
  startScrollReadingTrace,
} from './helpers/scrollReading';
import { startScrollTrace } from './helpers/scrollers';
import { testWithOptions } from './test-fixtures';

const test = testWithOptions({ appReadyTimeoutMs: 60_000, e2eMode: false });
test.use({ actionTimeout: 10_000 });
for (const position of ['latest', 'history'] as const)
  for (const first of ['portrait', 'landscape'] as const) {
    test(`two real images finish ${first} first without disturbing ${position === 'history' ? 'history near bottom' : position}`, async ({
      zodPage: page,
      browser,
    }, testInfo) => {
      test.setTimeout(240_000);
      const assertionStartedAt = Date.now();
      const assetCapture = await startWebAssetCapture(page);
      const fixture = await prepareConcurrentContent(page, position);
      const { row, scroller, rowId, paragraph } = fixture;
      const rowHandle = await row.elementHandle();
      if (!rowHandle) throw new Error('Missing immutable post');
      const semantic = await resolveReadingBlock(row, paragraph);
      const start = paragraph.indexOf('reading');
      const geometry = await startScrollTrace(scroller, [rowId]);
      const chrome = await startScrollChromeTrace(
        scroller,
        'unexpected-latest-click'
      );
      const images = await Promise.all(
        fixture.assets.map((asset) =>
          startScrollContentTrace(scroller, rowHandle, asset.src, paragraph)
        )
      );
      const reading = await startScrollReadingTrace(scroller, rowHandle, {
        blockSelector: semantic.selector,
        start,
        end: start + 1,
      });
      let stopped = false;
      try {
        const point = reading.baseline.point;
        expect(point).not.toBeNull();
        expect(
          point!.fragment.presentation.connected &&
            point!.fragment.presentation.displayed
        ).toBe(true);
        expect(point!.fragment.presentation.opacity).toBeGreaterThanOrEqual(
          0.99
        );
        expect(point!.fragment.textAlpha).toBeGreaterThanOrEqual(0.99);
        expect(point!.fragment.hits).toHaveLength(3);
        expect(
          point!.fragment.hits.every(
            (hit) =>
              hit.stack[0]?.relation === 'owner' ||
              (point!.fragment.pointerEvents === 'none' &&
                hit.stack[0]?.relation === 'ancestor')
          )
        ).toBe(true);
        expect(
          point!.fragment.presentation.rect.height -
            point!.fragment.presentation.clip.height
        ).toBeLessThanOrEqual(1);
        expect(
          point!.fragment.presentation.rect.width -
            point!.fragment.presentation.clip.width
        ).toBeLessThanOrEqual(1);
        const gap = await scroller.evaluate(
          (list) => list.scrollHeight - list.clientHeight - list.scrollTop
        );
        if (position === 'history') expect(gap).toBeGreaterThan(300);
        else expect(Math.abs(gap)).toBeLessThanOrEqual(1);
        const order: [string, string] =
          first === 'portrait'
            ? ['portrait', 'landscape']
            : ['landscape', 'portrait'];
        const releaseTimes = [0, 0],
          readyTimes = [0, 0];
        await reading.wait(270);
        for (const id of order) {
          const index = fixture.assets.findIndex((asset) => asset.id === id);
          releaseTimes[index] = await images[index].mark('response-release');
          fixture.release(index);
          await expect
            .poll(() => images[index].decoded(), { timeout: 10_000 })
            .toBe(true);
          readyTimes[index] = await images[index].mark('ready-observed');
          if (id === first) await reading.wait(270);
        }
        const terminalTime = await reading.markTerminal();
        await reading.wait(1020);
        await reading.freeze();
        // Dispatch all existing stop APIs together before attaching their results.
        // Their raw end gaps remain checked, including transport/serialization lag.
        const [geometryTrace, chromeTrace, ...imageTraces] = await Promise.all([
          geometry.stop(),
          chrome.stop(),
          ...images.map((image) => image.stop()),
        ]);
        const readingTrace = await reading.stop();
        stopped = true;
        const proof: ConcurrentContentProof = {
          version: 1,
          position,
          chromeEligibility: {
            thresholdViewportRatio: 1,
            baselineBottomGap: gap,
            baselineViewportHeight: reading.baseline.list.rect.height,
            visibility:
              gap / reading.baseline.list.rect.height > 1
                ? 'visible'
                : 'hidden',
            mode:
              position === 'latest'
                ? 'at-end'
                : gap / reading.baseline.list.rect.height > 1
                  ? 'visible-away'
                  : 'hidden-near-bottom',
          },
          order,
          preparation: {
            ...fixture.preparation,
            browser: browser.version(),
            channel: 'chromium',
            headed: true,
            assets: assetCapture.assets,
            assetProof: await assetCapture.finish(),
          },
          before: fixture.before,
          after: await fixture.readAfter(),
          requests: fixture.requests,
          media: fixture.assets.map((asset, index) => ({
            ...asset,
            bytes: asset.bytes.length,
            png: asset.bytes.toString('base64'),
            releaseTime: releaseTimes[index],
            readyTime: readyTimes[index],
            trace: imageTraces[index] as Awaited<
              ReturnType<(typeof images)[number]['stop']>
            >,
          })),
          geometry: geometryTrace as Awaited<ReturnType<typeof geometry.stop>>,
          chrome: chromeTrace as Awaited<ReturnType<typeof chrome.stop>>,
          reading: {
            trace: readingTrace,
            contract: {
              scope: fixture.preparation.scope,
              rowId,
              blockSelector: semantic.selector,
              revision: { id: `concurrent-${rowId}`, text: paragraph },
              point: {
                start,
                end: start + 1,
                x: point!.relativeX,
                y: point!.relativeY,
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
          },
        };
        const assessment = assessConcurrentContentEvidence(
          proof,
          assessScrollReadingTrace
        );
        await testInfo.attach(`concurrent-${position}-${first}-proof`, {
          contentType: 'application/json',
          body: JSON.stringify(proof),
        });
        await testInfo.attach(`concurrent-${position}-${first}-assessment`, {
          contentType: 'application/json',
          body: JSON.stringify(assessment),
        });
        await testInfo.attach(`concurrent-${position}-${first}-final`, {
          contentType: 'image/png',
          body: await page.screenshot(),
        });
        if (assetCapture.assets === 'Built production assets')
          expect(
            assessProductionAssets(proof.preparation.assetProof, {
              origin: proof.preparation.origin,
              scope: proof.preparation.scope,
              attemptStartTime: new Date(assertionStartedAt).toISOString(),
              attemptDurationMs: Date.now() - assertionStartedAt,
              performanceEndTime: proof.reading.contract.coverage.endTime,
            })
          ).toEqual([]);
        expect(assessment.verdict, JSON.stringify(assessment)).toBe('PASS');
      } finally {
        assetCapture.dispose();
        if (!stopped) {
          await reading.freeze();
          await Promise.allSettled([
            geometry.stop(testInfo, 'concurrent-incomplete-geometry'),
            chrome.stop(testInfo, 'concurrent-incomplete-chrome'),
            ...images.map((image, index) =>
              image.stop(testInfo, `concurrent-incomplete-image-${index}`)
            ),
          ]);
          await reading
            .stop(testInfo, 'concurrent-incomplete-reading')
            .catch(() => {});
        }
        await fixture.cleanup();
        await rowHandle.dispose();
      }
    });
  }
