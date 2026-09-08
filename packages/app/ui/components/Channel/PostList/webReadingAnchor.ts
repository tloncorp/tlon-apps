import type { WebReadingPoint } from './webScrollCoordinator';
import type { ScrollAnchor } from '../scrollerTypes';

const MAX_VISIBLE_ROWS = 24;
const MAX_TEXT_NODES = 160;

export function getWebPostTargetOffset(
  scroller: HTMLElement,
  postId: string,
  position = 0.5
) {
  const post = scroller.querySelector<HTMLElement>(
    `[data-postid="${CSS.escape(postId)}"]`
  );
  if (!post) return null;
  const bounds = post.getBoundingClientRect();
  return (
    scroller.scrollTop +
    bounds.top -
    scroller.getBoundingClientRect().top -
    scroller.clientTop -
    (scroller.clientHeight - bounds.height) * position
  );
}

export function getWebInitialAnchorOffset(
  scroller: HTMLElement,
  anchor: ScrollAnchor
) {
  return getWebPostTargetOffset(scroller, anchor.postId, 0.5);
}

export function isWebScrollSurfaceVisible(list: HTMLElement) {
  if (!list.isConnected || list.clientHeight <= 0 || list.clientWidth <= 0)
    return false;
  if (list.ownerDocument.visibilityState === 'hidden') return false;
  for (let node: Element | null = list; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.contentVisibility === 'hidden'
    )
      return false;
  }
  return true;
}

/** DOM order is visual order in this upright, single-column list. */
export function visibleWebPostRows(list: HTMLElement, content: HTMLElement) {
  const children = content.firstElementChild?.children;
  if (!children?.length) return [];
  const top = list.getBoundingClientRect().top + list.clientTop;
  const bottom = top + list.clientHeight;
  let low = 0;
  let high = children.length;
  // Read O(log n) row bounds, not every mounted row in a long conversation.
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (children[middle].getBoundingClientRect().bottom <= top)
      low = middle + 1;
    else high = middle;
  }
  const rows: HTMLElement[] = [];
  for (
    let index = low;
    index < children.length && rows.length < MAX_VISIBLE_ROWS;
    index++
  ) {
    const row = children[index] as HTMLElement;
    if (row.getBoundingClientRect().top >= bottom) break;
    if (row.dataset.postid) rows.push(row);
  }
  return rows;
}

function textNodes(root: Element) {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT
  );
  const nodes: Array<{ node: Text; start: number }> = [];
  let offset = 0;
  let node: Node | null;
  while ((node = walker.nextNode()) && nodes.length < MAX_TEXT_NODES) {
    nodes.push({ node: node as Text, start: offset });
    offset += node.textContent?.length ?? 0;
  }
  return nodes;
}

function characterRange(block: Element, offset: number) {
  for (const { node, start } of textNodes(block)) {
    if (offset >= start && offset < start + node.length) {
      const range = block.ownerDocument.createRange();
      range.setStart(node, offset - start);
      range.setEnd(node, offset - start + 1);
      return range;
    }
  }
  return null;
}

function exposed(element: Element, rect: DOMRect, list: HTMLElement) {
  const viewport = list.getBoundingClientRect();
  if (
    rect.height <= 0 ||
    rect.width <= 0 ||
    rect.bottom <= viewport.top + list.clientTop ||
    rect.top >= viewport.top + list.clientTop + list.clientHeight
  )
    return false;
  for (
    let node: Element | null = element;
    node && node !== list;
    node = node.parentElement
  ) {
    const style = getComputedStyle(node);
    if (
      style.display === 'none' ||
      style.visibility !== 'visible' ||
      Number(style.opacity) === 0
    )
      return false;
    if (/hidden|clip|auto|scroll/.test(style.overflowY)) {
      const bounds = node.getBoundingClientRect();
      if (rect.bottom <= bounds.top || rect.top >= bounds.bottom) return false;
    }
  }
  return true;
}

/**
 * Keep semantic identity distinct from a DOM handle: an unchanged paragraph may
 * be recreated by React. Ambiguous/edited text uses an already saved fallback.
 */
function textPoint(
  list: HTMLElement,
  row: HTMLElement,
  block: Element,
  offset: number
): WebReadingPoint {
  const text = block.textContent;
  const id = row.dataset.postid!;
  let currentBlock = block;
  let currentRow = row;
  const point: WebReadingPoint = {
    elements: [row, block],
    measure: () => {
      if (!currentRow.isConnected || !list.contains(currentRow)) {
        const candidate = list.querySelector<HTMLElement>(
          `[data-postid="${CSS.escape(id)}"]`
        );
        if (!candidate) return null;
        currentRow = candidate;
      }
      if (
        !currentBlock.isConnected ||
        !currentRow.contains(currentBlock) ||
        currentBlock.textContent !== text
      ) {
        const candidates = Array.from(
          currentRow.querySelectorAll('.is_ContentBlock')
        ).filter((candidate) => candidate.textContent === text);
        if (candidates.length !== 1) return null;
        currentBlock = candidates[0];
        point.elements = [currentRow, currentBlock];
      }
      const range = characterRange(currentBlock, offset);
      const rect = range?.getBoundingClientRect();
      if (!rect || rect.height <= 0 || !currentBlock.isConnected) return null;
      const style = getComputedStyle(currentBlock);
      if (style.display === 'none' || style.visibility !== 'visible')
        return null;
      return rect.top - list.getBoundingClientRect().top - list.clientTop;
    },
  };
  return point;
}

