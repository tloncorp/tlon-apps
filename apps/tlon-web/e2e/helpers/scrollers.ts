import {
  expect,
  type ElementHandle,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';

export type ScrollOffset = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

/**
 * Resolve the scroll offset of the actually-scrollable descendant under a
 * `data-testid` anchor. Used to verify FlashList anchoring behavior on web.
 *
 * Fail-closed: throws if no scrollable descendant (overflowY auto/scroll AND
 * scrollHeight > clientHeight) is found, so a non-scrollable wrapper with
 * `overflow: hidden` and `scrollTop === 0` cannot cause a false pass.
 */
export async function resolveScrollOffset(
  page: Page,
  testId: string
): Promise<ScrollOffset> {
  const handle = await page.getByTestId(testId).elementHandle();
  if (!handle) {
    throw new Error(`Scroller testID not found: ${testId}`);
  }
  return handle.evaluate((root): ScrollOffset => {
    function isScrollable(el: Element): boolean {
      const cs = getComputedStyle(el);
      const overflowY = cs.overflowY;
      const html = el as HTMLElement;
      return (
        (overflowY === 'auto' || overflowY === 'scroll') &&
        html.scrollHeight > html.clientHeight
      );
    }
    const measure = (el: HTMLElement): ScrollOffset => ({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    });
    if (isScrollable(root)) {
      return measure(root as HTMLElement);
    }
    const stack: Element[] = [root];
    while (stack.length) {
      const node = stack.shift()!;
      for (const child of Array.from(node.children)) {
        if (isScrollable(child)) {
          return measure(child as HTMLElement);
        }
        stack.push(child);
      }
    }
    throw new Error(
      'No scrollable descendant found under scrollerTestID. Setup must produce a list that overflows the viewport.'
    );
  });
}

export type ScrollFrame = ScrollOffset & {
  time: number;
  viewportTop: number;
  viewportBottom: number;
  bottomGap: number;
  anchors: Record<string, { top: number; bottom: number; height: number }>;
};

export type ScrollTrace = {
  coalescedSamples?: number;
  frames: ScrollFrame[];
  errors: string[];
  marks: { label: string; time: number }[];
};

/** Find the actual list from a known post, never a nested media scroller. */
export async function resolvePostScroller(post: Locator) {
  const handle = await post.evaluateHandle((node) => {
    const row = node.closest('[data-postid]');
    if (!row) throw new Error('Expected a post with a stable data-postid');
    for (
      let parent = row.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)) {
        if (
          parent.clientHeight <= 0 ||
          parent.scrollHeight <= parent.clientHeight
        ) {
          throw new Error(
            'Post list must have a positive viewport and overflow'
          );
        }
        return parent;
      }
    }
    throw new Error('No scrollable ancestor for post');
  });
  const element = handle.asElement();
  if (!element) throw new Error('Post scroller is not an element');
  return element as ElementHandle<HTMLElement>;
}

/**
 * Samples coherent DOM geometry on every animation callback, including during
 * Playwright actions. This detects sampled jumps; RAF is not proof of presented
 * compositor frames. Invalid/missing evidence is retained and fails assertions.
 */
