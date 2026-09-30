import React, { useLayoutEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { useSheetDismissalAction } from './useSheetDismissalAction';

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
    unmount() {
      act(() => {
        tree.unmount();
      });
    },
  };
}

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterAll(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

describe('useSheetDismissalAction', () => {
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
      hook.controller.onDismissed();
      hook.controller.onDismissed();
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
    hook.controller.onDismissed();
    expect(action).toHaveBeenCalledTimes(1);
    hook.unmount();
  });

  it('does nothing for cancellation without a handoff', () => {
    const hook = renderHook();
    hook.setOpen(false);
    hook.controller.onDismissed();
    expect(hook.onOpenChange).not.toHaveBeenCalled();
    hook.unmount();
  });

  it('cancels a pending handoff on reopen', () => {
    const hook = renderHook();
    const action = vi.fn();
    hook.controller.dismissThenRun(action);
    hook.setOpen(false);
    hook.setOpen(true);
    hook.controller.onDismissed();
    hook.setOpen(false);
    hook.controller.onDismissed();
    expect(action).not.toHaveBeenCalled();
    hook.unmount();
  });

  it('does not present a queued modal after unmount', () => {
    const hook = renderHook();
    const action = vi.fn();
    hook.controller.dismissThenRun(action);
    hook.setOpen(false);
    hook.unmount();
    hook.controller.onDismissed();
    hook.controller.dismissThenRun(action);
    expect(action).not.toHaveBeenCalled();
  });

  it('does not queue an action while closed', () => {
    const hook = renderHook();
    const action = vi.fn();
    hook.setOpen(false);
    hook.controller.dismissThenRun(action);
    hook.controller.onDismissed();
    expect(action).not.toHaveBeenCalled();
    expect(hook.onOpenChange).not.toHaveBeenCalled();
    hook.unmount();
  });
});
