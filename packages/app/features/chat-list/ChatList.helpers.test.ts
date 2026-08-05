import * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import type { SectionedChatData } from '../../hooks/useFilteredChats';
import {
  buildChatListFlashListProps,
  buildChatListItems,
  getChatKey,
  isSectionHeader,
  splitPinnedSection,
} from './ChatList.helpers';

function makeUnpinnedGroup(id: string): db.Chat {
  return {
    id,
    type: 'group',
    pin: null,
    volumeSettings: null,
    timestamp: 0,
    isPending: false,
    unreadCount: 0,
    group: { id, title: id } as unknown as db.Group,
  } as db.Chat;
}

function makePinnedGroup(id: string, index: number): db.Chat {
  return {
    id,
    type: 'group',
    pin: { type: 'group', index, itemId: id } as db.Pin,
    volumeSettings: null,
    timestamp: 0,
    isPending: false,
    unreadCount: 0,
    group: { id, title: id } as unknown as db.Group,
  } as db.Chat;
}

const unpinned: db.Chat[] = [
  makeUnpinnedGroup('group-a'),
  makeUnpinnedGroup('group-b'),
  makeUnpinnedGroup('group-c'),
];

const pinned: db.Chat[] = [
  makePinnedGroup('group-pin-1', 0),
  makePinnedGroup('group-pin-2', 1),
];

const initial: SectionedChatData = [{ title: 'All', data: unpinned }];
const afterPinHydrates: SectionedChatData = [
  { title: 'Pinned', data: pinned },
  { title: 'All', data: unpinned },
];

describe('buildChatListFlashListProps', () => {
  it('omits maintainVisibleContentPosition by default', () => {
    const props = buildChatListFlashListProps({ data: initial });
    expect(props).not.toHaveProperty('maintainVisibleContentPosition');
  });

  it('omits maintainVisibleContentPosition when explicitly false', () => {
    const props = buildChatListFlashListProps({
      data: initial,
      disableScrollAnchoring: false,
    });
    expect(props).not.toHaveProperty('maintainVisibleContentPosition');
  });

  it('disables maintainVisibleContentPosition when opted in', () => {
    const props = buildChatListFlashListProps({
      data: initial,
      disableScrollAnchoring: true,
    });
    expect(props.maintainVisibleContentPosition).toEqual({ disabled: true });
  });

  it('flattens [All] -> [Pinned, ...pinned, All, ...unpinned] in order', () => {
    const before = buildChatListFlashListProps({
      data: initial,
      disableScrollAnchoring: true,
    });
    const beforeKeys = before.data.map(getChatKey);
    expect(beforeKeys[0]).toBe('All');

    const after = buildChatListFlashListProps({
      data: afterPinHydrates,
      disableScrollAnchoring: true,
    });
    const keys = after.data.map(getChatKey);
    expect(keys[0]).toBe('Pinned');

    const allIndex = keys.indexOf('All');
    expect(allIndex).toBeGreaterThan(0);
    for (const chat of pinned) {
      const expectedKey = `${chat.id}-${chat.pin?.itemId ?? ''}`;
      const idx = keys.indexOf(expectedKey);
      expect(idx).toBeGreaterThan(0);
      expect(idx).toBeLessThan(allIndex);
    }

    for (const chat of unpinned) {
      const expectedKey = `${chat.id}-${chat.pin?.itemId ?? ''}`;
      expect(keys.indexOf(expectedKey)).toBeGreaterThan(allIndex);
    }
  });
});

describe('buildChatListItems', () => {
  it('inlines a sectionHeader entry before each section', () => {
    const items = buildChatListItems(afterPinHydrates);
    expect(items).toHaveLength(2 + pinned.length + unpinned.length);
    expect(isSectionHeader(items[0])).toBe(true);
    expect(items[0]).toEqual({ type: 'sectionHeader', title: 'Pinned' });
    const allHeaderIndex = items.findIndex(
      (item) => isSectionHeader(item) && item.title === 'All'
    );
    expect(allHeaderIndex).toBe(1 + pinned.length);
  });
});

describe('splitPinnedSection', () => {
  it('extracts the pinned chats and leaves the rest as the FlashList data', () => {
    const { pinned: extracted, rest } = splitPinnedSection(afterPinHydrates);

    // Pinned chats come out for the ListHeaderComponent block...
    expect(extracted).toEqual(pinned);
    // ...and the FlashList rest contains only non-pinned sections (no pinned rows).
    expect(rest).toEqual([{ title: 'All', data: unpinned }]);
    const restItems = buildChatListItems(rest);
    for (const chat of pinned) {
      expect(restItems).not.toContainEqual(chat);
    }
    // maintainVisibleContentPosition behavior is unchanged on the rest list.
    expect(
      buildChatListFlashListProps({ data: rest, disableScrollAnchoring: true })
        .maintainVisibleContentPosition
    ).toEqual({ disabled: true });
  });

  it('returns no pinned chats when there is no pinned section (e.g. search)', () => {
    const { pinned: extracted, rest } = splitPinnedSection(initial);
    expect(extracted).toEqual([]);
    expect(rest).toEqual(initial);
  });
});
