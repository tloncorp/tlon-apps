import React, { createContext, forwardRef } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

import { ActionSheet } from './ActionSheet';
import { BottomSheetWrapper } from './BottomSheetWrapper.native';

vi.mock('@tloncorp/ui', () => ({
  ActionSheetContext: createContext({ isInsideSheet: false }),
  Icon: () => null,
  Pressable: 'Button',
  Sheet: Object.assign(
    ({ children }: { children?: React.ReactNode }) => children,
    {
      Overlay: () => null,
      Frame: ({ children }: { children?: React.ReactNode }) => children,
      Handle: () => null,
    }
  ),
  View: 'View',
  useCopy: () => ({}),
  useIsWindowNarrow: () => true,
}));
const platform = vi.hoisted(() => ({ OS: 'ios' }));
vi.mock('react-native', () => ({
  Platform: platform,
  Keyboard: { dismiss: vi.fn() },
  useWindowDimensions: () => ({ height: 852 }),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaFrame: () => ({ height: 800 }),
  useSafeAreaInsets: () => ({ bottom: 48 }),
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
vi.mock('./ExpoUISheet', () => ({ ExpoUISheet: () => null }));
vi.mock('./BottomSheetWrapper', async () =>
  vi.importActual('./BottomSheetWrapper.native')
);
vi.mock('@expo/ui/community/bottom-sheet', () => ({
  BottomSheet: ({ children }: { children?: React.ReactNode }) => children,
  BottomSheetScrollView: () => null,
}));

setupReactTestEnvironment();
afterEach(() => {
  platform.OS = 'ios';
});

describe('ordinary ActionSheet dismissal forwarding', () => {
  it('forwards the open callback after content layout, but not when closed', () => {
    const opened = vi.fn();
    let tree: ReturnType<typeof create>;
    const element = (open: boolean) => (
      <ActionSheet open={open} onOpenChange={vi.fn()} onDidOpen={opened}>
        {null}
      </ActionSheet>
    );
    act(() => {
      tree = create(element(true));
    });
    const layout = () =>
      tree!.root.find(
        (node) => (node.type as unknown) === 'View' && node.props.onLayout
      ).props.onLayout;
    expect(opened).not.toHaveBeenCalled();
    act(() => layout()());
    expect(opened).toHaveBeenCalledOnce();
    act(() => tree.update(element(false)));
    act(() => layout()());
    expect(opened).toHaveBeenCalledOnce();
    act(() => tree.unmount());
  });

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

describe('percent snap points', () => {
  const snapPoints = (os: string) => {
    platform.OS = os;
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <BottomSheetWrapper
          open
          onOpenChange={vi.fn()}
          snapPointsMode="percent"
          snapPoints={[90]}
        >
          {null}
        </BottomSheetWrapper>
      );
    });
    const points = tree!.root.find((node) => node.props.index === 0).props
      .snapPoints;
    act(() => tree.unmount());
    return points;
  };

  it('leaves the detent to SwiftUI on iOS', () => {
    expect(snapPoints('ios')).toEqual(['90%']);
  });

  it('sizes an Android sheet against the app frame, less the navigation bar', () => {
    expect(snapPoints('android')).toEqual([0.9 * 800 - 48]);
  });
});

describe('narrow web sheet', () => {
  it('renders the footer', () => {
    platform.OS = 'web';
    const globals = globalThis as { window?: unknown };
    globals.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const Footer = () => null;
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <ActionSheet
          open
          onOpenChange={vi.fn()}
          footerComponent={() => <Footer />}
        >
          {null}
        </ActionSheet>
      );
    });
    expect(tree!.root.findAllByType(Footer)).toHaveLength(1);
    act(() => tree.unmount());
    delete globals.window;
  });
});