export async function startScrollTrace(
  scroller: ElementHandle<HTMLElement>,
  anchorPostIds: string[] = []
) {
  const state = await scroller.evaluateHandle((element, ids) => {
    const trace: ScrollTrace = { frames: [], errors: [], marks: [] };
    let active = true;
    let frameRequest = 0;
    function sample() {
      const time = performance.now();
      try {
        if (!element.isConnected) throw new Error('Scroller disconnected');
        if (document.visibilityState !== 'visible')
          throw new Error('Document hidden');
        const viewport = element.getBoundingClientRect();
        const viewportTop = viewport.top + element.clientTop;
        const viewportBottom = viewportTop + element.clientHeight;
        const anchors: ScrollFrame['anchors'] = {};
        for (const id of ids) {
          const rows = element.querySelectorAll(
            `[data-postid="${CSS.escape(id)}"]`
          );
          if (rows.length !== 1)
            throw new Error(`Expected one anchor ${id}, found ${rows.length}`);
          const rect = rows[0].getBoundingClientRect();
          if (rect.height <= 0 || rect.width <= 0)
            throw new Error(`Anchor ${id} has no geometry`);
          anchors[id] = {
            top: rect.top - viewportTop,
            bottom: rect.bottom - viewportTop,
            height: rect.height,
          };
        }
        const frame: ScrollFrame = {
          time,
          scrollTop: element.scrollTop,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          viewportTop,
          viewportBottom,
          bottomGap:
            element.scrollHeight - element.clientHeight - element.scrollTop,
          anchors,
        };
        if (
          frame.clientHeight <= 0 ||
          !Object.values(frame)
            .filter((value) => typeof value === 'number')
            .every(Number.isFinite)
        ) {
          throw new Error('Invalid scroll geometry');
        }
        const previous = trace.frames.at(-1);
        // Some browser callbacks share the clock's resolution. An exact
        // duplicate adds no temporal or geometric evidence; do not count it
        // as another frame. Changed geometry at the same instant is retained
        // and rejected by the strict monotonic validator.
        if (
          previous &&
          previous.time === time &&
          JSON.stringify(previous) === JSON.stringify(frame)
        ) {
          trace.coalescedSamples = (trace.coalescedSamples ?? 0) + 1;
          return;
        }
        if (trace.frames.length >= 10000)
          throw new Error('Trace capacity exceeded');
        trace.frames.push(frame);
      } catch (error) {
        trace.errors.push(`${time.toFixed(2)}: ${String(error)}`);
      }
    }
    function tick() {
      if (!active) return;
      sample();
      frameRequest = requestAnimationFrame(tick);
    }
    sample();
    frameRequest = requestAnimationFrame(tick);
    return {
      trace,
      mark(label: string) {
        trace.marks.push({ label, time: performance.now() });
      },
      stop() {
        active = false;
        cancelAnimationFrame(frameRequest);
        sample();
        return trace;
      },
      async settle({
        quietMs,
        timeoutMs,
      }: {
        quietMs: number;
        timeoutMs: number;
      }) {
        return new Promise<void>((resolve, reject) => {
          const deadline = setTimeout(() => {
            cancelAnimationFrame(request);
            reject(new Error('Scroll did not settle before deadline'));
          }, timeoutMs);
          let request = 0;
          let stableSince = performance.now();
          let count = 0;
          let previous = trace.frames.at(-1);
          function check() {
            if (trace.errors.length) {
              clearTimeout(deadline);
              reject(new Error(trace.errors.join('\n')));
              return;
            }
            const current = trace.frames.at(-1);
            if (previous && current && current.time > previous.time) {
              const same =
                Math.abs(current.scrollTop - previous.scrollTop) <= 0.1 &&
                current.scrollHeight === previous.scrollHeight &&
                current.clientHeight === previous.clientHeight &&
                current.viewportTop === previous.viewportTop &&
                ids.every(
                  (id) =>
                    Math.abs(
                      current.anchors[id].top - previous!.anchors[id].top
                    ) <= 0.1 &&
                    current.anchors[id].height === previous!.anchors[id].height
                );
              if (!same) {
                stableSince = current.time;
                count = 0;
              } else count++;
              if (count >= 6 && current.time - stableSince >= quietMs) {
                clearTimeout(deadline);
                resolve();
                return;
              }
              previous = current;
            }
            request = requestAnimationFrame(check);
          }
          request = requestAnimationFrame(check);
        });
      },
    };
  }, anchorPostIds);

  return {
    mark: (label: string) =>
      state.evaluate((recording, value) => recording.mark(value), label),
    settle: (quietMs = 200, timeoutMs = 5000) =>
      state.evaluate((recording, options) => recording.settle(options), {
        quietMs,
        timeoutMs,
      }),
    async stop(testInfo?: TestInfo, name = 'scroll-geometry') {
      const trace = await state.evaluate((recording) => recording.stop());
      await state.dispose();
      if (testInfo)
        await testInfo.attach(name, {
          body: JSON.stringify(trace, null, 2),
          contentType: 'application/json',
        });
      return trace;
    },
  };
}

export function expectValidScrollTrace(trace: ScrollTrace) {
  expect(trace.errors, 'Missing or invalid geometry must fail closed').toEqual(
    []
  );
  expect(
    trace.frames.length,
    'Must observe multiple frames'
  ).toBeGreaterThanOrEqual(6);
  for (let index = 1; index < trace.frames.length; index++) {
    expect(
      trace.frames[index].time,
      'Frame timestamps must advance'
    ).toBeGreaterThan(trace.frames[index - 1].time);
    // This is an evidence-completeness bound, not a compositor FPS verdict.
    // A long blocked callback interval cannot silently prove continuity.
    expect(
      trace.frames[index].time - trace.frames[index - 1].time,
      'Insufficient geometry evidence: DOM capture gap exceeds 100ms'
    ).toBeLessThanOrEqual(100);
  }
}

