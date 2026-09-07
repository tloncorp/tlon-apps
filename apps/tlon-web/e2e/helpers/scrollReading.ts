import type { ElementHandle, Locator, TestInfo } from '@playwright/test';

import type {
  ContentPresentation,
  ContentRect,
} from '../../../../packages/app/fixtures/scrollContentTrace';
import type {
  ReadingFragment,
  ReadingHit,
  ReadingSample,
  ScrollReadingTrace,
} from '../../../../packages/app/fixtures/scrollReadingTrace';

/** Resolve a real production text block without adding selector attributes. */
export async function resolveReadingBlock(row: Locator, expectedText: string) {
  return row.evaluate((root, expected) => {
    const matches = Array.from(root.querySelectorAll<HTMLElement>('*')).filter(
      (element) =>
        element.textContent === expected &&
        !Array.from(element.children).some(
          (child) => child.textContent === expected
        )
    );
    if (matches.length !== 1)
      throw new Error(
        `Expected one production text block; found ${matches.length}`
      );
    const block = matches[0];
    const parts: string[] = [];
    for (let node: Element = block; node !== root; node = node.parentElement!) {
      const parent = node.parentElement;
      if (!parent) throw new Error('Text block left the post');
      parts.unshift(
        `${node.tagName.toLowerCase()}:nth-child(${Array.from(parent.children).indexOf(node) + 1})`
      );
    }
    return {
      selector: `:scope > ${parts.join(' > ')}`,
      text: block.textContent,
      descendants: [
        block,
        ...Array.from(block.querySelectorAll<HTMLElement>('*')),
      ].map((element) => {
        const style = getComputedStyle(element);
        return {
          text: element.textContent,
          tag: element.tagName,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          fontFamily: style.fontFamily,
        };
      }),
    };
  }, expectedText);
}

/**
 * One retained text block and UTF-16 character range, sampled in its real list.
 * Expected semantic text belongs in the caller's contract, never inferred here.
 * Reuses the image collector's presentation types; browser closures must remain
 * self-contained for Playwright serialization. No product DOM attributes added.
 */
