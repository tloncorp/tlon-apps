import type { ElementHandle, TestInfo } from '@playwright/test';

import type { ScrollChromeTrace } from '../../../../packages/app/fixtures/scrollChromeTrace';

export type BrowserChromeTrace = ScrollChromeTrace & {
  errors: string[];
  marks: {
    id: string;
    time: number;
    pointerEvents?: string;
    sameControl?: boolean;
    scope?: string;
  }[];
};

/** Actual DOM state, including ancestor opacity; this is not painted-frame proof. */
export async function startScrollChromeTrace(
  scroller: ElementHandle<HTMLElement>,
  actionId: string
) {
  const handle = await scroller.evaluateHandle((list, actionId) => {
    const trace: BrowserChromeTrace = {
      samples: [],
      actions: [],
      errors: [],
      marks: [],
    };
    let active = true;
    let request = 0;
    const scope = window.location.pathname;
    const originalControl = document.querySelector(
      '[data-testid="ScrollToBottomButton"]'
    );
    function presentation(element: Element) {
      let opacity = 1;
      let shown = true;
      for (
        let node: Element | null = element;
        node;
        node = node.parentElement
      ) {
        const style = getComputedStyle(node);
        opacity *= Number(style.opacity);
        shown &&= style.display !== 'none' && style.visibility === 'visible';
      }
      const rect = element.getBoundingClientRect();
      shown &&=
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < innerHeight &&
        rect.right > 0 &&
        rect.left < innerWidth;
      return {
        opacity: shown ? opacity : 0,
        visible: shown && opacity > 0.001,
      };
    }
    function sample() {
      const time = performance.now();
      try {
        if (!list.isConnected || document.visibilityState !== 'visible')
          throw new Error(
            'List detached or document hidden during chrome capture'
          );
        const controls = [
          ...document.querySelectorAll('[data-testid="ScrollToBottomButton"]'),
        ].map((node) => {
          const spinners = [...node.querySelectorAll('[role="progressbar"]')];
          const icons = [...node.querySelectorAll('svg')].filter(
            (icon) => !icon.closest('[role="progressbar"]')
          );
          const glyphs = [...spinners, ...icons];
          const wrapper = presentation(node);
          const glyph = glyphs.length === 1 ? presentation(glyphs[0]) : null;
          return {
            id: 'latest',
            scope: window.location.pathname,
            kind:
              glyphs.length !== 1
                ? 'missing-or-duplicate-content'
                : spinners.length === 1
                  ? 'loading'
                  : 'icon',
            opacity: glyph ? Math.min(wrapper.opacity, glyph.opacity) : 0,
            visible: wrapper.visible && (glyph?.visible ?? false),
          };
        });
        const listPresentation = presentation(list);
        const next = {
          time,
          scope: window.location.pathname,
          loading: controls.some((control) => control.kind === 'loading'),
          semanticState: listPresentation.visible
            ? 'list-visible'
            : 'list-hidden',
          controls,
          measurement: { valid: true, durationMs: performance.now() - time },
        };
        const previous = trace.samples.at(-1);
        if (previous?.time === time) {
          const { time: _a, measurement: _b, ...before } = previous;
          const { time: _c, measurement: _d, ...after } = next;
          if (JSON.stringify(before) !== JSON.stringify(after))
            throw new Error(
              'Changed chrome state at an indistinguishable timestamp'
            );
        } else {
          if (trace.samples.length >= 10000)
            throw new Error('Chrome trace capacity exceeded');
          trace.samples.push(next);
        }
      } catch (error) {
        trace.errors.push(String(error));
        active = false;
      }
      if (active) request = requestAnimationFrame(sample);
    }
    function click(event: Event) {
      if (
        event.target instanceof Element &&
        event.target.closest('[data-testid="ScrollToBottomButton"]')
      )
        trace.actions.push({
          id: actionId,
          scope: window.location.pathname,
          time: performance.now(),
        });
    }
    document.addEventListener('click', click, true);
    sample();
    return {
      trace,
      scope,
      mark(id: string) {
        const time = performance.now();
        if (id === 'hide-eligibility') {
          const controls = document.querySelectorAll(
            '[data-testid="ScrollToBottomButton"]'
          );
          trace.marks.push({
            id,
            time,
            scope: window.location.pathname,
            sameControl:
              list.isConnected &&
              controls.length === 1 &&
              controls[0] === originalControl,
            pointerEvents:
              controls.length === 1
                ? getComputedStyle(controls[0]).pointerEvents
                : 'missing-or-duplicate',
          });
        } else {
          trace.marks.push({ id, time });
        }
        return time;
      },
      async wait(durationMs: number) {
        const until = performance.now() + durationMs;
        while (active && performance.now() < until)
          await new Promise(requestAnimationFrame);
      },
      stop() {
        active = false;
        cancelAnimationFrame(request);
        // A final sample is still checked for gaps; it cannot conceal a stalled
        // RAF or shorten the independently planned terminal observation window.
        sample();
        document.removeEventListener('click', click, true);
        return trace;
      },
    };
  }, actionId);
  return {
    scope: await handle.evaluate((capture) => capture.scope),
    mark: (id: string) =>
      handle.evaluate((capture, id) => capture.mark(id), id),
    wait: (durationMs: number) =>
      handle.evaluate(
        (capture, duration) => capture.wait(duration),
        durationMs
      ),
    async stop(testInfo?: TestInfo, name = 'scroll-chrome') {
      try {
        const trace = await handle.evaluate((capture) => capture.stop());
        if (testInfo)
          await testInfo.attach(name, {
            body: JSON.stringify(trace),
            contentType: 'application/json',
          });
        return trace;
      } finally {
        await handle.dispose();
      }
    },
  };
}
