import type * as cn from '@tloncorp/shared/logic';
import { describe, expect, it } from 'vitest';

import {
  formatBubbleTimestamp,
  pickVisibleReactions,
  segmentBubbleContent,
  segmentHugsContent,
} from './chatBubbleLayout';

const block = (type: cn.BlockType) => ({ type }) as cn.BlockData;

describe('formatBubbleTimestamp', () => {
  // Wednesday
  const now = new Date(2026, 8, 30, 14, 0).getTime();

  it('shows only the time for today', () => {
    expect(
      formatBubbleTimestamp(new Date(2026, 8, 30, 9, 5).getTime(), now)
    ).toBe('09:05');
  });

  it('shows the weekday within the last week', () => {
    expect(
      formatBubbleTimestamp(new Date(2026, 8, 29, 23, 59).getTime(), now)
    ).toBe('Tuesday • 23:59');
    expect(
      formatBubbleTimestamp(new Date(2026, 8, 24, 13, 49).getTime(), now)
    ).toBe('Thursday • 13:49');
  });

  it('shows the Urbit-style date once the weekday would repeat', () => {
    expect(
      formatBubbleTimestamp(new Date(2026, 8, 23, 8, 0).getTime(), now)
    ).toBe('~2026.9.23 • 08:00');
    expect(
      formatBubbleTimestamp(new Date(2023, 0, 25, 8, 0).getTime(), now)
    ).toBe('~2023.1.25 • 08:00');
  });
});

describe('segmentBubbleContent', () => {
  it('gives each image or video its own segment and groups the rest', () => {
    const segments = segmentBubbleContent([
      block('image'),
      block('image'),
      block('paragraph'),
      block('reference'),
      block('video'),
      block('paragraph'),
    ]);
    expect(segments.map((s) => [s.kind, s.blocks.length])).toEqual([
      ['media', 1],
      ['media', 1],
      ['body', 2],
      ['media', 1],
      ['body', 1],
    ]);
  });

  it('returns nothing for empty content', () => {
    expect(segmentBubbleContent([])).toEqual([]);
  });
});

describe('segmentHugsContent', () => {
  it('hugs text-only segments', () => {
    expect(
      segmentHugsContent({
        kind: 'body',
        blocks: [block('paragraph'), block('blockquote')],
      })
    ).toBe(true);
  });

  it('stretches segments with cards, lists, or media', () => {
    expect(
      segmentHugsContent({
        kind: 'body',
        blocks: [block('paragraph'), block('reference')],
      })
    ).toBe(false);
    expect(segmentHugsContent({ kind: 'body', blocks: [block('list')] })).toBe(
      false
    );
    expect(
      segmentHugsContent({ kind: 'media', blocks: [block('image')] })
    ).toBe(false);
  });
});

describe('pickVisibleReactions', () => {
  const reactions = [
    { value: '👍', count: 1 },
    { value: '👀', count: 3 },
    { value: '🔥', count: 2 },
    { value: '🎉', count: 1 },
  ];

  it('shows the most used and counts the rest', () => {
    const { visible, hiddenCount } = pickVisibleReactions(reactions, '', 2);
    expect(visible.map((r) => r.value)).toEqual(['👀', '🔥']);
    expect(hiddenCount).toBe(2);
  });

  it('never hides your own reaction', () => {
    const { visible, hiddenCount } = pickVisibleReactions(reactions, '🎉', 2);
    expect(visible.map((r) => r.value)).toEqual(['👀', '🎉']);
    expect(hiddenCount).toBe(2);
  });

  it('keeps your reaction where it already ranks', () => {
    const { visible } = pickVisibleReactions(reactions, '👀', 2);
    expect(visible.map((r) => r.value)).toEqual(['👀', '🔥']);
  });

  it('shows everything when there is room', () => {
    const { visible, hiddenCount } = pickVisibleReactions(
      reactions.slice(0, 2),
      '',
      2
    );
    expect(visible).toHaveLength(2);
    expect(hiddenCount).toBe(0);
  });
});
