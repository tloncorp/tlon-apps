import type { Page } from '@playwright/test';

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
