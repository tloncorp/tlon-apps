import React, { createRef, useImperativeHandle } from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

import { BottomSheet } from '../../../../node_modules/@expo/ui/src/community/bottom-sheet/BottomSheet.android';
import type { BottomSheetMethods } from '../../../../node_modules/@expo/ui/src/community/bottom-sheet/types';

const mocks = vi.hoisted(() => ({ hide: vi.fn<[], Promise<void>>() }));
vi.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 393, height: 852 }),
  StyleSheet: { flatten: (style: unknown) => style },
  View: ({ children }: { children: React.ReactNode }) => children,
  ScrollView: {},
  VirtualizedList: {},
}));
vi.mock(
  '../../../../node_modules/@expo/ui/src/jetpack-compose/ModalBottomSheet',
  () => ({
    ModalBottomSheet: ({ ref }: { ref: React.Ref<unknown> }) => {
      useImperativeHandle(ref, () => ({ hide: mocks.hide }));
      return null;
    },
  })
);
vi.mock('../../../../node_modules/@expo/ui/src/jetpack-compose/Host', () => ({
  Host: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock(
  '../../../../node_modules/@expo/ui/src/jetpack-compose/RNHostView',
  () => ({
    RNHostView: ({ children }: { children: React.ReactNode }) => children,
  })
);
setupReactTestEnvironment();
beforeEach(() => {
  vi.clearAllMocks();
});

function renderSheet(index = 0) {
  let resolveHide!: () => void;
  mocks.hide.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        resolveHide = resolve;
      })
  );
  const dismissed = vi.fn();
  const changed = vi.fn();
  const ref = createRef<BottomSheetMethods>();
  let tree: ReturnType<typeof create>;
  const element = (index: number) => (
    <BottomSheet
      ref={ref}
      index={index}
      onDismiss={dismissed}
      onChange={changed}
    >
      {null}
    </BottomSheet>
  );
  act(() => {
    tree = create(element(index));
  });
  return {
    ref,
    dismissed,
    changed,
    tree: tree!,
    update(index: number) {
      act(() => tree.update(element(index)));
    },
    native() {
      return tree.root.find((node) => node.props.onDismissRequest != null);
    },
    async finishHide() {
      await act(async () => resolveHide());
    },
    unmount() {
      act(() => tree.unmount());
    },
  };
}

describe('installed Expo Android adapter dismissal', () => {
  it.each(['prop', 'method'] as const)(
    'waits for native hide after a %s close',
    async (source) => {
      const sheet = renderSheet();
      if (source === 'prop') sheet.update(-1);
      else act(() => sheet.ref.current?.close());
      expect(mocks.hide).toHaveBeenCalledTimes(1);
      expect(sheet.changed).toHaveBeenCalledWith(-1);
      expect(sheet.dismissed).not.toHaveBeenCalled();
      expect(sheet.native()).toBeDefined();
      await sheet.finishHide();
      expect(sheet.dismissed).toHaveBeenCalledTimes(1);
      expect(
        sheet.tree.root.findAll((node) => node.props.onDismissRequest != null)
      ).toHaveLength(0);
      sheet.unmount();
    }
  );
  it('deduplicates a gesture completion racing the hide promise', async () => {
    const sheet = renderSheet();
    sheet.update(-1);
    const completion = sheet.native().props.onDismissRequest;
    act(() => completion());
    await sheet.finishHide();
    expect(sheet.dismissed).toHaveBeenCalledTimes(1);
    expect(sheet.changed).toHaveBeenCalledTimes(1);
    sheet.unmount();
  });
  it('replaces an in-flight hide on reopen and ignores its stale completion', async () => {
    const sheet = renderSheet();
    sheet.update(-1);
    const staleNative = sheet.native().props.onDismissRequest;
    sheet.update(0);
    await sheet.finishHide();
    act(() => staleNative());
    expect(sheet.dismissed).not.toHaveBeenCalled();
    expect(sheet.native()).toBeDefined();
    sheet.update(-1);
    await sheet.finishHide();
    expect(sheet.dismissed).toHaveBeenCalledTimes(1);
    sheet.unmount();
  });
  it('does not dismiss an initially closed sheet', () => {
    const sheet = renderSheet(-1);
    expect(mocks.hide).not.toHaveBeenCalled();
    expect(sheet.dismissed).not.toHaveBeenCalled();
    sheet.unmount();
  });

  it('reports native gesture completion once without starting another hide', () => {
    const sheet = renderSheet();
    const completion = sheet.native().props.onDismissRequest;
    act(() => completion());
    act(() => completion());
    expect(mocks.hide).not.toHaveBeenCalled();
    expect(sheet.dismissed).toHaveBeenCalledTimes(1);
    sheet.unmount();
  });

  it('ignores a hide promise that completes after the adapter unmounts', async () => {
    const sheet = renderSheet();
    sheet.update(-1);
    sheet.unmount();
    await sheet.finishHide();
    expect(sheet.dismissed).not.toHaveBeenCalled();
  });

  it('rejects the previous native callback after a completed close and new presentation', async () => {
    const sheet = renderSheet();
    const stale = sheet.native().props.onDismissRequest;
    sheet.update(-1);
    await sheet.finishHide();
    sheet.update(0);
    act(() => stale());
    expect(sheet.dismissed).toHaveBeenCalledTimes(1);
    expect(sheet.native()).toBeDefined();
    act(() => sheet.native().props.onDismissRequest());
    expect(sheet.dismissed).toHaveBeenCalledTimes(2);
    sheet.unmount();
  });
});
