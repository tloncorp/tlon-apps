import type { ElementHandle, TestInfo } from '@playwright/test';
import type {
  ContentPresentation,
  ContentRect,
  ScrollContentTrace,
} from '../../../../packages/app/fixtures/scrollContentTrace';

/** Records actual image availability and CSS exposure, never invented loading UI. */
export async function startScrollContentTrace(
  scroller: ElementHandle<HTMLElement>,
  row: ElementHandle<HTMLElement | SVGElement>,
  src: string,
  caption: string
) {
  const handle = await scroller.evaluateHandle(
    (list, options) => {
      const originalRow = options.row;
      const source = new URL(options.src, document.baseURI).href;
      const rowId = originalRow.getAttribute('data-postid');
      const matching = [...originalRow.querySelectorAll('img')].filter(
        (image) => image.src === source
      );
      if (matching.length !== 1 || !rowId)
        throw new Error('Expected one identified image row');
      const originalImage = matching[0];
      const imageFrame = originalImage.closest('[data-expoimage]');
      if (!imageFrame || !originalRow.contains(imageFrame))
        throw new Error('Missing production Expo image reservation');
      if (originalImage.complete || originalImage.naturalWidth !== 0)
        throw new Error('Image must still await its held response');
      const scope = window.location.pathname;
      const trace: ScrollContentTrace = {
        samples: [],
        events: [],
        marks: [],
        errors: [],
      };
      let active = true;
      let request = 0;
      let decodeDone = false;
      const rect = (
        bounds: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>
      ): ContentRect => ({
        left: bounds.left,
        top: bounds.top,
        right: Math.max(bounds.left, bounds.right),
        bottom: Math.max(bounds.top, bounds.bottom),
        width: Math.max(0, bounds.right - bounds.left),
        height: Math.max(0, bounds.bottom - bounds.top),
      });
      function presentation(
        element: Element,
        override?: DOMRect
      ): ContentPresentation {
        const bounds = rect(override ?? element.getBoundingClientRect());
        let left = Math.max(0, bounds.left);
        let top = Math.max(0, bounds.top);
        let right = Math.min(innerWidth, bounds.right);
        let bottom = Math.min(innerHeight, bounds.bottom);
        let opacity = 1;
        let displayed = true;
        for (
          let node: Element | null = element;
          node;
          node = node.parentElement
        ) {
          const style = getComputedStyle(node);
          opacity *= Number(style.opacity);
          displayed &&=
            style.display !== 'none' && style.visibility === 'visible';
          // CSS clipping is axis-specific. Include the scroller's committed
          // client viewport and every overflow ancestor, not only the window.
          const clipX =
            node === list ||
            ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX);
          const clipY =
            node === list ||
            ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY);
          if (clipX || clipY) {
            const box = node.getBoundingClientRect();
            if (clipX) {
              left = Math.max(left, box.left + node.clientLeft);
              right = Math.min(
                right,
                box.left + node.clientLeft + node.clientWidth
              );
            }
            if (clipY) {
              top = Math.max(top, box.top + node.clientTop);
              bottom = Math.min(
                bottom,
                box.top + node.clientTop + node.clientHeight
              );
            }
          }
        }
        return {
          connected: element.isConnected,
          displayed,
          opacity,
          rect: bounds,
          clip: rect({ left, right, top, bottom }),
        };
      }
      function captionState() {
        const walker = document.createTreeWalker(
          originalRow,
          NodeFilter.SHOW_TEXT
        );
        const matches: Text[] = [];
        let next: Node | null;
        while ((next = walker.nextNode()))
          if (next.textContent === options.caption) matches.push(next as Text);
        const text = matches[0];
        if (!text?.parentElement)
          return { count: matches.length, text: '', presentation: null };
        const range = document.createRange();
        range.selectNodeContents(text);
        return {
          count: matches.length,
          text: text.textContent ?? '',
          presentation: presentation(
            text.parentElement,
            range.getBoundingClientRect()
          ),
        };
      }
      function sample() {
        const time = performance.now();
        try {
          if (!list.isConnected || document.visibilityState !== 'visible')
            throw new Error('List detached or document hidden');
          const next = {
            time,
            scope: window.location.pathname,
            rowId: originalRow.getAttribute('data-postid'),
            sameRow:
              originalRow.isConnected &&
              document.querySelectorAll(`[data-postid="${CSS.escape(rowId!)}"]`)
                .length === 1 &&
              document.querySelector(
                `[data-postid="${CSS.escape(rowId!)}"]`
              ) === originalRow,
            list: presentation(list),
            row: presentation(originalRow),
            imageFrame: presentation(imageFrame!),
            caption: captionState(),
            images: [...originalRow.querySelectorAll('img')].map((image) => {
              const exposed = presentation(image);
              const { clip } = exposed;
              const top =
                clip.width > 0 && clip.height > 0
                  ? document.elementFromPoint(
                      clip.left + clip.width / 2,
                      clip.top + clip.height / 2
                    )
                  : null;
              return {
                src: image.src,
                currentSrc: image.currentSrc,
                complete: image.complete,
                naturalWidth: image.naturalWidth,
                naturalHeight: image.naturalHeight,
                sameElement: image === originalImage,
                presentation: exposed,
                frontmost: top !== null && imageFrame!.contains(top),
              };
            }),
            fallbackPresent: (originalRow.textContent ?? '').includes(
              'Unable to load image'
            ),
            measurement: { valid: true, durationMs: performance.now() - time },
          };
          const previous = trace.samples.at(-1);
          if (previous?.time === time) {
            const { measurement: _old, ...before } = previous;
            const { measurement: _new, ...after } = next;
            if (JSON.stringify(before) !== JSON.stringify(after))
              throw new Error(
                'Content changed at indistinguishable timestamps'
              );
          } else {
            if (trace.samples.length >= 10000)
              throw new Error('Content capture capacity exceeded');
            trace.samples.push(next);
          }
        } catch (error) {
          trace.errors.push(String(error));
          active = false;
        }
        if (active) request = requestAnimationFrame(sample);
      }
      function event(
        id: ScrollContentTrace['events'][number]['id'],
        evidence: { originalTarget: boolean; trusted: boolean }
      ) {
        trace.events.push({
          id,
          time: performance.now(),
          scope: window.location.pathname,
          src: originalImage.src,
          currentSrc: originalImage.currentSrc,
          originalTarget:
            evidence.originalTarget &&
            originalRow.isConnected &&
            originalImage.isConnected &&
            originalRow.contains(originalImage) &&
            document.querySelector(`[data-postid="${CSS.escape(rowId!)}"]`) ===
              originalRow &&
            originalImage.src === source &&
            originalImage.currentSrc === source,
          trusted: evidence.trusted,
        });
      }
      function loaded(observed: Event) {
        // Native event targets can be cleared after dispatch. Retain only the
        // actual synchronous event evidence across the decode promise; event()
        // independently rechecks current row/image identity at each timestamp.
        const evidence = Object.freeze({
          originalTarget: observed.target === originalImage,
          trusted: observed.isTrusted,
        });
        event('image-load', evidence);
        void originalImage
          .decode()
          .then(() => {
            event('image-decoded', evidence);
            decodeDone = true;
          })
          .catch((error) =>
            trace.errors.push(`Image decode failed: ${String(error)}`)
          );
      }
      const failed = (observed: Event) =>
        event('image-error', {
          originalTarget: observed.target === originalImage,
          trusted: observed.isTrusted,
        });
      originalImage.addEventListener('load', loaded);
      originalImage.addEventListener('error', failed);
      sample();
      return {
        trace,
        scope,
        src: source,
        rowId,
        mark(id: string) {
          const time = performance.now();
          trace.marks.push({ id, time });
          return time;
        },
        async wait(duration: number) {
          const until = performance.now() + duration;
          while (active && performance.now() < until)
            await new Promise(requestAnimationFrame);
        },
        decoded() {
          return decodeDone;
        },
        stop() {
          active = false;
          cancelAnimationFrame(request);
          sample();
          originalImage.removeEventListener('load', loaded);
          originalImage.removeEventListener('error', failed);
          return trace;
        },
      };
    },
    { row, src, caption }
  );
  return {
    scope: await handle.evaluate((capture) => capture.scope),
    src: await handle.evaluate((capture) => capture.src),
    mark: (id: string) =>
      handle.evaluate((capture, name) => capture.mark(name), id),
    wait: (ms: number) =>
      handle.evaluate((capture, duration) => capture.wait(duration), ms),
    decoded: () => handle.evaluate((capture) => capture.decoded()),
    async stop(testInfo?: TestInfo, name = 'scroll-content') {
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
