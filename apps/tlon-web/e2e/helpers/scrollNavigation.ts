import type { Locator, Page } from '@playwright/test';
import type {
  NavigationList,
  NavigationRow,
  NavigationSample,
  ScrollNavigationPlan,
  ScrollNavigationTrace,
} from '../../../../packages/app/fixtures/scrollNavigationTrace';

/** Read the exact original row and its first text character before navigation. */
export async function readNavigationAnchor(row: Locator, text: string) {
  return row.evaluate((element, expected) => {
    let list = element.parentElement;
    while (
      list &&
      !['auto', 'scroll'].includes(getComputedStyle(list).overflowY)
    )
      list = list.parentElement;
    if (
      !list ||
      list.clientHeight <= 0 ||
      list.scrollHeight <= list.clientHeight
    )
      throw new Error('Missing overflowing list');
    const blocks = [
      ...element.querySelectorAll(
        '.is_ContentFrame > .is_ContentBlock > span.is_TlonText'
      ),
    ].filter((node) => node.textContent === expected);
    if (blocks.length !== 1)
      throw new Error(
        `Expected one original message text block; found ${blocks.length}`
      );
    const walker = document.createTreeWalker(blocks[0], NodeFilter.SHOW_TEXT);
    let first = walker.nextNode();
    while (first && !first.textContent?.length) first = walker.nextNode();
    if (!first) throw new Error('Original character unavailable');
    const range = document.createRange();
    range.setStart(first, 0);
    range.setEnd(first, 1);
    const character = range.getBoundingClientRect();
    const viewport = list.getBoundingClientRect();
    const top = viewport.top + list.clientTop;
    if (character.top < top || character.bottom > top + list.clientHeight)
      throw new Error('Original reading character is clipped');
    return {
      rowId: element.getAttribute('data-postid')!,
      top: element.getBoundingClientRect().top - top,
      pointTop: character.top - top,
      viewport: {
        left: viewport.left,
        top,
        right: viewport.right,
        bottom: top + list.clientHeight,
      },
      bottomGap: list.scrollHeight - list.clientHeight - list.scrollTop,
    };
  }, text);
}

