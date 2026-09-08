import React, { useLayoutEffect } from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LifecyclePermit, useLifecyclePermit } from './useLifecyclePermit';

const never = new Promise<void>(() => {});

describe('committed lifecycle authority', () => {
  let renderer: ReactTestRenderer | undefined;
  let current: LifecyclePermit;
  let commits: LifecyclePermit[];
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    commits = [];
    renderer = undefined;
  });
  afterEach(() => {
    if (renderer) act(() => renderer!.unmount());
    vi.unstubAllGlobals();
  });
  function Subject({
    scope,
    enabled = true,
    suspend = false,
  }: {
    scope: string;
    enabled?: boolean;
    suspend?: boolean;
  }) {
    const permit = useLifecyclePermit([scope], enabled);
    useLayoutEffect(() => {
      current = permit;
      commits.push(permit);
    }, [permit]);
    if (suspend) throw never;
    return null;
  }
  function render(scope: string, enabled = true) {
    act(() => {
      const element = <Subject scope={scope} enabled={enabled} />;
      if (renderer) renderer.update(element);
      else renderer = create(element);
    });
  }
  it('preserves current authority through an unrelated render', () => {
    render('A');
    const original = current;
    const validate = original.capture();
    render('A');
    expect(current).toBe(original);
    expect(validate()).toBe(true);
  });
  it('permanently retires callbacks and captured work across A to B to A', () => {
    render('A');
    const original = current;
    const validate = original.capture();
    render('B');
    render('A');
    expect(original.isCurrent()).toBe(false);
    expect(validate()).toBe(false);
    expect(original.capture()()).toBe(false);
    expect(current.capture()()).toBe(true);
  });
  it('eligibility restoration cannot revive a previously captured permit', () => {
    render('A');
    const original = current;
    const validate = original.capture();
    render('A', false);
    expect(current.isCurrent()).toBe(false);
    render('A');
    expect(validate()).toBe(false);
    expect(original.isCurrent()).toBe(false);
    expect(current.isCurrent()).toBe(true);
  });
  it('revokes a dequeued completion on disposal', () => {
    render('A');
    const validate = current.capture();
    act(() => renderer!.unmount());
    renderer = undefined;
    expect(validate()).toBe(false);
    expect(current.capture()()).toBe(false);
  });
  it('a suspended uncommitted replacement does not revoke the visible visit', async () => {
    render('A');
    const validate = current.capture();
    await act(async () => {
      React.startTransition(() =>
        renderer!.update(<Subject scope="B" suspend />)
      );
    });
    expect(commits).toHaveLength(1);
    expect(validate()).toBe(true);
  });
  it('Strict Mode effect replay retires work captured by the first activation', () => {
    const captured: Array<() => boolean> = [];
    function Capture() {
      const permit = useLifecyclePermit(['A']);
      useLayoutEffect(() => {
        captured.push(permit.capture());
      }, [permit]);
      return null;
    }
    act(() => {
      renderer = create(
        <React.StrictMode>
          <Capture />
        </React.StrictMode>
      );
    });
    expect(captured).toHaveLength(2);
    expect(captured[0]()).toBe(false);
    expect(captured[1]()).toBe(true);
  });
  it.each([false, true])(
    'child layout capture waits for its own parent activation (Strict Mode %s)',
    (strict) => {
      const captured: Array<() => boolean> = [];
      const immediate: boolean[] = [];
      function Child({ permit }: { permit: LifecyclePermit }) {
        useLayoutEffect(() => {
          const validate = permit.capture();
          captured.push(validate);
          immediate.push(validate());
        }, [permit]);
        return null;
      }
      function Parent() {
        return <Child permit={useLifecyclePermit(['A'])} />;
      }
      act(() => {
        renderer = create(
          strict ? (
            <React.StrictMode>
              <Parent />
            </React.StrictMode>
          ) : (
            <Parent />
          )
        );
      });
      expect(immediate.every((value) => !value)).toBe(true);
      expect(captured.at(-1)!()).toBe(true);
      if (strict) expect(captured[0]()).toBe(false);
    }
  );
});
