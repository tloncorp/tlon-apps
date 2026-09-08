import { test, expect } from '@playwright/test';
import {
  assessScrollInputTrace,
  bindScrollInputDeliveries,
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

// Calibration only: exercises the actual keyboard/selection collector, not app behavior.
test(
  'input collector: explicit keyboard select-all then Delete',
  calibration,
  async ({ page }, testInfo) => {
    await page.setContent(
      '<textarea id="composer"></textarea><button id="send">Send</button>'
    );
    const input = page.locator('#composer');
    await input.focus();
    const draft = 'First line\nSecond line';
    const recorder = await startScrollInputTrace(
      (await input.elementHandle())!,
      (await page.locator('#send').elementHandle())!,
      [
        { kind: 'input', payload: draft },
        { kind: 'select-all', payload: 'ControlOrMeta+A' },
        { kind: 'input', payload: '' },
      ]
    );
    let raw: Awaited<ReturnType<typeof recorder.stop>>;
    let end = 0;
    try {
      await recorder.beginInput(0);
      await input.fill(draft);
      await recorder.endInput(0);
      await page.waitForTimeout(350);
      await recorder.beginInput(1);
      await page.keyboard.press('ControlOrMeta+A');
      await recorder.endInput(1);
      await page.waitForTimeout(150);
      await recorder.beginInput(2);
      await page.keyboard.press('Delete');
      await recorder.endInput(2);
      end = await page.evaluate(() => performance.now() + 1300);
      await page.evaluate(async (end) => {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(0, end - performance.now()))
        );
      }, end);
    } finally {
      raw = await recorder.stop();
      await testInfo.attach('explicit-selection-raw', {
        body: JSON.stringify(raw),
        contentType: 'application/json',
      });
    }
    const expected = [
      { id: 'input-1', kind: 'input' as const, payload: draft },
      {
        id: 'select-all-1',
        kind: 'select-all' as const,
        payload: 'ControlOrMeta+A',
      },
      { id: 'input-2', kind: 'input' as const, payload: '' },
    ].map((action) => ({
      ...action,
      scopeKey: raw.originalScope,
      inputId: 'composer',
    }));
    const binding = bindScrollInputDeliveries({
      declaredAt: raw.declaredAt,
      expected,
      dispatches: raw.dispatches,
      events: raw.actions,
      keyboard: raw.keyboard,
    });
    expect(binding.issues).toEqual([]);
    const state = (value: string, selected = false): ScrollInputState => ({
      scopeKey: raw.originalScope,
      inputId: 'composer',
      draft: value,
      selection: { start: selected ? 0 : value.length, end: value.length },
      composing: false,
      focused: true,
      caretVisible: true,
      sendVisible: true,
      sendHitTestable: true,
    });
    const starts = [raw.samples[0].time, ...binding.actions.map((a) => a.time)];
    const contract = {
      version: 2 as const,
      declaredAt: raw.declaredAt,
      start: starts[0],
      end,
      deferredThrough: end - 1000,
      actions: expected,
      phases: ['before', 'grown', 'selected', 'cleared'].map((id, index) => ({
        id,
        start: starts[index],
        end: starts[index + 1] ?? end,
        triggerActionId: expected[index - 1]?.id,
        expected: state(index === 1 || index === 2 ? draft : '', index === 2),
      })),
    };
    const result = assessScrollInputTrace({
      contract,
      samples: raw.samples,
      actions: binding.actions,
    });
    await testInfo.attach('explicit-selection-proof', {
      body: JSON.stringify({ contract, binding, result }),
      contentType: 'application/json',
    });
    expect(result.semanticVerdict, JSON.stringify(result.issues)).toBe('PASS');
    expect(result.verdict).toBe('INCOMPLETE'); // Native textarea caret stays unmeasured.
  }
);