/** One page-owned capture survives all SPA list replacements without DOM writes. */
export async function startScrollNavigationTrace(
  page: Page,
  plan: ScrollNavigationPlan,
  region: { left: number; top: number; right: number; bottom: number }
) {
  const handle = await page.evaluateHandle(
    ({ plan: declaration, region: conversation }) => {
      const trace: ScrollNavigationTrace = {
        start: performance.now(),
        end: 0,
        samples: [],
        commands: [],
        events: [],
        errors: [],
      };
      const identities = new WeakMap<Element, number>();
      let identity = 0;
      let active = true;
      let request = 0;
      const id = (element: Element) => {
        if (!identities.has(element)) identities.set(element, ++identity);
        return identities.get(element)!;
      };
      function exposure(
        element: Element,
        bounds = element.getBoundingClientRect()
      ) {
        let left = Math.max(0, bounds.left),
          right = Math.min(innerWidth, bounds.right);
        let top = Math.max(0, bounds.top),
          bottom = Math.min(innerHeight, bounds.bottom);
        let opacity = 1,
          displayed = true;
        for (
          let ancestor: Element | null = element;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const style = getComputedStyle(ancestor);
          opacity *= Number(style.opacity);
          displayed &&=
            style.display !== 'none' &&
            style.visibility === 'visible' &&
            style.contentVisibility !== 'hidden';
          const rect = ancestor.getBoundingClientRect();
          if (/^(auto|scroll|hidden|clip)$/.test(style.overflowX)) {
            left = Math.max(left, rect.left + ancestor.clientLeft);
            right = Math.min(
              right,
              rect.left + ancestor.clientLeft + ancestor.clientWidth
            );
          }
          if (/^(auto|scroll|hidden|clip)$/.test(style.overflowY)) {
            top = Math.max(top, rect.top + ancestor.clientTop);
            bottom = Math.min(
              bottom,
              rect.top + ancestor.clientTop + ancestor.clientHeight
            );
          }
        }
        const area =
          displayed && opacity >= 0.01 && right > left && bottom > top;
        const hit =
          area &&
          [0.2, 0.5, 0.8].some((y) =>
            [0.2, 0.5, 0.8].some((x) => {
              const owner = document.elementFromPoint(
                left + (right - left) * x,
                top + (bottom - top) * y
              );
              return (
                owner !== null &&
                (owner === element ||
                  element.contains(owner) ||
                  owner.contains(element))
              );
            })
          );
        return {
          exposed: Boolean(area && hit),
          opacity,
          left,
          right,
          top,
          bottom,
        };
      }
      function kind(list: Element): NavigationList['kind'] {
        for (let node = list.parentElement; node; node = node.parentElement) {
          const inputs = [
            ...node.querySelectorAll('[data-testid="MessageInput"]'),
          ];
          if (inputs.length) {
            const kinds = new Set(
              inputs.map((input) =>
                input.closest('#reply-container') ? 'thread' : 'channel'
              )
            );
            return kinds.size === 1
              ? ([...kinds][0] as 'thread' | 'channel')
              : 'unknown';
          }
        }
        return 'unknown';
      }
      function sample() {
        if (!active) return;
        const time = performance.now();
        try {
          const grouped = new Map<HTMLElement, Element[]>();
          for (const row of document.querySelectorAll('[data-postid]')) {
            let list = row.parentElement;
            while (
              list &&
              !['auto', 'scroll'].includes(getComputedStyle(list).overflowY)
            )
              list = list.parentElement;
            if (!list) continue;
            const group = grouped.get(list) ?? [];
            group.push(row);
            grouped.set(list, group);
          }
          const lists: NavigationList[] = [];
          const attributedBodies = new Set<Element>();
          for (const [list, nodes] of grouped) {
            const viewport = list.getBoundingClientRect();
            const viewportTop = viewport.top + list.clientTop;
            const visibleList = exposure(list);
            // Exclude unrelated sidebar lists by physical conversation region,
            // never by whether their row IDs happen to satisfy the expected scope.
            const overlaps =
              viewport.right > conversation.left &&
              viewport.left < conversation.right &&
              viewport.bottom > conversation.top &&
              viewport.top < conversation.bottom;
            if (!overlaps) continue;
            const rows: NavigationRow[] = nodes.map((row) => {
              const rowId = row.getAttribute('data-postid') ?? '';
              const rect = row.getBoundingClientRect();
              const shown =
                visibleList.exposed &&
                rect.bottom > viewportTop &&
                rect.top < viewportTop + list.clientHeight &&
                exposure(row).exposed;
              const blocks = [
                ...row.querySelectorAll(
                  '.is_ContentFrame > .is_ContentBlock > span.is_TlonText'
                ),
              ];
              blocks.forEach((block) => attributedBodies.add(block));
              const declaredScope = Object.values(declaration.scopes).find(
                (scope) => scope.rows[rowId] !== undefined
              );
              const expectedBlocks = declaredScope?.textBlocks?.[rowId];
              const pointBlockIndex = expectedBlocks
                ? expectedBlocks.indexOf(declaredScope!.rows[rowId])
                : 0;
              // The declaration chooses a semantic block index, never which
              // actual texts to ignore. All actual blocks are retained below.
              const block = blocks[pointBlockIndex];
              const measuredBlocks = blocks.map((part) => ({
                text: part.textContent,
                exposed: Boolean(shown && exposure(part).exposed),
              }));
              let pointTop: number | null = null;
              if (block && shown) {
                const walker = document.createTreeWalker(
                  block,
                  NodeFilter.SHOW_TEXT
                );
                let first = walker.nextNode();
                while (first && !first.textContent?.length)
                  first = walker.nextNode();
                if (first) {
                  const range = document.createRange();
                  range.setStart(first, 0);
                  range.setEnd(first, 1);
                  pointTop = range.getBoundingClientRect().top - viewportTop;
                }
              }
              return {
                id: rowId,
                top: rect.top - viewportTop,
                bottom: rect.bottom - viewportTop,
                exposed: shown,
                body: {
                  text: block?.textContent ?? null,
                  count: blocks.length,
                  exposed: measuredBlocks[pointBlockIndex]?.exposed ?? false,
                  pointTop,
                  pointBlockIndex,
                  blocks: measuredBlocks,
                },
              };
            });
            lists.push({
              identity: id(list),
              kind: kind(list),
              exposed: visibleList.exposed,
              height: list.clientHeight,
              bottomGap: list.scrollHeight - list.clientHeight - list.scrollTop,
              rows,
            });
          }
          const loadingCount = [
            ...document.querySelectorAll('[role="progressbar"]'),
          ].filter((spinner) => {
            const box = exposure(spinner);
            return (
              box.exposed &&
              box.left >= conversation.left &&
              box.right <= conversation.right &&
              box.top >= conversation.top &&
              box.bottom <= conversation.bottom
            );
          }).length;
          const unattributedBodies = [
            ...document.querySelectorAll(
              '.is_ContentFrame > .is_ContentBlock > span.is_TlonText'
            ),
          ].filter((block) => {
            if (attributedBodies.has(block)) return false;
            const box = exposure(block);
            return (
              box.exposed &&
              box.right > conversation.left &&
              box.left < conversation.right &&
              box.bottom > conversation.top &&
              box.top < conversation.bottom
            );
          }).length;
          const value: NavigationSample = {
            time,
            durationMs: performance.now() - time,
            route: location.pathname,
            documentVisible: document.visibilityState === 'visible',
            lists,
            loadingCount,
            unattributedBodies,
          };
          if (trace.samples.length >= 10000)
            throw new Error('Navigation trace capacity exceeded');
          const previous = trace.samples.at(-1);
          if (
            previous?.time === time &&
            JSON.stringify({ ...previous, durationMs: 0 }) ===
              JSON.stringify({ ...value, durationMs: 0 })
          )
            return;
          trace.samples.push(value);
        } catch (error) {
          trace.errors.push(`${time}: ${String(error)}`);
        }
      }
      function tick() {
        sample();
        if (active) request = requestAnimationFrame(tick);
      }
      function delivery(event: Event) {
        const elements = event
          .composedPath()
          .filter((node): node is Element => node instanceof Element);
        const reference = elements.find((element) =>
          element.matches('.is_ReferenceFrame')
        );
        const referenceRow = reference?.closest('[data-postid]');
        trace.events.push({
          time: event.timeStamp,
          observedAt: performance.now(),
          kind: event.type as 'click' | 'popstate',
          trusted: event.isTrusted,
          texts: elements.map((element) => element.textContent?.trim() ?? ''),
          testIds: elements
            .map((element) => element.getAttribute('data-testid') ?? '')
            .filter(Boolean),
          ...(reference
            ? {
                reference: {
                  rowId: referenceRow?.getAttribute('data-postid') ?? null,
                  frameCount:
                    referenceRow?.querySelectorAll('.is_ReferenceFrame')
                      .length ?? 0,
                  texts: [
                    ...reference.querySelectorAll(
                      '.is_ContentFrame > .is_ContentBlock > span.is_TlonText'
                    ),
                  ].map((block) => block.textContent ?? ''),
                },
              }
            : {}),
        });
        sample();
      }
      document.addEventListener('click', delivery, true);
      window.addEventListener('popstate', delivery, true);
      const mutations = new MutationObserver(sample);
      mutations.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
      sample();
      request = requestAnimationFrame(tick);
      return {
        begin(commandId: string) {
          const next = declaration.commands[trace.commands.length];
          if (!active || next?.id !== commandId)
            throw new Error('Unplanned navigation command');
          trace.commands.push({
            id: commandId,
            start: performance.now(),
            end: null,
          });
          sample();
        },
        end(commandId: string) {
          const command = trace.commands.find(
            (entry) => entry.id === commandId
          );
          if (!command || command.end !== null)
            throw new Error('Missing or duplicate navigation completion');
          command.end = performance.now();
          sample();
        },
        stop() {
          sample();
          active = false;
          cancelAnimationFrame(request);
          mutations.disconnect();
          document.removeEventListener('click', delivery, true);
          window.removeEventListener('popstate', delivery, true);
          trace.end = performance.now();
          return trace;
        },
      };
    },
    { plan, region }
  );
  return {
    begin: (id: string) =>
      handle.evaluate((collector, name) => collector.begin(name), id),
    end: (id: string) =>
      handle.evaluate((collector, name) => collector.end(name), id),
    async stop() {
      try {
        return await handle.evaluate((collector) => collector.stop());
      } finally {
        await handle.dispose().catch((error) => {
          if (!page.isClosed()) throw error;
        });
      }
    },
  };
}
