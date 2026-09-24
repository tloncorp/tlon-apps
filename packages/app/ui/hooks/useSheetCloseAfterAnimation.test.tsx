import React, { useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { useSheetCloseAfterAnimation } from './useSheetCloseAfterAnimation';

// The hook reads Platform.OS only for its default delay; every test passes one
// explicitly, so the mock just has to exist.
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

type SheetCloseHook = ReturnType<typeof useSheetCloseAfterAnimation>;

// Published from an effect rather than during render, and deliberately not
// cleared on unmount: the interesting case calls the scheduler after the tree
// is gone, which is what an awaiting caller ends up doing.
let lastHook: SheetCloseHook | null = null;

function Probe({ delayMs }: { delayMs: number }) {
  const hook = useSheetCloseAfterAnimation(delayMs);
  useEffect(() => {
    lastHook = hook;
  });
  return null;
}

function renderProbe(delayMs: number) {
  let tree: ReturnType<typeof create> | null = null;
  act(() => {
    tree = create(<Probe delayMs={delayMs} />);
  });
  const hook = lastHook;
  if (!hook || !tree) {
    throw new Error('probe did not render');
  }
  const rendered = tree as ReturnType<typeof create>;
  return {
    hook,
    unmount: () =>
      act(() => {
        rendered.unmount();
      }),
  };
}

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterAll(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

beforeEach(() => {
  lastHook = null;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSheetCloseAfterAnimation', () => {
  it('runs the action after the grace window', () => {
    const onClosed = vi.fn();
    const { hook } = renderProbe(300);

    hook.closeAfterAnimation(onClosed);
    expect(onClosed).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('runs the action immediately when the window is zero', () => {
    const onClosed = vi.fn();
    const { hook } = renderProbe(0);

    hook.closeAfterAnimation(onClosed);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending action on unmount', () => {
    const onClosed = vi.fn();
    const probe = renderProbe(300);

    probe.hook.closeAfterAnimation(onClosed);
    probe.unmount();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onClosed).not.toHaveBeenCalled();
  });

  // A caller that awaits before scheduling can arrive after unmount, where
  // there is no pending timer left for the cleanup to cancel.
  it('drops an action scheduled after unmount', () => {
    const onClosed = vi.fn();
    const probe = renderProbe(300);

    probe.unmount();
    probe.hook.closeAfterAnimation(onClosed);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onClosed).not.toHaveBeenCalled();
  });

  // Same path with a zero window, where the action would otherwise run
  // straight away rather than leaving an uncancellable timer behind.
  it('drops an action scheduled after unmount with a zero window', () => {
    const onClosed = vi.fn();
    const probe = renderProbe(0);

    probe.unmount();
    probe.hook.closeAfterAnimation(onClosed);

    expect(onClosed).not.toHaveBeenCalled();
  });

  it('supersedes a pending action with a later one', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { hook } = renderProbe(300);

    hook.closeAfterAnimation(first);
    hook.closeAfterAnimation(second);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('cancel drops a pending action', () => {
    const onClosed = vi.fn();
    const { hook } = renderProbe(300);

    hook.closeAfterAnimation(onClosed);
    hook.cancel();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onClosed).not.toHaveBeenCalled();
  });
});
