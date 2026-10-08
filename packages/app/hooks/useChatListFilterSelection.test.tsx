import React, { useLayoutEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { setupReactTestEnvironment } from '../test/sheetTestUtils';
import { CHAT_LIST_FILTERS, type ChatListFilter } from './chatListFilters';
import { useChatListFilterSelection } from './useChatListFilterSelection';

const WITHOUT_JUST_ME: ChatListFilter[] = ['all', 'with-others', 'messages'];

type Props = Parameters<typeof useChatListFilterSelection>[0];
type Selection = ReturnType<typeof useChatListFilterSelection>;

function renderSelection(initial: Props) {
  let props = initial;
  let current: Selection;
  // Every value the hook rendered with, including renders React discards, so
  // a test can tell whether a hidden segment ever reached the screen.
  const rendered: ChatListFilter[] = [];
  function Probe() {
    const selection = useChatListFilterSelection(props);
    rendered.push(selection.listFilter);
    useLayoutEffect(() => {
      current = selection;
    });
    return null;
  }
  let tree: ReturnType<typeof create>;
  act(() => {
    tree = create(<Probe />);
  });
  return {
    get listFilter() {
      return current!.listFilter;
    },
    rendered,
    select(filter: ChatListFilter) {
      act(() => current!.selectFilter(filter));
    },
    update(next: Partial<Props>) {
      props = { ...props, ...next };
      act(() => tree.update(<Probe />));
    },
    unmount() {
      act(() => tree.unmount());
    },
  };
}

setupReactTestEnvironment();

describe('useChatListFilterSelection', () => {
  it('reads a pick whose chip has gone as all from the first render', () => {
    const hook = renderSelection({
      visibleFilters: CHAT_LIST_FILTERS,
      loaded: true,
    });
    hook.select('just-me');
    expect(hook.listFilter).toBe('just-me');

    const before = hook.rendered.length;
    hook.update({ visibleFilters: WITHOUT_JUST_ME });
    expect(hook.listFilter).toBe('all');
    expect(hook.rendered.slice(before)).not.toContain('just-me');
    hook.unmount();
  });

  it('stays on all when the segment refills', () => {
    const hook = renderSelection({
      visibleFilters: CHAT_LIST_FILTERS,
      loaded: true,
    });
    hook.select('just-me');
    hook.update({ visibleFilters: WITHOUT_JUST_ME });
    hook.update({ visibleFilters: CHAT_LIST_FILTERS });
    expect(hook.listFilter).toBe('all');
    hook.unmount();
  });

  it('keeps a pick whose chip is still offered', () => {
    const hook = renderSelection({
      visibleFilters: CHAT_LIST_FILTERS,
      loaded: true,
    });
    hook.select('messages');
    hook.update({ visibleFilters: WITHOUT_JUST_ME });
    expect(hook.listFilter).toBe('messages');
    hook.unmount();
  });

  it('does not commit a fallback before the list has loaded', () => {
    const hook = renderSelection({
      visibleFilters: WITHOUT_JUST_ME,
      loaded: false,
    });
    hook.select('just-me');
    expect(hook.listFilter).toBe('all');
    hook.update({ visibleFilters: CHAT_LIST_FILTERS, loaded: true });
    expect(hook.listFilter).toBe('just-me');
    hook.unmount();
  });
});
