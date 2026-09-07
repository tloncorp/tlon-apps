import { expect } from '@playwright/test';
import { startWebAssetCapture } from './helpers/scrollerWebAssets';
import { assessProductionAssets } from '../../../scripts/scroll-stability-web-assets.cjs';
import { randomUUID } from 'node:crypto';

import {
  assessScrollReadingTrace,
  type ScrollReadingContract,
} from '../../../packages/app/fixtures/scrollReadingTrace';
import { startScrollContentTrace } from './helpers/scrollContent';
import {
  prepareDelayedImage,
  readImageEssay,
} from './helpers/scrollerContentScenario';
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

const test = testWithOptions({ appReadyTimeoutMs: 60_000, e2eMode: false });
test.use({ actionTimeout: 10_000 });

// Real application, committed content, actual image bytes and ImageBlock state.
// No synthetic DOM/content replacement or detector fault injection occurs here.
for (const position of ['latest', 'history'] as const) {
  test(`rich-text reading point survives actual image decode in the same post (${position})`, async ({
    zodPage: page,
    browser,
  }, testInfo) => {
    test.setTimeout(180_000);
    const assertionStartedAt = Date.now();
    const assetCapture = await startWebAssetCapture(page);
    const prefix = `Reader ${randomUUID().slice(0, 8)}: plain words, `;
    const text = `${prefix}reading point stable() and unchanged trailing text.`;
    const inlines = [
      prefix,
      { bold: ['reading'] },
      ' ',
      { italics: ['point'] },
      ' ',
      { 'inline-code': 'stable()' },
      ' and unchanged trailing text.',
    ];
    const fixture = await prepareDelayedImage(page, position === 'history', {
      caption: text,
      inlines,
      imageFirst: true,
      viewport: { width: 1280, height: 800 },
    });
    const label = `production-reading-image-${position}`;
    const { row, image, scroller, imagePostId } = fixture;
    let reading:
      | Awaited<ReturnType<typeof startScrollReadingTrace>>
      | undefined;
    let loading:
      | Awaited<ReturnType<typeof startScrollContentTrace>>
      | undefined;
    let geometry: Awaited<ReturnType<typeof startScrollTrace>> | undefined;
    let rowHandle: Awaited<ReturnType<typeof row.elementHandle>> | undefined;
    try {
      const semantic = await resolveReadingBlock(row, text);
      expect(
        semantic.descendants.some(
          (node) => node.text === 'reading' && Number(node.fontWeight) >= 600
        ),
        'Actual bold inline rendered'
      ).toBe(true);
      expect(
        semantic.descendants.some(
          (node) => node.text === 'point' && node.fontStyle === 'italic'
        ),
        'Actual italic inline rendered'
      ).toBe(true);
      expect(
        semantic.descendants.some(
          (node) =>
            node.text === 'stable()' && /mono|courier/i.test(node.fontFamily)
        ),
        'Actual inline code rendered'
      ).toBe(true);
      if (position === 'history') {
        const delta = await row
          .locator(semantic.selector)
          .evaluate(
            (block, list) =>
              block.getBoundingClientRect().top -
              (list.getBoundingClientRect().top +
                list.clientTop +
                list.clientHeight / 2),
            scroller
          );
        const bounds = await scroller.boundingBox();
        if (!bounds) throw new Error('Actual list is unavailable');
        await page.mouse.move(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2
        );
        await page.mouse.wheel(0, delta);
        await settlePostScroller(scroller);
        expect(
          await scroller.evaluate(
            (list) => list.scrollHeight - list.clientHeight - list.scrollTop
          )
        ).toBeGreaterThan(100);
      } else {
        expect(
          await scroller.evaluate((list) =>
            Math.abs(list.scrollHeight - list.clientHeight - list.scrollTop)
          )
        ).toBeLessThanOrEqual(1);
      }
      await page.bringToFront();
      const preparation = await page.evaluate(async () => {
        const startTime = performance.now();
        const frames: number[] = [];
        while (performance.now() - startTime < 2000) {
          await new Promise(requestAnimationFrame);
          frames.push(performance.now());
        }
        return {
          startTime,
          frames,
          ship: (window as any).ship,
          e2eMode: (window as any).TLON_IS_E2E === true,
          developmentAssets:
            performance
              .getEntriesByType('resource')
              .some((entry) => entry.name.includes('/@vite/client')) ||
            (window as any).__vite_plugin_react_preamble_installed__ === true,
          scope: location.pathname,
          origin: location.origin,
        };
      });
      expect(preparation.ship).toBe('zod');
      expect(preparation.e2eMode).toBe(false);
      expect(
        preparation.developmentAssets,
        'Observed Vite development runtime matches declared scope'
      ).toBe(assetCapture.assets === 'Vite development assets');
      await testInfo.attach(`${label}-preparation`, {
        body: JSON.stringify({
          ...preparation,
          browser: browser.version(),
          channel: 'chromium',
          headed: true,
          assets: assetCapture.assets,
          semantic,
          expectedText: text,
          inlines,
        }),
        contentType: 'application/json',
      });
      await testInfo.attach(`${label}-before`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
      rowHandle = await row.elementHandle();
      if (!rowHandle) throw new Error('Original actual post unavailable');
      const beforeRow = await row.boundingBox();
      const beforeImage = await image.boundingBox();
      if (!beforeRow || !beforeImage)
        throw new Error('Image/post geometry unavailable');
      const start = text.indexOf('reading');
      geometry = await startScrollTrace(scroller, [imagePostId]);
      reading = await startScrollReadingTrace(scroller, rowHandle, {
        blockSelector: semantic.selector,
        start,
        end: start + 1,
      });
      expect(
        reading.baseline.point,
        'The declared character must be present before decode'
      ).not.toBeNull();
      // Reuse the actual image load/decode observer. Its image-exposure oracle is
      // intentionally not applied: history may legally clip the image above the
      // paragraph. Whole-paragraph semantics are checked by the reading oracle.
      loading = await startScrollContentTrace(
        scroller,
        rowHandle,
        fixture.src,
        'reading'
      );
      await reading.wait(250);
      const beforeDecode = await image.evaluate(
        (element: HTMLImageElement) => ({
          complete: element.complete,
          width: element.naturalWidth,
          height: element.naturalHeight,
        })
      );
      expect(beforeDecode).toEqual({ complete: false, width: 0, height: 0 });
      expect(fixture.requests.length).toBeGreaterThan(0);
      expect(
        fixture.requests.every((request) => request.releasedAt === undefined)
      ).toBe(true);
      await geometry.mark(`${label}:response-release`);
      const releaseTime = await loading.mark('response-release');
      fixture.releaseResponse();
      await expect.poll(loading.decoded, { timeout: 10_000 }).toBe(true);
      const afterDecode = await image.evaluate((element: HTMLImageElement) => ({
        complete: element.complete,
        width: element.naturalWidth,
        height: element.naturalHeight,
      }));
      expect(afterDecode).toEqual({ complete: true, width: 2, height: 1 });
      await expect
        .poll(async () =>
          Math.abs((await row.boundingBox())!.height - beforeRow.height)
        )
        .toBeGreaterThan(16);
      await geometry.mark(`${label}:image-decoded`);
      const terminalTime = await reading.markTerminal();
      await reading.wait(1000);
      await reading.freeze();
      const geometryTrace = await geometry.stop(testInfo, `${label}-geometry`);
      geometry = undefined;
      const loadingTrace = await loading.stop(
        testInfo,
        `${label}-image-events`
      );
      loading = undefined;
      const trace = await reading.stop(testInfo, `${label}-reading-raw`);
      const baseline = reading.baseline;
      reading = undefined;
      const contract: ScrollReadingContract = {
        scope: preparation.scope,
        rowId: imagePostId,
        blockSelector: semantic.selector,
        revision: { id: `committed-post-${imagePostId}`, text },
        point: {
          start,
          end: start + 1,
          x: baseline.point!.relativeX,
          y: baseline.point!.relativeY,
          tolerancePx: 1,
        },
        coverage: {
          startTime: baseline.time,
          endTime: terminalTime + 1000,
          maxGapMs: 100,
          maxMeasurementDurationMs: 32,
        },
        terminalTime,
      };
      const assessment = assessScrollReadingTrace(trace, contract);
      await testInfo.attach(`${label}-reading-proof`, {
        body: JSON.stringify({ trace, contract, assessment }),
        contentType: 'application/json',
      });
      const afterEssay = await readImageEssay(page, fixture.src);
      const afterRow = await row.boundingBox();
      const afterImage = await image.boundingBox();
      await testInfo.attach(`${label}-loading-proof`, {
        body: JSON.stringify({
          scope: preparation.scope,
          origin: preparation.origin,
          src: fixture.src,
          imagePostId,
          beforeEssay: fixture.beforeEssay,
          afterEssay,
          beforeRow,
          afterRow,
          beforeImage,
          afterImage,
          beforeDecode,
          afterDecode,
          requests: fixture.requests,
          releaseTime,
          terminalTime,
          events: loadingTrace.events,
          clockDomains: {
            route: 'Date.now milliseconds',
            samplesAndEvents: 'performance.now milliseconds',
          },
        }),
        contentType: 'application/json',
      });
      await testInfo.attach(`${label}-after`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
      const assetProof = await assetCapture.finish();
      if (assetProof)
        await testInfo.attach(`${label}-asset-proof`, {
          body: JSON.stringify(assetProof),
          contentType: 'application/json',
        });
      if (assetCapture.assets === 'Built production assets')
        expect(
          assessProductionAssets(assetProof, {
            origin: preparation.origin,
            scope: preparation.scope,
            attemptStartTime: new Date(assertionStartedAt).toISOString(),
            attemptDurationMs: Date.now() - assertionStartedAt,
            performanceEndTime: contract.coverage.endTime,
          })
        ).toEqual([]);
      expect(afterEssay).toEqual(fixture.beforeEssay);
      const load = loadingTrace.events.filter(
        (event) => event.id === 'image-load'
      );
      const decode = loadingTrace.events.filter(
        (event) => event.id === 'image-decoded'
      );
      expect(load).toHaveLength(1);
      expect(decode).toHaveLength(1);
      expect(
        loadingTrace.events.filter((event) => event.id === 'image-error')
      ).toHaveLength(0);
      for (const event of [...load, ...decode]) {
        expect(event).toMatchObject({
          scope: preparation.scope,
          src: `${preparation.origin}${fixture.src}`,
          currentSrc: `${preparation.origin}${fixture.src}`,
          trusted: true,
          originalTarget: true,
        });
        expect(event.time).toBeGreaterThanOrEqual(releaseTime);
        expect(event.time).toBeLessThanOrEqual(terminalTime);
      }
      expect(decode[0].time).toBeGreaterThanOrEqual(load[0].time);
      expectValidScrollTrace(geometryTrace);
      if (position === 'latest') expectBottomPinned(geometryTrace);
      expect(assessment.verdict, JSON.stringify(assessment)).toBe('PASS');
    } finally {
      assetCapture.dispose();
      if (reading) await reading.freeze();
      if (geometry)
        await geometry.stop(testInfo, `${label}-geometry-incomplete`);
      if (loading)
        await loading.stop(testInfo, `${label}-image-events-incomplete`);
      if (reading) await reading.stop(testInfo, `${label}-reading-incomplete`);
      await fixture.cleanup();
      await fixture.rowHandle.dispose();
      await rowHandle?.dispose();
    }
  });
}
