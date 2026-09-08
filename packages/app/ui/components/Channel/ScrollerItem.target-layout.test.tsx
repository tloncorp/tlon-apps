import React, { createRef } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScrollerItem } from './ScrollerItem';
import { createPostTargetLayoutRegistry } from './postTargetLayout';

vi.mock('@tloncorp/shared/store', () => ({ editPost: vi.fn() }));
vi.mock('@tloncorp/shared/logic', () => ({
  isToday: () => true,
  makePrettyDay: () => 'Today',
}));
vi.mock('@tloncorp/ui', () => ({ Text: 'Text' }));
vi.mock('../../../hooks/useLivePost', () => ({
  useLivePost: (post: unknown) => post,
}));
vi.mock('react-native', () => ({ View: 'RNView' }));
// Preserve the actual installed Tamagui forwarded-ref lifetime; plain host
// strings would incorrectly reattach a new callback on every lease change.
vi.mock('tamagui', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const { composeRefs } = await vi.importActual<
    typeof import('@tamagui/compose-refs')
  >('@tamagui/compose-refs');
  const { readFileSync } =
    await vi.importActual<typeof import('node:fs')>('node:fs');
  const { createRequire } =
    await vi.importActual<typeof import('node:module')>('node:module');
  const { dirname, join, resolve } =
    await vi.importActual<typeof import('node:path')>('node:path');
  const require = createRequire(resolve('package.json'));
  const source = readFileSync(
    join(
      dirname(require.resolve('@tamagui/web')),
      '../esm/createComponent.native.js'
    ),
    'utf8'
  );
  const from = source.indexOf('    if (!stateRef.current.composedRef)');
  const to = source.indexOf('\n    usePointerEvents(', from);
  if (from < 0 || to < from)
    throw Error('actual Tamagui composed-ref fragment unavailable');
  const compose = new Function(
    'stateRef',
    'forwardedRef',
    'setElementProps',
    'animatedRef',
    'viewProps',
    'composeRefs',
    source.slice(from, to) + '\nreturn viewProps.ref;'
  );
  const host = (kind: string) =>
    React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
      const stateRef = React.useRef({});
      const actualRef = compose(
        stateRef,
        ref,
        () => {},
        undefined,
        {},
        composeRefs
      );
      return React.createElement(kind, { ...props, ref: actualRef });
    });
  return {
    View: host('View'),
    XStack: host('XStack'),
    styled: (_: unknown, config: { name: string }) => host(config.name),
  };
});

let tree: ReactTestRenderer | undefined;
afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
});
const noop = () => {};
const Message = () => React.createElement('message');
const base = {
  item: { id: 'one', channelId: 'chat/a', type: 'chat', receivedAt: 1 },
  index: 0,
  showUnreadDivider: false,
  showDayDivider: false,
  showAuthor: true,
  Component: Message,
  onLongPressPost: noop,
  onPressDelete: noop,
  onShowEmojiPicker: noop,
  messageRef: createRef(),
  isSelected: false,
  isLastPostOfBlock: false,
  dividersEnabled: true,
  columnCount: 1,
};
type Frame = [number, number, number, number, number, number];
type Host = {
  type: string;
  onLayout: unknown;
  measure: (callback: (...frame: Frame) => void) => void;
};
function nodes(type: string) {
  return tree!.root.findAll(
    (n) => typeof n.type === 'string' && n.type === type
  );
}
function harness(
  extra: Record<string, unknown> = {},
  initial = { cell: 128, divider: 48, separator: 8 },
  enabledAtMount = true
) {
  let props = { ...base, ...extra };
  let geometry = { ...initial };
  let pending: { host: Host; callback: (...frame: Frame) => void }[] = [];
  let frames: (() => void)[] = [];
  let missing = false;
  let enabled = enabledAtMount;
  const registry = createPostTargetLayoutRegistry('chat/a', (cb) =>
    frames.push(cb)
  );
  const mock = (element: React.ReactElement) => {
    const host: Host = {
      type: String(element.type),
      onLayout: (element.props as { onLayout?: unknown }).onLayout,
      measure(callback) {
        pending.push({ host, callback });
      },
    };
    return host;
  };
  const update = (next: Record<string, unknown> = {}) => {
    props = { ...props, ...next };
    act(() => {
      const element = React.createElement(ScrollerItem, {
        ...props,
        targetLayouts: enabled ? registry : undefined,
      } as never);
      if (tree) tree.update(element);
      else tree = create(element, { createNodeMock: mock });
    });
  };
  const frame = (host: Host): Frame => {
    let y = 100,
      h = geometry.cell;
    const leading = Boolean(
      props.dividersEnabled && (props.showDayDivider || props.showUnreadDivider)
    );
    if (host.type === 'XStack') h = geometry.divider;
    if (host.type === 'PostBlockSeparator') {
      const index = nodes('PostBlockSeparator').findIndex(
        (n) => n.props.onLayout === host.onLayout
      );
      y +=
        leading && index === 0
          ? geometry.divider
          : geometry.cell - geometry.separator;
      h = geometry.separator;
    }
    return [0, y - 100, 300, missing ? 0 : h, 20, y];
  };
  const deliverOne = () => {
    const request = pending.shift();
    if (request) act(() => request.callback(...frame(request.host)));
    return request;
  };
  const publish = () => {
    const batch = frames;
    frames = [];
    act(() => batch.forEach((cb) => cb()));
  };
  const flush = () => {
    let count = 0;
    while (pending.length) {
      if (++count > 100) throw Error('measurement loop');
      deliverOne();
    }
    publish();
  };
  const notify = (type = 'View', index = 0) => {
    const cb = nodes(type)[index].props.onLayout;
    expect(typeof cb).toBe('function');
    act(() => cb({ nativeEvent: { layout: { height: 999 } } }));
  };
  update();
  return {
    registry,
    update,
    flush,
    publish,
    notify,
    deliverOne,
    takePending: () => {
      const p = pending;
      pending = [];
      return p;
    },
    set: (next: Partial<typeof geometry>) => {
      geometry = { ...geometry, ...next };
    },
    setEnabled: (value: boolean) => {
      enabled = value;
    },
    setMissing: (value: boolean) => {
      missing = value;
    },
  };
}

