import { test, expect } from '@playwright/test';
import {
  assessScrollInputTrace,
  type ScrollInputState,
} from '../../../packages/app/fixtures/scrollInputTrace';
import { startScrollInputTrace } from './helpers/scrollInput';

const calibration = {
  annotation: {
    type: 'evidence-kind',
    description: 'scroller-detector-calibration',
  },
};

for (const fault of [
  'healthy',
  'stale-draft',
  'selection',
  'focus',
  'covered-send',
  'textarea-caret',
] as const) {
  test(`input collector: ${fault}`, calibration, async ({ page }, testInfo) => {
    const textarea = fault === 'textarea-caret';
    await page.setContent(`<style>
      #composer { font: 18px monospace; width: 500px; height: 90px; padding: 12px; border: 1px solid black; }
      #send { width: 80px; height: 40px; }
    </style>${textarea ? '<textarea id="composer">before</textarea>' : '<div id="composer" contenteditable="true">before</div>'}
    <button id="send">Send</button>`);
    const input = page.locator('#composer');
    await input.focus();
    await input.press('End');
    // Fixed setup warmup; retain the complete subsequent observation window.
    await page.waitForTimeout(2000);
    const inputHandle = await input.elementHandle();
    const sendHandle = await page.locator('#send').elementHandle();
    expect(inputHandle).not.toBeNull();
    expect(sendHandle).not.toBeNull();
    const capture = await startScrollInputTrace(inputHandle!, sendHandle!);
    // Duration and expectations are fixed before acting; no wait-for-success
    // chooses the observation window or discards a transient mismatch.
    const plannedEnd = await page.evaluate(() => performance.now() + 1600);
    await input.fill('after');
    if (fault !== 'healthy' && !textarea) {
      await page.evaluate(async (fault) => {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );
        const input = document.querySelector<HTMLElement>('#composer')!;
        let cover: HTMLElement | undefined;
        if (fault === 'stale-draft') input.textContent = 'stale';
        if (fault === 'selection') {
          const range = document.createRange();
          range.selectNodeContents(input);
          range.collapse(true);
          getSelection()!.removeAllRanges();
          getSelection()!.addRange(range);
        }
        if (fault === 'focus') input.blur();
        if (fault === 'covered-send') {
          const rect = document.querySelector('#send')!.getBoundingClientRect();
          cover = document.createElement('div');
          Object.assign(cover.style, {
            position: 'fixed',
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            background: 'red',
            zIndex: '999',
          });
          document.body.appendChild(cover);
        }
        await new Promise((resolve) => setTimeout(resolve, 60));
        cover?.remove();
        input.textContent = 'after';
        input.focus();
        const range = document.createRange();
        range.selectNodeContents(input);
        range.collapse(false);
        getSelection()!.removeAllRanges();
        getSelection()!.addRange(range);
      }, fault);
    }
    await page.evaluate(async (end) => {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, end - performance.now()))
      );
    }, plannedEnd);
    const raw = await capture.stop();
    const trigger = raw.actions.find((action) => action.kind === 'input');
    expect(trigger?.trusted).toBe(true);
    expect(trigger).toBeDefined();
    const expected = (draft: string): ScrollInputState => ({
      scopeKey: raw.originalScope,
      inputId: 'composer',
      draft,
      selection: { start: draft.length, end: draft.length },
      composing: false,
      focused: true,
      caretVisible: true,
      sendVisible: true,
      sendHitTestable: true,
    });
    const contract = {
      version: 1 as const,
      declaredAt: raw.declaredAt,
      start: raw.samples[0].time,
      end: plannedEnd,
      deferredThrough: plannedEnd - 1000,
      actions: [
        {
          id: 'input-1',
          kind: 'input' as const,
          scopeKey: raw.originalScope,
          inputId: 'composer',
          payload: 'after',
        },
      ],
      phases: [
        {
          id: 'before',
          start: raw.samples[0].time,
          end: trigger!.time,
          expected: expected('before'),
        },
        {
          id: 'after',
          start: trigger!.time,
          end: plannedEnd,
          triggerActionId: 'input-1',
          expected: expected('after'),
        },
      ],
    };
    const result = assessScrollInputTrace({
      contract,
      samples: raw.samples,
      actions: raw.actions,
    });
    await testInfo.attach('input-evidence', {
      body: JSON.stringify({ contract, raw, result }),
      contentType: 'application/json',
    });
    if (fault === 'healthy') expect(result.verdict).toBe('PASS');
    else if (textarea)
      expect(result).toMatchObject({
        verdict: 'INCOMPLETE',
        semanticVerdict: 'PASS',
      });
    else {
      expect(result.verdict).toBe('FAIL');
      const expectedCode = {
        'stale-draft': 'input-draft-changed',
        selection: 'input-selection-changed',
        focus: 'input-focused-changed',
        'covered-send': 'input-sendHitTestable-changed',
      }[fault];
      expect(result.issues.map((issue) => issue.code)).toContain(expectedCode);
    }
  });
}
