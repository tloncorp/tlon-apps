import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const timing = vi.hoisted(() => vi.fn((height: number) => height));
vi.mock('react-native', () => ({
  View: 'measured-content',
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock('react-native-reanimated', async () => {
  const { useRef } = await import('react');
  return {
    default: { View: 'animated-frame' },
    Easing: { out: (value: unknown) => value, cubic: 'cubic' },
    ReduceMotion: { System: 'system' },
    runOnJS: (callback: () => void) => callback,
    useSharedValue: (value: number) => useRef({ value }).current,
    useAnimatedStyle: (style: () => unknown) => style(),
    withTiming: timing,
  };
});

import { AnimatedInputHeight } from './AnimatedInputHeight.native';

let renderer: ReactTestRenderer;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  timing.mockClear();
  act(() => {
    renderer = create(
      <AnimatedInputHeight minimumHeight={44}>
        <input />
      </AnimatedInputHeight>
    );
  });
});
afterEach(() => {
  act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

function measure(height: number) {
  act(() => {
    renderer.root.findByType('measured-content' as never).props.onLayout({
      nativeEvent: { layout: { height } },
    });
  });
}

function hold(holdHeight: boolean) {
  act(() => {
    renderer.update(
      <AnimatedInputHeight minimumHeight={44} holdHeight={holdHeight}>
        <input />
      </AnimatedInputHeight>
    );
  });
}

describe('composer height during local enqueue', () => {
  it('keeps a cleared multiline draft tall until enqueue without remounting input', () => {
    measure(120);
    const input = renderer.root.findByType('input');
    timing.mockClear();
    hold(true);
    measure(44);
    expect(timing).not.toHaveBeenCalled();
    hold(false);
    expect(timing).toHaveBeenCalledOnce();
    expect(timing.mock.calls[0][0]).toBe(44);
    expect(renderer.root.findByType('input')).toBe(input);
  });

  it('uses the latest measurement if a new draft is typed before enqueue', () => {
    measure(120);
    hold(true);
    measure(44);
    measure(80);
    timing.mockClear();
    hold(false);
    expect(timing.mock.calls[0][0]).toBe(80);
    measure(80);
    expect(timing).toHaveBeenCalledOnce();
  });

  it('continues animating ordinary growth and deletion after enqueue', () => {
    measure(120);
    hold(true);
    measure(44);
    hold(false);
    timing.mockClear();
    measure(90);
    measure(44);
    expect(timing.mock.calls.map(([height]) => height)).toEqual([90, 44]);
  });

  it('allows a new draft to grow during a slow enqueue', () => {
    hold(true);
    measure(120);
    expect(timing.mock.calls[0][0]).toBe(120);
    timing.mockClear();
    measure(80);
    expect(timing).not.toHaveBeenCalled();
    hold(false);
    expect(timing.mock.calls[0][0]).toBe(80);
  });
});
