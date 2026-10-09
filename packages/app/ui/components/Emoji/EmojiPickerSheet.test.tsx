import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../../test/sheetTestUtils';
import { SheetCoverContext } from '../../hooks/useSheetCoveredHeight';
import { EmojiPickerSheet } from './EmojiPickerSheet';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  useWindowDimensions: () => ({ width: 400, height: 800 }),
}));
vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ trackError: vi.fn() }),
}));
vi.mock('@tloncorp/ui', () => ({
  Pressable: 'Pressable',
  SizableEmoji: 'Emoji',
  View: 'View',
  getNativeEmoji: (id: string) => id,
  searchEmojis: () => [],
  usePreloadedEmojis: () => ['grinning', 'wave'],
}));
vi.mock('tamagui', () => ({ getTokenValue: () => 8 }));
vi.mock('@shopify/flash-list', () => ({ FlashList: 'FlashList' }));
vi.mock('../SearchBar', () => ({ SearchBar: () => null }));
// The sheet itself is mocked away, which leaves the cover context to the test.
vi.mock('../ActionSheet', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) =>
    children;
  return {
    ActionSheet: Object.assign(Passthrough, { Content: Passthrough }),
  };
});

setupReactTestEnvironment();

describe('EmojiPickerSheet on a native sheet', () => {
  it('pads its list by what the keyboard covers, and says it does', () => {
    const release = vi.fn();
    const claim = vi.fn(() => release);
    const render = (height: number) => (
      <SheetCoverContext.Provider value={{ height, claim }}>
        <EmojiPickerSheet open onOpenChange={vi.fn()} onEmojiSelect={vi.fn()} />
      </SheetCoverContext.Provider>
    );
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(render(0));
    });
    const list = () => tree.root.findByType('FlashList' as never);
    expect(list().props.contentContainerStyle).toEqual({ paddingBottom: 0 });
    expect(claim).toHaveBeenCalledTimes(1);

    act(() => tree.update(render(140)));
    expect(list().props.contentContainerStyle).toEqual({ paddingBottom: 140 });
    // The list keeps its own height: the padding is what makes room.
    expect(list().parent?.props.style).toEqual({ width: 384, height: 380 });

    act(() => tree.unmount());
    expect(release).toHaveBeenCalledTimes(1);
  });
});
