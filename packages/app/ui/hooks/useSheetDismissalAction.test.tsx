import React, { useLayoutEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

import { useSheetDismissalAction } from './useSheetDismissalAction';

const environment = vi.hoisted(() => ({ nativeSheet: true }));
vi.mock('./useIsNativeSheet', () => ({
  useIsNativeSheet: () => environment.nativeSheet,
}));

type Options = Parameters<typeof useSheetDismissalAction>[0];
type Controller = ReturnType<typeof useSheetDismissalAction>;

function renderHook(waitForDismissal = true) {
  let controller: Controller;
  const onOpenChange = vi.fn();
  let options: Options = { open: true, waitForDismissal, onOpenChange };
  function Probe() {
    const current = useSheetDismissalAction(options);
    useLayoutEffect(() => {
      controller = current;
    });
    return null;
  }
  let tree: ReturnType<typeof create>;
  act(() => {
    tree = create(<Probe />);
  });
  return {
    get controller() {
      return controller!;
    },
    onOpenChange,
    setOpen(open: boolean) {
      options = { ...options, open };
      act(() => {
        tree.update(<Probe />);
      });
    },
    setNative(waitForDismissal: boolean) {
      options = { ...options, waitForDismissal };
      act(() => tree.update(<Probe />));
    },
    unmount() {
      act(() => {
        tree.unmount();
      });
    },
  };
}

setupReactTestEnvironment();

describe('useSheetDismissalAction', () => {
  it('retains a closing native host until completion, without a timer', () => {
    vi.useFakeTimers();
    const hook = renderHook();
    hook.setOpen(false);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(hook.controller.shouldRender).toBe(true);
    act(() => hook.controller.onDismissed());
    expect(hook.controller.shouldRender).toBe(false);
    hook.unmount();
    vi.useRealTimers();
  });

  it('ignores an old presentation completion even after the reopened sheet closes', () => {
    const hook = renderHook();
    hook.setOpen(false);
    const stale = hook.controller.onDismissed;
    const oldKey = hook.controller.presentationKey;
    hook.setOpen(true);
    expect(hook.controller.presentationKey).not.toBe(oldKey);
    const action = vi.fn();
    act(() => hook.controller.dismissThenRun(action));
    hook.setOpen(false);
    act(() => stale());
    expect(action).not.toHaveBeenCalled();
    expect(hook.controller.shouldRender).toBe(true);
    act(() => hook.controller.onDismissed());
    expect(action).toHaveBeenCalledTimes(1);
    expect(hook.controller.shouldRender).toBe(false);
    hook.unmount();
  });

  it('allows a competing close path to cancel the queued action', () => {
    const hook = renderHook();
    const action = vi.fn();
    act(() => hook.controller.dismissThenRun(action));
    hook.setOpen(false);
    hook.controller.cancel();
    act(() => hook.controller.onDismissed());
    expect(action).not.toHaveBeenCalled();
    expect(hook.controller.shouldRender).toBe(false);
    hook.unmount();
  });

  it('does not retain non-native content after closing', () => {
    const hook = renderHook(false);
    hook.setOpen(false);
    expect(hook.controller.shouldRender).toBe(false);
    hook.unmount();
  });

  it('cancels a handoff when its native host is replaced by a wide dialog', () => {
    const hook = renderHook();
    const action = vi.fn();
    act(() => hook.controller.dismissThenRun(action));
    hook.setOpen(false);
    const stale = hook.controller.onDismissed;
    hook.setNative(false);
    expect(hook.controller.shouldRender).toBe(false);
    act(() => stale());
    expect(action).not.toHaveBeenCalled();
    hook.unmount();
  });
  it.each(['camera', 'library', 'file picker', 'voice recorder'])(
    'waits for completion before presenting %s, and runs once',
    () => {
      const hook = renderHook();
      const action = vi.fn();
      hook.controller.dismissThenRun(action);
      expect(hook.onOpenChange).toHaveBeenCalledWith(false);
      expect(action).not.toHaveBeenCalled();
      hook.setOpen(false);
      expect(action).not.toHaveBeenCalled();
      act(() => hook.controller.onDismissed());
      act(() => hook.controller.onDismissed());
      expect(action).toHaveBeenCalledTimes(1);
      hook.unmount();
    }
  );

  it('keeps non-native picker presentation in the original user gesture', () => {
    const hook = renderHook(false);
    const action = vi.fn();
    hook.controller.dismissThenRun(action);
    expect(action).toHaveBeenCalledTimes(1);
    hook.setOpen(false);
    act(() => hook.controller.onDismissed());
    expect(action).toHaveBeenCalledTimes(1);
    hook.unmount();
  });

  it('does nothing for cancellation without a handoff', () => {
    const hook = renderHook();
    hook.setOpen(false);
    act(() => hook.controller.onDismissed());
    expect(hook.onOpenChange).not.toHaveBeenCalled();
    hook.unmount();
  });

  it('cancels a pending handoff on reopen', () => {
    const hook = renderHook();
    const action = vi.fn();
    hook.controller.dismissThenRun(action);
    hook.setOpen(false);
    hook.setOpen(true);
    act(() => hook.controller.onDismissed());
    hook.setOpen(false);
    act(() => hook.controller.onDismissed());
    expect(action).not.toHaveBeenCalled();
    hook.unmount();
  });

  it('does not present a queued modal after unmount', () => {
    const hook = renderHook();
    const action = vi.fn();
    hook.controller.dismissThenRun(action);
    hook.setOpen(false);
    hook.unmount();
    act(() => hook.controller.onDismissed());
    hook.controller.dismissThenRun(action);
    expect(action).not.toHaveBeenCalled();
  });

  it.each([
    ['waits', true, 0],
    ['does not wait', false, 1],
  ] as const)(
    '%s by default when the sheet is native: %s',
    (_, nativeSheet, callsBeforeDismissal) => {
      environment.nativeSheet = nativeSheet;
      const action = vi.fn();
      let controller!: Controller;
      function Probe() {
        const current = useSheetDismissalAction({
          open: true,
          onOpenChange: vi.fn(),
        });
        useLayoutEffect(() => {
          controller = current;
        });
        return null;
      }
      let tree!: ReturnType<typeof create>;
      act(() => {
        tree = create(<Probe />);
      });
      controller.dismissThenRun(action);
      expect(action).toHaveBeenCalledTimes(callsBeforeDismissal);
      act(() => tree.unmount());
      environment.nativeSheet = true;
    }
  );

  it('does not queue an action while closed', () => {
    const hook = renderHook();
    const action = vi.fn();
    hook.setOpen(false);
    hook.controller.dismissThenRun(action);
    act(() => hook.controller.onDismissed());
    expect(action).not.toHaveBeenCalled();
    expect(hook.onOpenChange).not.toHaveBeenCalled();
    hook.unmount();
  });
});
