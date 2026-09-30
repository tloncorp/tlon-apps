import React, { createContext, forwardRef } from 'react';
import { act, create } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { ActionSheet } from './ActionSheet';

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
  BottomSheet: () => null,
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
