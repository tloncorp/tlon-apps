import type * as cn from '@tloncorp/shared/logic';
import { differenceInCalendarDays, format } from 'date-fns';

/**
 * Day of the week within the last week, otherwise the Urbit-style date. Today's
 * messages show only the time: the day divider above them already says so.
 */
export function formatBubbleTimestamp(sentAt: number, now = Date.now()) {
  const date = new Date(sentAt);
  const time = format(date, 'HH:mm');
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) {
    return time;
  }
  if (days < 7) {
    return `${format(date, 'EEEE')} • ${time}`;
  }
  return `~${format(date, 'yyyy.M.d')} • ${time}`;
}

export type BubbleSegment = {
  kind: 'media' | 'body';
  blocks: cn.BlockData[];
};

const MEDIA_BLOCK_TYPES = new Set<cn.BlockType>(['image', 'video']);
// Blocks that size to their text. Everything else (references, code, files,
// lists) lays out against a full-width column, so its bubble stretches.
const HUGGING_BLOCK_TYPES = new Set<cn.BlockType>([
  'paragraph',
  'blockquote',
  'header',
  'bigEmoji',
]);

/**
 * Splits a message into the separate bubbles it renders as: each image or
 * video is its own full-bleed bubble, and runs of everything else share one.
 */
export function segmentBubbleContent(content: cn.PostContent) {
  const segments: BubbleSegment[] = [];
  for (const block of content) {
    const kind = MEDIA_BLOCK_TYPES.has(block.type) ? 'media' : 'body';
    const previous = segments[segments.length - 1];
    if (kind === 'body' && previous?.kind === 'body') {
      previous.blocks.push(block);
    } else {
      segments.push({ kind, blocks: [block] });
    }
  }
  return segments;
}

export function segmentHugsContent(segment: BubbleSegment) {
  return (
    segment.kind === 'body' &&
    segment.blocks.every((block) => HUGGING_BLOCK_TYPES.has(block.type))
  );
}

/**
 * The reactions a bubble has room for: the most used first, and never hiding
 * your own, so tapping a visible pill is always how you take yours back.
 */
export function pickVisibleReactions<
  T extends { value: string; count: number },
>(reactions: T[], ownValue: string | null | undefined, limit: number) {
  const byCount = [...reactions].sort((a, b) => b.count - a.count);
  const visible = byCount.slice(0, limit);
  const own = ownValue
    ? byCount.find((reaction) => reaction.value === ownValue)
    : undefined;
  if (own && !visible.includes(own) && visible.length > 0) {
    visible[visible.length - 1] = own;
  }
  return { visible, hiddenCount: reactions.length - visible.length };
}
