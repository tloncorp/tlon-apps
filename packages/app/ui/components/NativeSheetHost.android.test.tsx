import React, { useImperativeHandle } from 'react';
import { type ReactTestInstance, act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

import { NativeSheetHost } from './NativeSheetHost.android';

const mocks = vi.hoisted(() => ({ hide: vi.fn<[], Promise<void>>() }));
vi.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 393, height: 852 }),
  StyleSheet: {
    flatten: (style: unknown) => style,
    create: (styles: unknown) => styles,
  },
  processColor: () => 0xffffffff,
  View: 'View',
  ScrollView: {},
  VirtualizedList: {},
}));
vi.mock('@expo/ui/jetpack-compose', () => ({
  ModalBottomSheet: ({
    ref,
    children,
  }: {
    ref: React.Ref<unknown>;
    children: React.ReactNode;
  }) => {
    useImperativeHandle(ref, () => ({ hide: mocks.hide }));
    return children;
  },
  Host: ({ children }: { children: React.ReactNode }) => children,
  Box: 'Box',
  Column: 'Column',
  RNHostView: 'RNHostView',
}));
vi.mock('@expo/ui/jetpack-compose/modifiers', () => ({
  fillMaxWidth: () => ({ $type: 'fillMaxWidth' }),
  height: (height: number) => ({ $type: 'height', height }),
  weight: (weight: number) => ({ $type: 'weight', weight }),
}));
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
  let tree: ReturnType<typeof create>;
  const element = (index: number) => (
    <NativeSheetHost index={index} onDismiss={dismissed} onChange={changed}>
      {null}
    </NativeSheetHost>
  );
  act(() => {
    tree = create(element(index));
  });
  return {
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

describe('Android sheet host dismissal', () => {
  it('waits for native hide after a close', async () => {
    const sheet = renderSheet();
    sheet.update(-1);
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
  });
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

describe('Android sheet host with a fixed height', () => {
  const layout = (height: number) => ({ nativeEvent: { layout: { height } } });
  const heightOf = (node: ReactTestInstance) =>
    (node.props.modifiers as { $type: string; height?: number }[]).find(
      (modifier) => modifier.$type === 'height'
    )?.height;

  function renderFixed(footer?: React.ReactNode) {
    const covered = vi.fn();
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <NativeSheetHost
          index={0}
          snapPoints={[600]}
          enableDynamicSizing={false}
          handleComponent={null}
          footer={footer}
          onCoveredHeightChange={covered}
        >
          {null}
        </NativeSheetHost>
      );
    });
    const hosts = () => tree.root.findAllByType('RNHostView' as never);
    return { covered, tree: tree!, hosts };
  }

  it('keeps the content at the full height whatever the host shows of it', () => {
    const sheet = renderFixed();
    const [content] = sheet.hosts();
    const pinned = content.findByType('View' as never);
    expect(pinned.props.style).toContainEqual({ height: 600 });
    expect(heightOf(sheet.tree.root.findByType('Column' as never))).toBe(600);
    sheet.tree.unmount();
  });

  it('gives the footer a slot of its own, sized to what is in it', () => {
    const sheet = renderFixed(null);
    const [, footerHost] = sheet.hosts();
    const slot = () => sheet.tree.root.findAllByType('Box' as never)[1];
    expect(heightOf(slot())).toBe(0);
    act(() =>
      footerHost.findByType('View' as never).props.onLayout(layout(84))
    );
    expect(heightOf(slot())).toBe(84);
    sheet.tree.unmount();
  });

  it('has no footer slot without a footer', () => {
    const sheet = renderFixed();
    expect(sheet.hosts()).toHaveLength(1);
    sheet.tree.unmount();
  });

  it('waits for the cover to stop growing, and reports it shrinking at once', () => {
    vi.useFakeTimers();
    const sheet = renderFixed();
    const [content] = sheet.hosts();
    // The keyboard opens: the host shows less of the content on every frame.
    act(() => content.props.onLayout(layout(500)));
    act(() => content.props.onLayout(layout(300)));
    expect(sheet.covered).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(sheet.covered).toHaveBeenCalledTimes(1);
    expect(sheet.covered).toHaveBeenLastCalledWith(300);
    // It closes: what is uncovered has to be there to be seen.
    act(() => content.props.onLayout(layout(450)));
    expect(sheet.covered).toHaveBeenLastCalledWith(150);
    act(() => content.props.onLayout(layout(600)));
    expect(sheet.covered).toHaveBeenLastCalledWith(0);
    sheet.tree.unmount();
    vi.useRealTimers();
  });
});