for (const value of ['', 'abc', '😀\n']) {
  test(
    `input paint: natural blink ${JSON.stringify(value)}`,
    calibration,
    async ({ page }, testInfo) => {
      const { assessInputPaint } =
        await import('../../../scripts/scroll-stability-input-paint.cjs');
      await page.setContent(
        '<textarea id="composer" spellcheck="false" style="width:180px;height:72px;padding:8px;border:2px solid black;font:18px/24px monospace;resize:none"></textarea><button id="send">Send</button>'
      );
      const input = page.locator('#composer');
      await input.fill(value);
      await input.focus();
      // Cross-check the nonempty pixel candidate against Chromium's actual UA
      // selection Range; empty/trailing-newline ranges are retained as unavailable.
      const cdp = await page.context().newCDPSession(page);
      const protocol: {
        method: string;
        params: unknown;
        result?: unknown;
        error?: string;
      }[] = [];
      const send = async (
        method: string,
        params: Record<string, unknown> = {}
      ) => {
        try {
          const result = await cdp.send(
            method as Parameters<typeof cdp.send>[0],
            params
          );
          protocol.push({ method, params, result });
          return result;
        } catch (error) {
          protocol.push({ method, params, error: String(error) });
          throw error;
        }
      };
      await send('Browser.getVersion');
      const document = await send('DOM.getDocument', {
        depth: -1,
        pierce: true,
      });
      type Node = {
        nodeName: string;
        attributes?: string[];
        backendNodeId: number;
        shadowRootType?: string;
        children?: Node[];
        shadowRoots?: Node[];
      };
      const all: Node[] = [];
      const visit = (node: Node) => {
        all.push(node);
        [...(node.children ?? []), ...(node.shadowRoots ?? [])].forEach(visit);
      };
      visit((document as { root: Node }).root);
      const textarea = all.find(
        (node) =>
          node.nodeName === 'TEXTAREA' && node.attributes?.includes('composer')
      )!;
      const inner = textarea.shadowRoots
        ?.find((node) => node.shadowRootType === 'user-agent')
        ?.children?.find((node) => node.nodeName === 'DIV');
      expect(inner).toBeDefined();
      const resolved = await send('DOM.resolveNode', {
        backendNodeId: inner!.backendNodeId,
      });
      const observed = await send('Runtime.callFunctionOn', {
        objectId: (resolved as { object: { objectId: string } }).object
          .objectId,
        returnByValue: true,
        functionDeclaration: `function(){const root=this.getRootNode(),input=root.host,s=root.getSelection();return {value:input.value,start:input.selectionStart,end:input.selectionEnd,focused:document.activeElement===input,rects:s.rangeCount?[...s.getRangeAt(0).getClientRects()].map(r=>({x:r.x,y:r.y,width:r.width,height:r.height})):[]};}`,
      });
      const ua = (
        observed as {
          result: {
            value: {
              value: string;
              start: number;
              end: number;
              focused: boolean;
              rects: { x: number; y: number; width: number; height: number }[];
            };
          };
        }
      ).result.value;
      expect(ua).toMatchObject({
        value,
        start: value.length,
        end: value.length,
        focused: true,
      });
      await cdp.detach();
      const readSurface = () =>
        page.evaluate(() => ({
          deviceScaleFactor: devicePixelRatio,
          viewport: {
            pageX: window.visualViewport?.pageLeft ?? scrollX,
            pageY: window.visualViewport?.pageTop ?? scrollY,
            offsetX: window.visualViewport?.offsetLeft ?? 0,
            offsetY: window.visualViewport?.offsetTop ?? 0,
            scale: window.visualViewport?.scale ?? 1,
            width: window.visualViewport?.width ?? innerWidth,
            height: window.visualViewport?.height ?? innerHeight,
          },
        }));
      const surfaceBefore = await readSurface();
      const recorder = await startScrollInputTrace(
        (await input.elementHandle())!,
        (await page.locator('#send').elementHandle())!,
        undefined,
        page
      );
      const end = await page.evaluate(() => performance.now() + 1800);
      await page.evaluate(async (end) => {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(0, end - performance.now()))
        );
      }, end);
      const raw = await recorder.stop();
      const surfaceAfterStop = await readSurface();
      const contract = {
        start: raw.samples[0].time,
        end,
        phases: [
          {
            id: 'unchanged',
            start: raw.samples[0].time,
            end,
            expected: {
              scopeKey: raw.originalScope,
              inputId: 'composer',
              draft: value,
              selection: { start: value.length, end: value.length },
            },
          },
        ],
      };
      const result = assessInputPaint(raw.paintedCaret, contract, raw);
      await testInfo.attach('input-paint-calibration', {
        body: JSON.stringify({
          contract,
          raw,
          result,
          ua,
          protocol,
          surfaceBefore,
          surfaceAfterStop,
        }),
        contentType: 'application/json',
      });
      expect(surfaceBefore.deviceScaleFactor).toBe(1);
      expect(surfaceBefore.viewport).toMatchObject({
        width: 1280,
        height: 800,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      });
      expect(raw.paintSurface).toEqual(surfaceBefore);
      expect(surfaceAfterStop).toEqual(surfaceBefore);
      expect(raw.paintedCaret?.version).toBe(4);
      for (const frame of raw.paintedCaret?.frames ?? []) {
        for (const snapshot of [frame.before, frame.after]) {
          if (snapshot)
            expect({
              viewport: snapshot.viewport,
              deviceScaleFactor: snapshot.deviceScaleFactor,
            }).toEqual(surfaceBefore);
        }
      }
      const captureErrors =
        raw.paintedCaret?.frames.filter((frame) => frame.error) ?? [];
      expect(captureErrors.length).toBeLessThanOrEqual(1);
      for (const frame of captureErrors) {
        expect(frame).toBe(raw.paintedCaret?.frames.at(-1));
        expect(frame.error).toMatch(
          /owner retired during (capture|observation)/i
        );
      }
      expect(result.verdict).toBe('INCOMPLETE');
      expect(
        result.candidates.length,
        JSON.stringify(result.issues)
      ).toBeGreaterThan(0);
      expect(result.issues.map((issue) => issue.code)).not.toContain(
        'input-caret-paint-capture-gap'
      );
      expect(
        raw.samples.every(
          (sample) =>
            sample.draft === value &&
            sample.focused &&
            sample.selection.start === value.length &&
            sample.selection.end === value.length
        )
      ).toBe(true);
      if (value === 'abc') {
        const candidate = result.candidates[0].rect;
        const range = ua.rects.find((rect) => rect.height > 0)!;
        expect(range).toBeDefined();
        expect(Math.abs(candidate.x - range.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(candidate.y - range.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(candidate.height - range.height)).toBeLessThanOrEqual(
          1
        );
      }
    }
  );
}
