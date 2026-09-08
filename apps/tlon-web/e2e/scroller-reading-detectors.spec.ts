import { expect, test } from '@playwright/test';

import {
  assessInjectedReadingFault,
  assessScrollReadingTrace,
  type ScrollReadingContract,
} from '../../../packages/app/fixtures/scrollReadingTrace';
import {
  resolveReadingBlock,
  startScrollReadingTrace,
} from './helpers/scrollReading';
import { expectAnchorStable, startScrollTrace } from './helpers/scrollers';

const text =
  'First line. The reader keeps this exact paragraph in place. Final line.';
const selector = '[data-reading-block]';
const start = text.indexOf('reader');
const faults = [
  'healthy',
  'empty-child',
  'stale-text',
  'child-hidden',
  'ancestor-hidden',
  'transparent-text',
  'covered-text',
  'inner-shift',
  'block-replaced',
  'inner-clipped',
] as const;

const calibration = {
  annotation: {
    type: 'evidence-kind',
    description: 'scroller-detector-calibration',
  },
};

test.describe('Reading/content collector calibration', calibration, () => {
  for (const fault of faults) {
    test(`fixed row with ${fault}`, async ({ page, browser }, testInfo) => {
      await page.setContent(`<!doctype html><style>
        body { margin: 20px; font-family: sans-serif; }
        main { height: 300px; width: 640px; overflow: auto; border: 2px solid black; }
        article { height: 220px; position: relative; background: white; }
        section { margin-left: 20px; padding-top: 20px; height: 120px; overflow: hidden; }
        [data-reading-block] { width: 520px; line-height: 24px; font-size: 18px; color: black; }
        #child { display: inline-block; }
      </style><main><div style="height:100px"></div><article data-postid="reading-row"><section>
      <div data-reading-block>First line. The <span id="child">reader keeps this exact paragraph in place.</span> Final line.</div>
      </section></article><div style="height:1000px"></div></main>`);
      const scroller = await page.$('main');
      const row = await page.$('article');
      if (!scroller || !row) throw new Error('Synthetic fixture missing');
      await scroller.evaluate((element) => {
        element.scrollTop = 60;
      });
      await expect(page.locator(selector)).toHaveText(text);
      const warmup = await page.evaluate(async () => {
        const startTime = performance.now();
        const frames: number[] = [];
        while (performance.now() - startTime < 2000) {
          await new Promise(requestAnimationFrame);
          frames.push(performance.now());
        }
        return {
          startTime,
          frames,
          visible: document.visibilityState,
          focused: document.hasFocus(),
        };
      });
      await testInfo.attach(`reading-${fault}-browser-preparation`, {
        body: JSON.stringify({
          browser: browser.browserType().name(),
          version: browser.version(),
          channel: 'chromium',
          headless: testInfo.project.use.headless !== false,
          warmup,
        }),
        contentType: 'application/json',
      });
      const geometry = await startScrollTrace(scroller, ['reading-row']);
      const capture = await startScrollReadingTrace(scroller, row, {
        blockSelector: selector,
        start,
        end: start + 1,
      });
      expect(
        capture.baseline.point,
        'Independent pre-mutation character must be exposed'
      ).not.toBeNull();
      await capture.wait(250);
      const restore = await page.evaluateHandle((kind) => {
        const child = document.querySelector<HTMLElement>('#child')!;
        const block = document.querySelector<HTMLElement>(
          '[data-reading-block]'
        )!;
        const section = document.querySelector<HTMLElement>('section')!;
        const originalText = child.textContent;
        const originalStyle = child.getAttribute('style');
        const sectionStyle = section.getAttribute('style');
        let clone: Element | undefined;
        let overlay: HTMLElement | undefined;
        if (kind === 'empty-child') child.textContent = '';
        if (kind === 'stale-text')
          child.textContent = originalText!.replace('reader', 'writer');
        if (kind === 'child-hidden') child.style.opacity = '0';
        if (kind === 'ancestor-hidden') section.style.opacity = '0';
        if (kind === 'transparent-text')
          child.style.webkitTextFillColor = 'transparent';
        if (kind === 'inner-shift') child.style.transform = 'translateY(12px)';
        if (kind === 'inner-clipped') section.style.height = '1px';
        if (kind === 'block-replaced') {
          clone = block.cloneNode(true) as Element;
          block.replaceWith(clone);
        }
        if (kind === 'covered-text') {
          const rect = child.getBoundingClientRect();
          overlay = document.createElement('aside');
          Object.assign(overlay.style, {
            position: 'fixed',
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            background: 'white',
            zIndex: '100',
          });
          document.body.append(overlay);
        }
        return {
          appliedAt: performance.now(),
          restore: () => {
            child.textContent = originalText;
            if (originalStyle === null) child.removeAttribute('style');
            else child.setAttribute('style', originalStyle);
            if (sectionStyle === null) section.removeAttribute('style');
            else section.setAttribute('style', sectionStyle);
            if (clone) clone.replaceWith(block);
            overlay?.remove();
            return performance.now();
          },
        };
      }, fault);
      const appliedAt = await restore.evaluate((state) => state.appliedAt);
      await capture.wait(75);
      const restoredAt = await restore.evaluate((state) => state.restore());
      await restore.dispose();
      const terminalTime = await capture.markTerminal();
      await capture.wait(1000);
      await capture.freeze();
      const geometryTrace = await geometry.stop(
        testInfo,
        `reading-${fault}-row-geometry`
      );
      const trace = await capture.stop(testInfo, `reading-${fault}-raw`);
      const contract: ScrollReadingContract = {
        scope: capture.scope,
        rowId: 'reading-row',
        blockSelector: selector,
        revision: { id: 'fixture-revision-2', text },
        point: {
          start,
          end: start + 1,
          x: capture.baseline.point!.relativeX,
          y: capture.baseline.point!.relativeY,
          tolerancePx: 1,
        },
        coverage: {
          startTime: capture.baseline.time,
          endTime: terminalTime + 1000,
          maxGapMs: 100,
          maxMeasurementDurationMs: 32,
        },
        terminalTime,
      };
      const result = assessScrollReadingTrace(trace, contract);
      await testInfo.attach(`reading-${fault}-proof`, {
        body: JSON.stringify({ trace, contract, result }),
        contentType: 'application/json',
      });
      if (fault === 'block-replaced') {
        expect(result.verdict).toBe('INCOMPLETE');
        expect(
          result.issues.some(
            (issue) => issue.code === 'content-acquisition-lost'
          )
        ).toBe(true);
      } else if (fault === 'healthy') {
        expectAnchorStable(geometryTrace, 'reading-row');
        expect(result.verdict, JSON.stringify(result.issues)).toBe('PASS');
      } else {
        const codes = {
          'empty-child': 'unexpected-text-revision',
          'stale-text': 'unexpected-text-revision',
          'child-hidden': 'hidden-text',
          'ancestor-hidden': 'hidden-content-container',
          'transparent-text': 'hidden-text',
          'covered-text': 'text-obstructed',
          'inner-shift': 'reading-point-moved',
          'block-replaced': 'content-identity-changed',
          'inner-clipped': 'reading-point-clipped',
        };
        const injected = { code: codes[fault], appliedAt, restoredAt };
        const detection = assessInjectedReadingFault(trace, contract, injected);
        await testInfo.attach(`reading-${fault}-detection`, {
          body: JSON.stringify({ injected, detection }),
          contentType: 'application/json',
        });
        expect(detection.detected, JSON.stringify(detection)).toBe(true);
        expect(trace.samples.at(-1)?.text).toBe(text);
      }
      if (fault === 'inner-shift')
        expect(
          result.issues.some((issue) => issue.code === 'reading-point-moved')
        ).toBe(true);
      if (fault === 'covered-text')
        expect(
          result.issues.some((issue) => issue.code === 'text-obstructed')
        ).toBe(true);
    });
  }
});

