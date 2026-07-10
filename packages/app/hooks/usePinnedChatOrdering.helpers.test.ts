import { describe, expect, test } from 'vitest';

import {
  mergeVisibleOrderIntoFull,
  reorderVisible,
} from './usePinnedChatOrdering.helpers';

describe('reorderVisible', () => {
  test('moves active before/after over (arrayMove)', () => {
    // move A to C's slot -> B, C, A
    expect(reorderVisible(['A', 'B', 'C'], 'A', 'C')).toEqual(['B', 'C', 'A']);
    // move C to A's slot -> C, A, B
    expect(reorderVisible(['A', 'B', 'C'], 'C', 'A')).toEqual(['C', 'A', 'B']);
  });

  test('no-op when same slot or id absent', () => {
    expect(reorderVisible(['A', 'B', 'C'], 'A', 'A')).toEqual(['A', 'B', 'C']);
    expect(reorderVisible(['A', 'B', 'C'], 'A', 'Z')).toEqual(['A', 'B', 'C']);
  });
});

describe('mergeVisibleOrderIntoFull', () => {
  test('reorders only visible ids, leaving hidden ids in their slots', () => {
    // Full pinned order [G, A, B] where G (a group) is hidden in a DM-filtered
    // tab; the visible subset [A, B] is reordered to [B, A].
    const result = mergeVisibleOrderIntoFull(
      ['G', 'A', 'B'],
      ['A', 'B'],
      ['B', 'A']
    );
    // G keeps slot 0; the A/B slots take the new visible order.
    expect(result).toEqual(['G', 'B', 'A']);
  });

  test('hidden pin in the middle stays fixed', () => {
    const result = mergeVisibleOrderIntoFull(
      ['A', 'G', 'B'],
      ['A', 'B'],
      ['B', 'A']
    );
    expect(result).toEqual(['B', 'G', 'A']);
  });

  test('full-set reorder (nothing hidden) is just the new order', () => {
    const result = mergeVisibleOrderIntoFull(
      ['A', 'B', 'C'],
      ['A', 'B', 'C'],
      ['C', 'B', 'A']
    );
    expect(result).toEqual(['C', 'B', 'A']);
  });

  test('output is full and unique (no hidden pin dropped or duplicated)', () => {
    const full = ['G1', 'A', 'G2', 'B', 'C'];
    const visible = ['A', 'B', 'C'];
    const result = mergeVisibleOrderIntoFull(full, visible, ['C', 'A', 'B']);
    expect(result).toEqual(['G1', 'C', 'G2', 'A', 'B']);
    expect(new Set(result).size).toBe(full.length);
    expect([...result].sort()).toEqual([...full].sort());
  });

  test('operates on pin.itemId, not chat.id (round-12 #3)', () => {
    // A pinned group channel where chat.id !== pin.itemId. The helper only ever
    // sees the pin.itemId strings, so the merge is correct regardless of chat.id.
    const pinItemIds = ['chat/~zod/group', '~bus', '0vabc'];
    const result = mergeVisibleOrderIntoFull(
      pinItemIds,
      ['~bus', '0vabc'],
      ['0vabc', '~bus']
    );
    expect(result).toEqual(['chat/~zod/group', '0vabc', '~bus']);
  });
});