describe('actual ScrollerItem with owned native host measurement callbacks', () => {
  it.each([
    ['grouped', {}, 128, 0, 0],
    ['trailing group', { isLastPostOfBlock: true }, 128, 0, 8],
    ['last', { index: 9 }, 128, 0, 0],
    ['notice', { item: { ...base.item, type: 'notice' } }, 128, 0, 0],
    ['day', { showDayDivider: true }, 176, 56, 0],
    [
      'unread overrides day',
      { showDayDivider: true, showUnreadDivider: true, unreadCount: 3 },
      176,
      56,
      0,
    ],
    [
      'thread without divider',
      { showDayDivider: true, dividersEnabled: false, isLastPostOfBlock: true },
      128,
      0,
      8,
    ],
  ] as const)(
    '%s measures actual rendered decoration',
    (_label, props, cell, leading, trailing) => {
      const h = harness(props, { cell, divider: 48, separator: 8 });
      h.publish();
      expect(h.registry.get('one', cell)).toBeUndefined();
      h.flush();
      expect(h.registry.get('one', cell)).toEqual({
        leading,
        trailing,
        cellSizeDelta: 0,
      });
      expect(nodes('message')).toHaveLength(1);
      expect(nodes('RNView')).toHaveLength(0);
    }
  );
  it('measures body resize and ignores onLayout payload as geometry authority', () => {
    const h = harness({ isLastPostOfBlock: true });
    h.flush();
    const message = nodes('message')[0];
    h.set({ cell: 308 });
    h.notify();
    expect(h.registry.get('one', 128)).toBeUndefined();
    h.flush();
    expect(h.registry.get('one', 999)).toBeUndefined();
    expect(h.registry.get('one', 308)).toEqual({
      leading: 0,
      trailing: 8,
      cellSizeDelta: 0,
    });
    expect(nodes('message')[0]).toBe(message);
  });
  it.each(['leading', 'trailing'] as const)(
    'removes %s without publishing the prior cell height',
    (removed) => {
      const cell = removed === 'leading' ? 176 : 128;
      const h = harness(
        {
          showDayDivider: removed === 'leading',
          isLastPostOfBlock: removed === 'trailing',
        },
        { cell, divider: 48, separator: 8 }
      );
      h.flush();
      h.set({ cell: 120 });
      h.update({ showDayDivider: false, isLastPostOfBlock: false });
      h.publish();
      expect(h.registry.get('one', cell)).toBeUndefined();
      h.flush();
      expect(h.registry.get('one', cell)).toBeUndefined();
      expect(h.registry.get('one', 120)).toEqual({
        leading: 0,
        trailing: 0,
        cellSizeDelta: 0,
      });
    }
  );
  it.each(['child-first', 'outer-first'] as const)(
    'refreshes current geometry in %s layout delivery',
    (order) => {
      const h = harness({}, { cell: 120, divider: 48, separator: 8 });
      h.flush();
      h.set({ cell: 176 });
      h.update({ showDayDivider: true });
      const types =
        order === 'child-first' ? ['XStack', 'View'] : ['View', 'XStack'];
      for (const type of types) {
        h.notify(type);
        h.publish();
        expect(h.registry.get('one', 120)).toBeUndefined();
      }
      h.flush();
      expect(h.registry.get('one', 176)).toEqual({
        leading: 56,
        trailing: 0,
        cellSizeDelta: 0,
      });
    }
  );
  it('measures same-height decoration changes without a second native onLayout', () => {
    const h = harness({ isLastPostOfBlock: true });
    h.flush();
    const message = nodes('message')[0];
    h.update({ showUnreadDivider: true, isLastPostOfBlock: false });
    h.flush();
    expect(h.registry.get('one', 128)).toEqual({
      leading: 56,
      trailing: 0,
      cellSizeDelta: 0,
    });
    expect(nodes('message')[0]).toBe(message);
  });
  it.each(['leading', 'trailing'] as const)(
    'freshly reads unchanged %s hosts when the other node changes',
    (kept) => {
      const h = harness(
        {
          showDayDivider: kept === 'leading',
          isLastPostOfBlock: kept === 'trailing',
        },
        { cell: kept === 'leading' ? 176 : 128, divider: 48, separator: 8 }
      );
      h.flush();
      h.set({ cell: 184 });
      h.update({ showDayDivider: true, isLastPostOfBlock: true });
      h.flush();
      expect(h.registry.get('one', 184)).toEqual({
        leading: 56,
        trailing: 8,
        cellSizeDelta: 0,
      });
    }
  );
  it('rejects an outer bracket that changes during measurement', () => {
    const h = harness({ isLastPostOfBlock: true });
    h.deliverOne();
    h.set({ cell: 200 });
    h.flush();
    expect(h.registry.get('one', 200)).toBeUndefined();
    h.notify();
    h.flush();
    expect(h.registry.get('one', 200)).toEqual({
      leading: 0,
      trailing: 8,
      cellSizeDelta: 0,
    });
  });
  it('does not let an old request overwrite a newer measurement', () => {
    const h = harness({ isLastPostOfBlock: true });
    const old = h.takePending();
    h.set({ cell: 208 });
    h.notify();
    h.flush();
    expect(h.registry.get('one', 208)).toEqual({
      leading: 0,
      trailing: 8,
      cellSizeDelta: 0,
    });
    act(() => old.forEach((r) => r.callback(0, 0, 300, 128, 20, 100)));
    h.flush();
    expect(h.registry.get('one', 208)).toEqual({
      leading: 0,
      trailing: 8,
      cellSizeDelta: 0,
    });
    expect(h.registry.get('one', 128)).toBeUndefined();
  });
  it('freshly measures a new recycled key without inheriting old callbacks across ABA', () => {
    const h = harness({ isLastPostOfBlock: true });
    const first = h.takePending();
    h.update({ item: { ...base.item, id: 'two' } });
    const second = h.takePending();
    h.update({ item: { ...base.item } });
    h.flush();
    expect(h.registry.get('one', 128)).toEqual({
      leading: 0,
      trailing: 8,
      cellSizeDelta: 0,
    });
    expect(h.registry.get('two', 128)).toBeUndefined();
    act(() =>
      [...first, ...second].forEach((r) => r.callback(0, 0, 300, 999, 20, 100))
    );
    h.flush();
    expect(h.registry.get('one', 128)).toEqual({
      leading: 0,
      trailing: 8,
      cellSizeDelta: 0,
    });
    expect(h.registry.get('two', 999)).toBeUndefined();
  });
  it('rejects wrong-scope and unmounted measurement callbacks', () => {
    const h = harness();
    const old = h.takePending();
    h.update({ item: { ...base.item, channelId: 'chat/b' } });
    h.flush();
    act(() => old.forEach((r) => r.callback(0, 0, 300, 128, 20, 100)));
    h.flush();
    expect(h.registry.get('one', 128)).toBeUndefined();
    h.update({ item: base.item });
    const pending = h.takePending();
    act(() => tree!.unmount());
    tree = undefined;
    act(() => pending.forEach((r) => r.callback(0, 0, 300, 128, 20, 100)));
    h.publish();
    expect(h.registry.get('one', 128)).toBeUndefined();
  });
  it('retains actual physical host refs while measurement is disabled and later enabled', () => {
    const h = harness({ isLastPostOfBlock: true });
    h.setEnabled(false);
    h.update();
    h.flush();
    const outer = nodes('View')[0];
    expect(h.registry.get('one', 128)).toBeUndefined();
    h.setEnabled(true);
    h.update();
    h.flush();
    expect(nodes('View')[0]).toBe(outer);
    expect(h.registry.get('one', 128)).toEqual({
      leading: 0,
      trailing: 8,
      cellSizeDelta: 0,
    });
  });
  it('can enable a physical row that originally mounted without a registry', () => {
    const h = harness(
      { isLastPostOfBlock: true },
      { cell: 128, divider: 48, separator: 8 },
      false
    );
    h.flush();
    const outer = nodes('View')[0];
    expect(h.registry.get('one', 128)).toBeUndefined();
    h.setEnabled(true);
    h.update();
    h.flush();
    expect(nodes('View')[0]).toBe(outer);
    expect(h.registry.get('one', 128)).toEqual({
      leading: 0,
      trailing: 8,
      cellSizeDelta: 0,
    });
  });
  it('keeps missing or zero measurement unavailable until a fresh current measurement succeeds', () => {
    const h = harness({ isLastPostOfBlock: true });
    h.setMissing(true);
    h.flush();
    expect(h.registry.get('one', 128)).toBeUndefined();
    h.setMissing(false);
    h.notify();
    h.flush();
    expect(h.registry.get('one', 128)).toEqual({
      leading: 0,
      trailing: 8,
      cellSizeDelta: 0,
    });
  });
});
