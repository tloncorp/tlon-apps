import React, { createRef } from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

// Exercise the installed patch, not a replacement for the community adapter.
import { BottomSheet } from '../../../../node_modules/@expo/ui/src/community/bottom-sheet/BottomSheet.ios';
import type { BottomSheetMethods } from '../../../../node_modules/@expo/ui/src/community/bottom-sheet/types';

vi.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 393 }),
  StyleSheet: { flatten: (style: unknown) => style },
  View: ({ children }: { children: React.ReactNode }) => children,
  ScrollView: {},
  VirtualizedList: {},
}));
vi.mock('../../../../node_modules/@expo/ui/src/swift-ui/BottomSheet', () => ({
  BottomSheet: () => null,
}));
vi.mock('../../../../node_modules/@expo/ui/src/swift-ui/Host', () => ({
  Host: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../../../../node_modules/@expo/ui/src/swift-ui/Group', () => ({
  Group: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../../../../node_modules/@expo/ui/src/swift-ui/RNHostView', () => ({
  RNHostView: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock(
  '../../../../node_modules/@expo/ui/src/swift-ui/modifiers/presentationModifiers',
  () => ({
    interactiveDismissDisabled: vi.fn(),
    presentationBackground: vi.fn(),
    presentationDetents: vi.fn(),
    presentationDragIndicator: vi.fn(),
    presentationSizing: vi.fn(),
  })
);

setupReactTestEnvironment();

describe('Expo iOS community sheet dismissal', () => {
  it.each(['prop', 'method', 'gesture'] as const)(
    'does not report completion when a %s close only starts',
    (source) => {
      const onDismiss = vi.fn();
      const onClose = vi.fn();
      const ref = createRef<BottomSheetMethods>();
      let tree: ReturnType<typeof create>;
      const element = (index: number) => (
        <BottomSheet
          ref={ref}
          index={index}
          onClose={onClose}
          onDismiss={onDismiss}
        >
          {null}
        </BottomSheet>
      );
      act(() => {
        tree = create(element(0));
      });
      const native = () =>
        tree.root.find((node) => node.props.isPresented != null);
      act(() => {
        if (source === 'prop') tree.update(element(-1));
        if (source === 'method') ref.current?.close();
        if (source === 'gesture') native().props.onIsPresentedChange(false);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(native().props.isPresented).toBe(false);
      expect(onDismiss).not.toHaveBeenCalled();
      act(() => native().props.onDismiss());
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
      act(() => tree.unmount());
    }
  );

  it('does not emit a completion event for an initially closed sheet', () => {
    const onDismiss = vi.fn();
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <BottomSheet index={-1} onDismiss={onDismiss}>
          {null}
        </BottomSheet>
      );
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });
});