test.describe('Retained reading block calibration', calibration, () => {
  for (const change of ['hidden-sibling', 'same-looking-clone'] as const) {
    test(`retained block: ${change}`, async ({ page }, testInfo) => {
      const declared = 'Exact reading character stays in this paragraph.';
      await page.setContent(
        '<style>main {height:300px;overflow:auto;width:650px;font:18px monospace} article {height:220px} section {padding:20px}</style><main><article data-postid="retained"><section><span>' +
          declared +
          '</span></section></article><div style="height:1000px"></div></main>'
      );
      const row = page.locator('article');
      const acquired = await resolveReadingBlock(row, declared);
      const rowHandle = await row.elementHandle();
      const list = await page.$('main');
      if (!rowHandle || !list) throw new Error('Missing control fixture');
      await page.waitForTimeout(2000);
      const pointStart = declared.indexOf('reading');
      const capture = await startScrollReadingTrace(list, rowHandle, {
        blockSelector: acquired.selector,
        start: pointStart,
        end: pointStart + 1,
      });
      await capture.wait(250);
      const mutation = await row.evaluateHandle(
        (root, options) => {
          const original = root.querySelector(options.selector)!;
          const replacement =
            options.change === 'hidden-sibling'
              ? document.createElement('span')
              : (original.cloneNode(true) as Element);
          if (options.change === 'hidden-sibling') {
            (replacement as HTMLElement).style.display = 'none';
            original.before(replacement);
          } else original.replaceWith(replacement);
          return {
            appliedAt: performance.now(),
            restore() {
              if (options.change === 'hidden-sibling') replacement.remove();
              else replacement.replaceWith(original);
              return performance.now();
            },
          };
        },
        { selector: acquired.selector, change }
      );
      await capture.wait(75);
      const restoredAt = await mutation.evaluate((value) => value.restore());
      const appliedAt = await mutation.evaluate((value) => value.appliedAt);
      await mutation.dispose();
      const terminalTime = await capture.markTerminal();
      await capture.wait(1000);
      await capture.freeze();
      const trace = await capture.stop();
      const contract: ScrollReadingContract = {
        scope: capture.scope,
        rowId: 'retained',
        blockSelector: acquired.selector,
        revision: { id: 'unchanged', text: declared },
        point: {
          start: pointStart,
          end: pointStart + 1,
          x: capture.baseline.point!.relativeX,
          y: capture.baseline.point!.relativeY,
          tolerancePx: 1,
        },
        coverage: {
          startTime: capture.baseline.time,
          endTime: terminalTime + 1000,
          maxGapMs: 100,
          maxMeasurementDurationMs: 32,
        },
        terminalTime,
      };
      const result = assessScrollReadingTrace(trace, contract);
      await testInfo.attach(`retained-${change}-proof`, {
        contentType: 'application/json',
        body: JSON.stringify({
          trace,
          contract,
          appliedAt,
          restoredAt,
          result,
        }),
      });
      expect(result.verdict, JSON.stringify(result.issues)).toBe(
        change === 'hidden-sibling' ? 'PASS' : 'INCOMPLETE'
      );
      if (change === 'same-looking-clone') {
        expect(
          result.issues.some(
            (issue) => issue.code === 'content-acquisition-lost'
          )
        ).toBe(true);
        expect(result.issues.some((issue) => issue.kind === 'failure')).toBe(
          false
        );
      }
    });
  }
});
