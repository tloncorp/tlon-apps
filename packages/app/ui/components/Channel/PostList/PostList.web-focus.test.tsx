// @vitest-environment jsdom
import { act, createElement, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLifecyclePermit } from '../../../../hooks/useLifecyclePermit';
import { createConversationEndAnchorRegistry } from '../../../contexts/conversationEndAnchor';
import { PostList } from './PostList.web';
import type { PostListComponentProps, PostListMethods } from './shared';
const boundary = vi.hoisted(() => ({
  calls: [] as string[],
  anchor: null as ReturnType<typeof createConversationEndAnchorRegistry> | null,
}));
vi.mock('../../../contexts/scroll', () => ({
  useConversationScrollEndAnchor: () => boundary.anchor,
}));
vi.mock('@tloncorp/shared', () => ({
  useMutableCallback: (callback: unknown) => callback,
}));
vi.mock('react-native', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});
vi.mock('./shared', () => ({ usePostListBottomCallbacks: () => {} }));
vi.mock('./PostListFlatList', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    PostList: React.forwardRef((_props, ref) => {
      React.useImperativeHandle(ref, () => ({
        captureScrollIntent: () => () => true,
        scrollToEnd: () => boundary.calls.push('grid-end'),
        scrollToStart: () => boundary.calls.push('grid-start'),
        scrollToPost: () => boundary.calls.push('grid-post'),
      }));
      return React.createElement('div', { 'data-grid': true });
    }),
  };
});
let root: Root, host: HTMLDivElement;
let viewportHeight = 699;
const handle = createRef<PostListMethods>();
function Harness({
  focused,
  columns = 1,
  loaded = false,
  selected = false,
}: {
  focused: boolean;
  columns?: number;
  loaded?: boolean;
  selected?: boolean;
}) {
  const visit = useLifecyclePermit(['chat/~zod/focus-test'], focused);
  const props: PostListComponentProps = {
    channel: {
      id: 'chat/~zod/focus-test',
      type: columns === 1 ? 'chat' : 'gallery',
    },
    anchor: selected ? { type: 'selected', postId: 'late-post' } : null,
    anchorToEnd: true,
    numColumns: columns,
    collectionLayoutType: columns === 1 ? 'compact-list-bottom-to-top' : 'grid',
    postsWithNeighbors: loaded
      ? [
          {
            post: {
              id: 'late-post',
              type: 'chat',
              authorId: '~zod',
              channelId: 'chat/~zod/focus-test',
              sentAt: 1,
              receivedAt: 1,
            },
            previous: null,
            next: null,
          },
        ]
      : [],
    renderItem: () => createElement('span', null, 'post'),
    isFocused: focused,
    scrollVisit: visit,
  };
  return createElement(PostList, { ...props, ref: handle });
}
async function render(
  focused: boolean,
  columns = 1,
  loaded = false,
  selected = false
) {
  await act(async () =>
    root.render(createElement(Harness, { focused, columns, loaded, selected }))
  );
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  document.head.innerHTML = '<style>*{opacity:1;visibility:visible}</style>';
  boundary.calls = [];
  boundary.anchor = createConversationEndAnchorRegistry();
  viewportHeight = 699;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
    () => viewportHeight
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1399);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 600, 699)
  );
  vi.stubGlobal('CSS', { escape: (value: string) => value });
  HTMLElement.prototype.scrollTo = function (
    options?: ScrollToOptions | number
  ) {
    if (!options || typeof options === 'number')
      throw new Error('Unexpected scroll overload');
    boundary.calls.push(`web-${options.top}`);
    this.scrollTop = options.top ?? 0;
  };
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.head.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('real web list focused imperative boundary', () => {
  it('still performs synchronous initial landing before parent visit layout activates', async () => {
    await render(true);
    expect(host.querySelector<HTMLElement>('[tabindex]')!.scrollTop).toBe(700);
    expect(handle.current!.captureScrollIntent!()()).toBe(true);
  });
  it.each([1, 2])(
    'keeps captured and stale direct commands retired after focus ABA in layout%s',
    async (columns) => {
      await render(true, columns);
      const old = handle.current!,
        permit = old.captureScrollIntent!(),
        node = host.firstElementChild;
      await render(false, columns);
      boundary.calls = [];
      old.scrollToEnd({ animated: false });
      handle.current!.scrollToEnd({ animated: false });
      expect(boundary.calls).toEqual([]);
      expect(permit()).toBe(false);
      await render(true, columns);
      expect(host.firstElementChild).toBe(node);
      expect(permit()).toBe(false);
      boundary.calls = [];
      old.scrollToStart({ animated: false });
      expect(boundary.calls).toEqual([]);
      handle.current!.scrollToStart({ animated: false });
      expect(boundary.calls).toHaveLength(1);
    }
  );
  it('never retries a covered missing selected anchor after same-scope return', async () => {
    await render(true, 1, false, true);
    await render(false, 1, false, true);
    boundary.calls = [];
    await render(false, 1, true, true);
    expect(boundary.calls).toEqual([]);
    await render(true, 1, true, true);
    expect(boundary.calls).toEqual([]);
  });

  it('reconciles a committed composer growth before any ResizeObserver callback', async () => {
    await render(true);
    const permit = handle.current!.captureScrollIntent!();
    viewportHeight = 688;
    boundary.anchor!.layoutChanged?.();
    expect(host.querySelector<HTMLElement>('[tabindex]')!.scrollTop).toBe(711);
    expect(permit()).toBe(true);
  });

  it('does not turn composer growth into FOLLOW after deliberate history navigation', async () => {
    await render(true);
    handle.current!.scrollToStart({ animated: false });
    const permit = handle.current!.captureScrollIntent!();
    viewportHeight = 688;
    boundary.calls = [];
    boundary.anchor!.layoutChanged?.();
    expect(host.querySelector<HTMLElement>('[tabindex]')!.scrollTop).toBe(0);
    expect(boundary.calls).toEqual([]);
    expect(permit()).toBe(true);
  });

  it('does not act on composer notifications while covered or resume FOLLOW on return', async () => {
    await render(true);
    await render(false);
    viewportHeight = 688;
    boundary.calls = [];
    boundary.anchor!.layoutChanged?.();
    expect(boundary.calls).toEqual([]);
    await render(true);
    viewportHeight = 650;
    boundary.anchor!.layoutChanged?.();
    expect(host.querySelector<HTMLElement>('[tabindex]')!.scrollTop).toBe(700);
    expect(boundary.calls).toEqual([]);
  });

  it('retires the layout registration when the conversation unmounts', async () => {
    await render(true);
    await act(async () => root.render(null));
    viewportHeight = 650;
    boundary.calls = [];
    boundary.anchor!.layoutChanged?.();
    expect(boundary.calls).toEqual([]);
  });

  it('leaves a separately captured restore pending through a layout notification', () => {
    const restore = vi.fn();
    const layoutChanged = vi.fn();
    boundary.anchor!.register({ capture: vi.fn(), restore, layoutChanged });
    boundary.anchor!.capture();
    boundary.anchor!.layoutChanged();
    expect(layoutChanged).toHaveBeenCalledTimes(1);
    expect(restore).not.toHaveBeenCalled();
    boundary.anchor!.restore();
    boundary.anchor!.restore();
    expect(restore).toHaveBeenCalledTimes(1);
  });
});
