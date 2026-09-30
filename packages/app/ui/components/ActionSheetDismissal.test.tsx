import React, { createContext, forwardRef } from 'react';
import { act, create } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { ActionSheet } from './ActionSheet';
import { BottomSheetWrapper } from './BottomSheetWrapper.native';

vi.mock('@tloncorp/ui', () => ({
  ActionSheetContext: createContext({ isInsideSheet: false }),
  Icon: () => null,
  Pressable: 'Button',
  Sheet: {},
  View: 'View',
  useCopy: () => ({}),
  useIsWindowNarrow: () => true,
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Keyboard: { dismiss: vi.fn() },
  useWindowDimensions: () => ({ height: 852 }),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34 }),
}));
vi.mock('tamagui', () => {
  const Container = Object.assign(
    ({ children }: { children?: React.ReactNode }) => children,
    {
      styleable: (render: Parameters<typeof forwardRef>[0]) =>
        forwardRef(render),
    }
  );
  return {
    View: Container,
    XStack: Container,
    YStack: Container,
    ScrollView: Container,
    styled: () => Container,
    withStaticProperties: Object.assign,
    createStyledContext: createContext,
    getTokenValue: () => 16,
    useTheme: () => ({ background: { val: '#fff' } }),
  };
});
vi.mock('./ListItem', () => ({
  ListItem: Object.assign(() => null, {
    Title: () => null,
    Subtitle: () => null,
  }),
}));
vi.mock('./ExpoSwiftUISheet', () => ({ ExpoSwiftUISheet: () => null }));
vi.mock('./BottomSheetWrapper', async () =>
  vi.importActual('./BottomSheetWrapper.native')
);
vi.mock('@expo/ui/community/bottom-sheet', () => ({
  BottomSheet: ({ children }: { children?: React.ReactNode }) => children,
  BottomSheetScrollView: () => null,
  BottomSheetTextInput: () => null,
}));

beforeAll(() => {
  vi.stubGlobal('React', React);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterAll(() => {
  vi.unstubAllGlobals();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

describe('ordinary ActionSheet dismissal forwarding', () => {
  it('forwards native completion through ActionSheet and BottomSheetWrapper', () => {
    const dismissed = vi.fn();
    let tree: ReturnType<typeof create>;
    const element = (open: boolean) => (
      <ActionSheet
        open={open}
        onOpenChange={vi.fn()}
        onNativeDismissed={dismissed}
      >
        {null}
      </ActionSheet>
    );
    act(() => {
      tree = create(element(true));
    });
    act(() => tree.update(element(false)));
    expect(dismissed).not.toHaveBeenCalled();
    const native = tree!.root.find((node) => node.props.index === -1);
    act(() => native.props.onDismiss());
    expect(dismissed).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });
});

describe('native unmount-on-close lifetime', () => {
  it('retains content beyond the old timer and unmounts only on completion', () => {
    vi.useFakeTimers();
    const dismissed = vi.fn();
    let tree: ReturnType<typeof create>;
    const element = (open: boolean) => (
      <BottomSheetWrapper
        open={open}
        onOpenChange={vi.fn()}
        onDismiss={dismissed}
        unmountOnClose
      >
        <span>Retained content</span>
      </BottomSheetWrapper>
    );
    act(() => {
      tree = create(element(true));
    });
    act(() => tree.update(element(false)));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(tree!.root.findByType('span').children).toEqual([
      'Retained content',
    ]);
    expect(dismissed).not.toHaveBeenCalled();
    const complete = tree!.root.find((node) => node.props.index === -1).props
      .onDismiss;
    act(() => complete());
    expect(tree!.toJSON()).toBe(null);
    expect(dismissed).toHaveBeenCalledTimes(1);
    act(() => complete());
    expect(dismissed).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    vi.useRealTimers();
  });

  it('ignores a stale dismissal after reopening', () => {
    const dismissed = vi.fn();
    let tree: ReturnType<typeof create>;
    const element = (open: boolean) => (
      <BottomSheetWrapper
        open={open}
        onOpenChange={vi.fn()}
        onDismiss={dismissed}
        unmountOnClose
      >
        <span>New presentation</span>
      </BottomSheetWrapper>
    );
    act(() => {
      tree = create(element(true));
    });
    act(() => tree.update(element(false)));
    const stale = tree!.root.find((node) => node.props.index === -1).props
      .onDismiss;
    act(() => tree.update(element(true)));
    act(() => stale());
    act(() => tree.update(element(false)));
    act(() => stale());
    expect(tree!.root.findByType('span')).toBeDefined();
    expect(dismissed).not.toHaveBeenCalled();
    act(() =>
      tree!.root.find((node) => node.props.index === -1).props.onDismiss()
    );
    expect(tree!.toJSON()).toBe(null);
    expect(dismissed).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('does not mount an initially closed unmount-on-close sheet', () => {
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <BottomSheetWrapper open={false} onOpenChange={vi.fn()} unmountOnClose>
          {null}
        </BottomSheetWrapper>
      );
    });
    expect(tree!.toJSON()).toBe(null);
    expect(tree!.root.findAll((node) => node.props.index != null)).toHaveLength(
      0
    );
    act(() => tree.unmount());
  });
});
