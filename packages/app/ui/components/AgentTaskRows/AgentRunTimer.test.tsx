import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  AgentRunTimer,
  formatAgentRunElapsedTime,
  resolveAgentRunTimerStartedAt,
} from './AgentRunTimer';

vi.mock('tamagui', () => ({
  SizableText: 'SizableText',
}));

describe('AgentRunTimer', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats elapsed run time compactly', () => {
    expect(formatAgentRunElapsedTime(-1)).toBe('0:00');
    expect(formatAgentRunElapsedTime(65_999)).toBe('1:05');
    expect(formatAgentRunElapsedTime(3_599_999)).toBe('59:59');
    expect(formatAgentRunElapsedTime(3_600_000)).toBe('1:00:00');
    expect(formatAgentRunElapsedTime(3_661_000)).toBe('1:01:01');
  });

  it('waits for dispatch on current records and supports legacy records', () => {
    expect(resolveAgentRunTimerStartedAt(null, 1_000)).toBeNull();
    expect(resolveAgentRunTimerStartedAt(2_000, 1_000)).toBe(2_000);
    expect(resolveAgentRunTimerStartedAt(undefined, 1_000)).toBe(1_000);
  });

  it('ticks once per second and clears its timer on unmount', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(<AgentRunTimer startedAt={10_000} />);
    });
    expect(
      renderer!.root.findByProps({ testID: 'agent-run-elapsed-time' }).children
    ).toEqual(['0:00']);

    await act(async () => {
      vi.advanceTimersByTime(65_000);
    });
    expect(
      renderer!.root.findByProps({ testID: 'agent-run-elapsed-time' }).children
    ).toEqual(['1:05']);

    act(() => renderer!.unmount());
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reserves a stable zeroed clock before dispatch without scheduling ticks', async () => {
    vi.useFakeTimers();
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(<AgentRunTimer startedAt={null} />);
    });
    expect(
      renderer!.root.findByProps({ testID: 'agent-run-elapsed-time' }).children
    ).toEqual(['0:00']);
    expect(vi.getTimerCount()).toBe(0);

    act(() => renderer!.unmount());
  });

  it('does not rerender sibling run content when the clock advances', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    let siblingRenders = 0;
    const Sibling = () => {
      siblingRenders += 1;
      return React.createElement('Sibling');
    };
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        <>
          <Sibling />
          <AgentRunTimer startedAt={10_000} />
        </>
      );
    });
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });

    expect(siblingRenders).toBe(1);
    act(() => renderer!.unmount());
  });
});