/** Capture only exposed content, ranked near the viewport's reading center. */
export function captureWebReadingPoints(
  list: HTMLElement,
  content: HTMLElement
): WebReadingPoint[] {
  const rows = visibleWebPostRows(list, content);
  const viewportTop = list.getBoundingClientRect().top + list.clientTop;
  const center = viewportTop + list.clientHeight / 2;
  const candidates: Array<{
    row: HTMLElement;
    point: WebReadingPoint;
    distance: number;
  }> = [];
  for (const row of rows) {
    const blocks = Array.from(row.querySelectorAll('.is_ContentBlock'));
    for (const block of blocks) {
      // Nested blocks are considered at their leaves, without duplicating text.
      if (block.querySelector('.is_ContentBlock')) continue;
      for (const { node, start } of textNodes(block)) {
        if (!node.data.trim()) continue;
        const range = block.ownerDocument.createRange();
        range.selectNodeContents(node);
        const boxes = Array.from(range.getClientRects()).filter((box) =>
          exposed(node.parentElement!, box, list)
        );
        if (!boxes.length) continue;
        const line = boxes.reduce((best, box) =>
          Math.abs(box.top - center) < Math.abs(best.top - center) ? box : best
        );
        // Find a character on that exposed line; a tall paragraph need not start
        // inside the viewport. This is logarithmic in the text node's length.
        let low = 0;
        let high = node.length - 1;
        while (low < high) {
          const middle = (low + high) >>> 1;
          range.setStart(node, middle);
          range.setEnd(node, middle + 1);
          if (range.getBoundingClientRect().top < line.top - 0.5)
            low = middle + 1;
          else high = middle;
        }
        const point = textPoint(list, row, block, start + low);
        const y = point.measure();
        if (y !== null)
          candidates.push({
            row,
            point,
            distance: Math.abs(viewportTop + y - center),
          });
      }
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  let primaryRow = candidates[0]?.row;
  // Center proximity selects the primary row, not deletion fallback order.
  // Keep its surviving interior points ahead of any neighboring message.
  const result = candidates
    .filter(({ row }) => row === primaryRow)
    .slice(0, 3)
    .map(({ point }) => point);
  // A media-only/tall row can still anchor an interior point. A normalized
  // media location survives a natural-size change; it is not a text claim.
  if (!result.length) {
    for (const row of rows) {
      const mediaRoot = row.querySelector('.is_ContentFrame') ?? row;
      for (const media of Array.from(
        mediaRoot.querySelectorAll('img,video,canvas')
      )) {
        const rect = media.getBoundingClientRect();
        if (!exposed(media, rect, list)) continue;
        const fraction = Math.max(
          0,
          Math.min(1, (center - rect.top) / rect.height)
        );
        const source = media.getAttribute('src');
        primaryRow = row;
        result.push({
          elements: [row, media],
          measure: () => {
            if (
              !media.isConnected ||
              !list.contains(media) ||
              media.getAttribute('src') !== source
            )
              return null;
            const box = media.getBoundingClientRect();
            return box.height > 0
              ? box.top +
                  box.height * fraction -
                  list.getBoundingClientRect().top -
                  list.clientTop
              : null;
          },
        });
        break;
      }
      if (result.length) break;
    }
  }
  primaryRow ??= rows[0];
  const primaryIndex = rows.indexOf(primaryRow);
  // Save each bounded visible witness before mutation. If the primary row is
  // removed, accepted policy prefers the next surviving row, then the previous
  // one. Original positions survive; later proximity never reorders this chain.
  const fallbacks = primaryRow
    ? [
        primaryRow,
        ...rows.slice(primaryIndex + 1),
        ...rows.slice(0, primaryIndex).reverse(),
      ]
    : [];
  for (const row of fallbacks) {
    const id = row.dataset.postid!;
    result.push({
      elements: [row],
      measure: () => {
        const current =
          row.isConnected && list.contains(row)
            ? row
            : list.querySelector<HTMLElement>(
                `[data-postid="${CSS.escape(id)}"]`
              );
        return current
          ? current.getBoundingClientRect().top -
              list.getBoundingClientRect().top -
              list.clientTop
          : null;
      },
    });
  }
  return result;
}
