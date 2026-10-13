import type * as db from '@tloncorp/shared/db';
import React, { forwardRef, useImperativeHandle } from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';
import { ForwardChannelSelector } from './ForwardChannelSelector';

const harness = vi.hoisted(() => ({
  changeQuery: (_query: string) => {},
  scrollToOffset: vi.fn(),
}));

vi.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 400, height: 800 }),
}));
vi.mock('@tloncorp/ui', () => ({
  Text: 'Text',
  PlainSectionListHeader: Object.assign(
    ({ children }: { children: React.ReactNode }) => children,
    { Text: 'Label' }
  ),
}));
vi.mock('tamagui', () => ({
  isWeb: false,
  View: 'View',
  XStack: 'View',
  YStack: 'View',
  getTokenValue: () => 16,
}));
vi.mock('@shopify/flash-list', () => ({
  FlashList: forwardRef(function FlashList(
    {
      data,
      renderItem,
    }: {
      data: unknown[];
      renderItem: (info: { item: unknown }) => React.ReactNode;
    },
    ref
  ) {
    useImperativeHandle(ref, () => ({
      scrollToOffset: harness.scrollToOffset,
    }));
    return (
      <>
        {data.map((item, index) => (
          <React.Fragment key={index}>{renderItem({ item })}</React.Fragment>
        ))}
      </>
    );
  }),
}));
vi.mock('../../hooks/useFilteredChannelChats', () => ({
  useFilteredChannelChats: ({ searchQuery }: { searchQuery: string }) => ({
    isSearching: searchQuery.length > 0,
    channelChats: ['general', 'support']
      .filter((id) => id.includes(searchQuery))
      .map((id) => ({
        type: 'channel',
        pin: id === 'general' ? { itemId: id } : null,
        channel: { id, type: 'chat' },
      })),
  }),
}));
vi.mock('./SearchBar', () => ({
  SearchBar: ({ onChangeQuery }: { onChangeQuery: (q: string) => void }) => {
    harness.changeQuery = onChangeQuery;
    return null;
  },
}));
vi.mock('./ForwardChannelListItem', () => ({
  ForwardChannelListItem: 'Row',
}));

setupReactTestEnvironment();

describe('ForwardChannelSelector', () => {
  beforeEach(() => {
    harness.scrollToOffset.mockClear();
  });

  function renderSelector() {
    const onChannelSelected = vi.fn();
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <ForwardChannelSelector onChannelSelected={onChannelSelected} />
      );
    });
    return {
      onChannelSelected,
      rows: () => tree.root.findAllByType('Row' as never),
      labels: () =>
        tree.root
          .findAllByType('Label' as never)
          .map((label) => label.props.children),
    };
  }

  it('labels pinned and recent chats, then what a search matched', () => {
    const { rows, labels } = renderSelector();
    expect(labels()).toEqual(['Pinned', 'Recent']);
    expect(rows().map((row) => row.props.channel.id)).toEqual([
      'general',
      'support',
    ]);

    act(() => harness.changeQuery('sup'));

    expect(labels()).toEqual(['Chats matching ‘sup’']);
    expect(rows().map((row) => row.props.channel.id)).toEqual(['support']);
  });

  it('clears the selection and returns to the top when the search changes', () => {
    const { onChannelSelected, rows } = renderSelector();

    const general = rows()[0].props.channel as db.Channel;
    act(() => rows()[0].props.onPress(general));
    expect(onChannelSelected).toHaveBeenLastCalledWith(general);
    expect(rows()[0].props.selected).toBe(true);

    act(() => harness.changeQuery('sup'));

    // The sheet's Forward button follows this callback, so a search has to
    // clear it or the button keeps naming a chat that is no longer listed.
    expect(onChannelSelected).toHaveBeenLastCalledWith(null);
    expect(rows()[0].props.selected).toBe(false);
    expect(harness.scrollToOffset).toHaveBeenCalledWith({
      offset: 0,
      animated: false,
    });
  });
});