export function expectAnchorStable(
  trace: ScrollTrace,
  postId: string,
  tolerance = 1
) {
  expectValidScrollTrace(trace);
  const baseline = trace.frames[0].anchors[postId];
  expect(baseline, 'Missing baseline anchor').toBeDefined();
  for (const frame of trace.frames) {
    expect(
      frame.anchors[postId],
      `Missing anchor at ${frame.time}`
    ).toBeDefined();
    expect(
      frame.anchors[postId].bottom,
      'Reading anchor left the viewport'
    ).toBeGreaterThan(0);
    expect(
      frame.anchors[postId].top,
      'Reading anchor left the viewport'
    ).toBeLessThan(frame.clientHeight);
    expect(
      Math.abs(frame.anchors[postId].top - baseline.top),
      `Anchor drift at ${frame.time.toFixed(2)}ms`
    ).toBeLessThanOrEqual(tolerance);
  }
}

export function expectBottomPinned(trace: ScrollTrace, tolerance = 1) {
  expectValidScrollTrace(trace);
  for (const frame of trace.frames) {
    expect(
      Math.abs(frame.bottomGap),
      `Bottom gap at ${frame.time.toFixed(2)}ms`
    ).toBeLessThanOrEqual(tolerance);
  }
}

/** Programmatic movement must make progress without reversing direction. */
export function expectScrollDirection(
  trace: ScrollTrace,
  direction: 'up' | 'down',
  tolerance = 1
) {
  expectValidScrollTrace(trace);
  const sign = direction === 'down' ? 1 : -1;
  const start = trace.frames[0].scrollTop;
  expect(
    sign * (trace.frames.at(-1)!.scrollTop - start),
    'Requested scroll made no progress'
  ).toBeGreaterThan(tolerance);
  for (let index = 1; index < trace.frames.length; index++) {
    const delta =
      trace.frames[index].scrollTop - trace.frames[index - 1].scrollTop;
    expect(
      sign * delta,
      `Scroll reversed direction at ${trace.frames[index].time}`
    ).toBeGreaterThanOrEqual(-tolerance);
  }
}

/** Require the final one-second quiet tail to remain at the real bottom. */
export function expectBottomLanding(trace: ScrollTrace, tolerance = 1) {
  expectValidScrollTrace(trace);
  const end = trace.frames.at(-1)!;
  const tail = trace.frames.filter((frame) => frame.time >= end.time - 1000);
  expect(tail.length).toBeGreaterThanOrEqual(6);
  expect(end.time - trace.frames[0].time).toBeGreaterThanOrEqual(1000);
  expectBottomPinned({ ...trace, frames: tail }, tolerance);
}

/** Center a selected post, clamped only by the list's real legal range. */
export function expectTargetLanding(
  trace: ScrollTrace,
  postId: string,
  tolerance = 1
) {
  expectValidScrollTrace(trace);
  const end = trace.frames.at(-1)!;
  const tail = trace.frames.filter((frame) => frame.time >= end.time - 1000);
  expect(end.time - trace.frames[0].time).toBeGreaterThanOrEqual(1000);
  expect(tail.length).toBeGreaterThanOrEqual(6);
  for (const frame of tail) {
    const target = frame.anchors[postId];
    expect(target, 'Missing landing target').toBeDefined();
    expect(
      target.bottom,
      'Landing target is above the viewport'
    ).toBeGreaterThan(0);
    expect(target.top, 'Landing target is below the viewport').toBeLessThan(
      frame.clientHeight
    );
    const contentTop = target.top + frame.scrollTop;
    const desiredOffset = Math.max(
      0,
      Math.min(
        frame.scrollHeight - frame.clientHeight,
        contentTop - (frame.clientHeight - target.height) / 2
      )
    );
    expect(
      Math.abs(frame.scrollTop - desiredOffset),
      `Target landing error at ${frame.time}`
    ).toBeLessThanOrEqual(tolerance);
  }
}

export async function settlePostScroller(scroller: ElementHandle<HTMLElement>) {
  const recording = await startScrollTrace(scroller);
  try {
    await recording.settle();
  } finally {
    expectValidScrollTrace(await recording.stop());
  }
}

/** Real wheel input, with a geometric precondition and bounded completion. */
export async function wheelToHistory(
  page: Page,
  scroller: ElementHandle<HTMLElement>
) {
  const box = await scroller.boundingBox();
  if (!box) throw new Error('Scroller has no bounding box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const distance = await scroller.evaluate((element) => element.scrollHeight);
  await page.mouse.wheel(0, -distance);
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop), {
      timeout: 5000,
    })
    .toBeLessThanOrEqual(1);
  await settlePostScroller(scroller);
}