export async function startScrollReadingTrace(
  scroller: ElementHandle<HTMLElement>,
  row: ElementHandle<HTMLElement | SVGElement>,
  options: {
    blockSelector: string;
    start: number;
    end: number;
    observedTexts?: string[];
    observedElements?: string[];
  }
) {
  const handle = await scroller.evaluateHandle(
    (element, { row: originalRow, options: settings }) => {
      if (
        !Number.isInteger(settings.start) ||
        !Number.isInteger(settings.end) ||
        settings.start < 0 ||
        settings.end <= settings.start
      )
        throw new Error('A positive UTF-16 reading range is required');
      const blocks = originalRow.querySelectorAll<HTMLElement>(
        settings.blockSelector
      );
      if (blocks.length !== 1 || !element.contains(originalRow))
        throw new Error('A unique block in the actual list is required');
      const originalBlock = blocks[0];
      const rowId = originalRow.getAttribute('data-postid');
      if (!rowId) throw new Error('A stable data-postid is required');
      const trace: ScrollReadingTrace = {
        samples: [],
        errors: [],
        marks: [],
        blockSelector: settings.blockSelector,
        blockAcquisition: 'retained-element',
        point: { start: settings.start, end: settings.end },
      };
      let active = true;
      let frozen = false;
      let request = 0;
      const rect = (value: {
        left: number;
        top: number;
        right: number;
        bottom: number;
      }): ContentRect => ({
        left: value.left,
        top: value.top,
        right: Math.max(value.left, value.right),
        bottom: Math.max(value.top, value.bottom),
        width: Math.max(0, value.right - value.left),
        height: Math.max(0, value.bottom - value.top),
      });
      const viewport = (value: HTMLElement) => {
        const box = value.getBoundingClientRect();
        return rect({
          left: box.left + value.clientLeft,
          top: box.top + value.clientTop,
          right: box.left + value.clientLeft + value.clientWidth,
          bottom: box.top + value.clientTop + value.clientHeight,
        });
      };
      const presentation = (
        owner: Element,
        bounds = rect(owner.getBoundingClientRect())
      ): ContentPresentation => {
        let clip = rect({
          left: Math.max(0, bounds.left),
          top: Math.max(0, bounds.top),
          right: Math.min(innerWidth, bounds.right),
          bottom: Math.min(innerHeight, bounds.bottom),
        });
        let opacity = 1;
        let displayed = true;
        for (
          let ancestor: Element | null = owner;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const style = getComputedStyle(ancestor);
          opacity *= Number(style.opacity);
          displayed &&=
            style.display !== 'none' &&
            style.visibility === 'visible' &&
            style.contentVisibility !== 'hidden';
          const isList = ancestor === element;
          const x =
            isList || /^(hidden|clip|auto|scroll)$/.test(style.overflowX);
          const y =
            isList || /^(hidden|clip|auto|scroll)$/.test(style.overflowY);
          if (x || y) {
            const box =
              ancestor instanceof HTMLElement
                ? viewport(ancestor)
                : rect(ancestor.getBoundingClientRect());
            clip = rect({
              left: x ? Math.max(clip.left, box.left) : clip.left,
              right: x ? Math.min(clip.right, box.right) : clip.right,
              top: y ? Math.max(clip.top, box.top) : clip.top,
              bottom: y ? Math.min(clip.bottom, box.bottom) : clip.bottom,
            });
          }
        }
        return {
          connected: owner.isConnected,
          displayed,
          opacity,
          rect: bounds,
          clip,
        };
      };
      const alpha = (color: string) => {
        if (color === 'transparent') return 0;
        if (/^rgb\([^/]+\)$/.test(color)) return 1;
        const rgba = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(color);
        if (rgba) return Number(rgba[1]);
        const slash = /\/\s*([\d.]+)(%)?\s*\)$/.exec(color);
        if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
        return NaN;
      };
      const fragment = (owner: Element, box: DOMRect): ReadingFragment => {
        const state = presentation(owner, rect(box));
        const style = getComputedStyle(owner);
        const textAlpha = alpha(style.webkitTextFillColor || style.color);
        const hits: ReadingHit[] = [];
        if (state.clip.width > 0 && state.clip.height > 0) {
          for (const fraction of [0.1, 0.5, 0.9]) {
            const x = state.clip.left + state.clip.width * fraction;
            const y = state.clip.top + state.clip.height / 2;
            hits.push({
              x,
              y,
              stack: document.elementsFromPoint(x, y).map((hit) => ({
                relation:
                  hit === owner || owner.contains(hit)
                    ? 'owner'
                    : hit.contains(owner)
                      ? 'ancestor'
                      : 'foreign',
                tag: hit.tagName,
              })),
            });
          }
        }
        return {
          presentation: state,
          textAlpha,
          pointerEvents: style.pointerEvents,
          hits,
        };
      };
      function sample() {
        const time = performance.now();
        try {
          if (document.visibilityState !== 'visible')
            throw new Error('Document is not visible');
          if (
            !element.isConnected ||
            element.clientWidth <= 0 ||
            element.clientHeight <= 0
          )
            throw new Error('Actual list is unavailable');
          const current = originalRow.querySelectorAll<HTMLElement>(
            settings.blockSelector
          );
          const retained =
            originalBlock.isConnected && originalRow.contains(originalBlock);
          const currentText = originalBlock.textContent ?? '';
          // Positional selectors acquire once. Unrelated sibling/wrapper changes
          // do not replace an already acquired native DOM element.
          const semanticMatches = currentText
            ? Array.from(originalRow.querySelectorAll<HTMLElement>('*')).filter(
                (candidate) =>
                  candidate.textContent === currentText &&
                  !Array.from(candidate.children).some(
                    (child) => child.textContent === currentText
                  )
              )
            : [];
          const block = retained
            ? originalBlock
            : (current[0] ?? semanticMatches[0] ?? originalBlock);
          const nodes: ReadingSample['nodes'] = [];
          const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
          const texts: { node: Text; start: number; end: number }[] = [];
          let offset = 0;
          while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            const start = offset;
            offset += node.data.length;
            texts.push({ node, start, end: offset });
            const range = document.createRange();
            range.selectNodeContents(node);
            nodes.push({
              text: node.data,
              start,
              end: offset,
              fragments: Array.from(range.getClientRects())
                .filter((box) => box.width > 0 && box.height > 0)
                .map((box) => fragment(node.parentElement!, box)),
            });
          }
          const list = presentation(element, viewport(element));
          let point: ReadingSample['point'] = null;
          const startNode = texts.find(
            (entry) =>
              settings.start >= entry.start && settings.start < entry.end
          );
          const endNode = texts.find(
            (entry) => settings.end > entry.start && settings.end <= entry.end
          );
          if (startNode && endNode) {
            const range = document.createRange();
            range.setStart(startNode.node, settings.start - startNode.start);
            range.setEnd(endNode.node, settings.end - endNode.start);
            const boxes = Array.from(range.getClientRects()).filter(
              (box) => box.width > 0 && box.height > 0
            );
            // A single character or grapheme on one line is the bounded witness.
            if (
              boxes.length === 1 &&
              startNode.node.parentElement === endNode.node.parentElement
            ) {
              const measured = fragment(
                startNode.node.parentElement!,
                boxes[0]
              );
              point = {
                start: settings.start,
                end: settings.end,
                text: range.toString(),
                relativeX: measured.presentation.rect.left - list.rect.left,
                relativeY: measured.presentation.rect.top - list.rect.top,
                fragment: measured,
              };
            }
          }
          const next: ReadingSample = {
            time,
            scope: location.pathname,
            rowId: originalRow.getAttribute('data-postid'),
            sameRow:
              originalRow.isConnected &&
              document.querySelectorAll(`[data-postid="${CSS.escape(rowId!)}"]`)
                .length === 1 &&
              document.querySelector(
                `[data-postid="${CSS.escape(rowId!)}"]`
              ) === originalRow &&
              element.contains(originalRow),
            sameBlock: retained,
            blockCount: retained
              ? currentText
                ? semanticMatches.length
                : 1
              : current.length,
            text: block.textContent ?? '',
            list,
            row: presentation(originalRow),
            block: presentation(block),
            nodes,
            point,
            ...(settings.observedTexts
              ? {
                  observations: settings.observedTexts.map((text) => {
                    const observed = document.createTreeWalker(
                      originalRow,
                      NodeFilter.SHOW_TEXT
                    );
                    const fragments: ReadingSample['nodes'][number]['fragments'] =
                      [];
                    let count = 0;
                    while (observed.nextNode()) {
                      const node = observed.currentNode as Text;
                      if (node.data !== text) continue;
                      count++;
                      const range = document.createRange();
                      range.selectNodeContents(node);
                      fragments.push(
                        ...Array.from(range.getClientRects())
                          .filter((box) => box.width > 0 && box.height > 0)
                          .map((box) => fragment(node.parentElement!, box))
                      );
                    }
                    return { text, count, fragments };
                  }),
                }
              : {}),
            ...(settings.observedElements
              ? {
                  elements: settings.observedElements.map((selector) => {
                    const matches = Array.from(
                      originalRow.querySelectorAll<HTMLElement>(selector)
                    );
                    return {
                      selector,
                      count: matches.length,
                      texts: matches.map(
                        (element) => element.textContent ?? ''
                      ),
                      fragments: matches.flatMap((element) => {
                        const range = document.createRange();
                        range.selectNodeContents(element);
                        return Array.from(range.getClientRects())
                          .filter((box) => box.width > 0 && box.height > 0)
                          .map((box) => fragment(element, box));
                      }),
                    };
                  }),
                }
              : {}),
            measurement: { valid: true, durationMs: performance.now() - time },
          };
          const previous = trace.samples.at(-1);
          if (previous?.time === time) {
            const { measurement: _old, ...before } = previous;
            const { measurement: _new, ...after } = next;
            if (JSON.stringify(before) !== JSON.stringify(after))
              throw new Error(
                'Reading content changed at indistinguishable timestamps'
              );
          } else {
            if (trace.samples.length >= 10000)
              throw new Error('Reading capture capacity exceeded');
            trace.samples.push(next);
          }
        } catch (error) {
          trace.errors.push(String(error));
          active = false;
        }
        if (active) request = requestAnimationFrame(sample);
      }
      sample();
      const freeze = () => {
        if (frozen) return;
        active = false;
        cancelAnimationFrame(request);
        sample();
        frozen = true;
      };
      return {
        trace,
        scope: location.pathname,
        baseline: trace.samples[0],
        markTerminal() {
          const time = performance.now();
          trace.marks.push({ id: 'terminal-ready', time });
          return time;
        },
        async wait(duration: number) {
          if (!Number.isFinite(duration) || duration < 0 || duration > 10000)
            throw new Error('Wait must be bounded to 10 seconds');
          const until = performance.now() + duration;
          while (active && performance.now() < until)
            await new Promise(requestAnimationFrame);
        },
        freeze,
        stop() {
          freeze();
          return trace;
        },
      };
    },
    { row, options }
  );
  return {
    scope: await handle.evaluate((capture) => capture.scope),
    baseline: await handle.evaluate((capture) => capture.baseline),
    markTerminal: () => handle.evaluate((capture) => capture.markTerminal()),
    wait: (ms: number) =>
      handle.evaluate((capture, duration) => capture.wait(duration), ms),
    // Freeze before transferring this larger raw trace when other samplers run.
    freeze: () => handle.evaluate((capture) => capture.freeze()),
    async stop(testInfo?: TestInfo, name = 'scroll-reading') {
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
