import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { ScrollContext, useScrollDirectionTracker } from './scroll';

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Dimensions: { get: () => ({ height: 874 }) },
}));
vi.mock('react-native-reanimated', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    useSharedValue: (value: number) => React.useMemo(() => ({ value }), []),
    useAnimatedScrollHandler: (callback: unknown) => callback,
    runOnJS: (callback: unknown) => callback,
    clamp: (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value)),
  };
});

let renderer: ReactTestRenderer | undefined;
let tracker: ReturnType<typeof useScrollDirectionTracker>;
let headerProgress: { value: number };
let published: boolean[];

function Probe({ threshold = 1 }: { threshold?: number }) {
  tracker = useScrollDirectionTracker({
    bottomAtEnd: true,
    atBottomThreshold: threshold,
    setIsAtBottom: (value) => published.push(value),
  });
  return null;
}

function emit(gap: number) {
  // This is the exact r2 append-end native geometry. Only the offset changes
  // for the preceding history event and other boundary cases.
  const extent = 11060.3330078125;
  const viewport = 671;
  const inset = 98;
  act(() => {
    (tracker.onScroll as unknown as (event: unknown) => void)({
      contentOffset: { y: extent - viewport + inset - gap },
      contentSize: { height: extent },
      layoutMeasurement: { height: viewport },
      contentInset: { bottom: inset },
    });
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  headerProgress = { value: 0 };
  published = [];
  act(() => {
    renderer = create(
      <ScrollContext.Provider value={[headerProgress as any, () => {}]}>
        <Probe />
      </ScrollContext.Provider>
    );
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
});

it.each([
  ['recorded fractional end', 11060.3330078125 - 671 + 98 - 10487.333333333334],
  ['one point beyond the end', -1],
  ['UIKit bounce beyond the end', -48],
] as const)(
  'clears stale Latest state at %s without animating a bounce delta',
  (_, gap) => {
    emit(1500);
    expect(tracker.isAtBottom).toBe(false);
    const headerBefore = headerProgress.value;
    emit(gap);
    expect(tracker.isAtBottom).toBe(true);
    expect(headerProgress.value).toBe(headerBefore);
    const transitions = published.slice();
    emit(gap);
    expect(published).toEqual(transitions);
    emit(1500);
    expect(tracker.isAtBottom).toBe(false);
  }
);

it('retains the existing viewport threshold and accounts for the bottom inset', () => {
  emit(875);
  expect(tracker.isAtBottom).toBe(false);
  emit(873);
  expect(tracker.isAtBottom).toBe(true);
  emit(875);
  expect(tracker.isAtBottom).toBe(false);
  emit(0);
  expect(tracker.isAtBottom).toBe(true);
});

it('does not show Latest during a sequence of end bounce and legal-end events', () => {
  emit(0);
  for (const gap of [-0.001, -10, -48, -10, 0, -0.001, 0]) emit(gap);
  expect(tracker.isAtBottom).toBe(true);
  expect(published).toEqual([true]);
});
