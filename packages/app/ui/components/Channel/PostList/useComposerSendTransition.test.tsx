import type { LegendListRef } from '@legendapp/list/react-native';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useComposerSendTransition } from './useComposerSendTransition';

let renderer: ReactTestRenderer;
let transition: ReturnType<typeof useComposerSendTransition>;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let nearEnd: boolean;
const applyHeight = vi.fn();
const scrollToEnd = vi.fn(async () => {});
const listRef = {
  current: {
    getState: () => ({ isNearEnd: nearEnd }),
    scrollToEnd,
  } as unknown as LegendListRef,
};

function Test({ animated = true }: { animated?: boolean }) {
  transition = useComposerSendTransition(listRef, applyHeight, true, animated);
  return null;
}

beforeEach(() => {
  nearEnd = true;
  frames = new Map();
  nextFrame = 0;
  applyHeight.mockClear();
  scrollToEnd.mockClear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  act(() => {
    renderer = create(<Test />);
  });
});
afterEach(() => {
  act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

function tick() {
  const current = [...frames.values()];
  frames.clear();
  act(() => current.forEach((callback) => callback(0)));
}

describe('composer send scroll coordination', () => {
  it('holds intermediate insets and commits the final inset before one scroll', () => {
    transition.reportHeight(180);
    act(() => transition.begin());
    transition.reportHeight(140);
    transition.reportHeight(90);
    expect(applyHeight.mock.calls).toEqual([[180]]);
    expect(transition.active).toBe(true);
    transition.finish();
    transition.finish();
    tick();
    expect(applyHeight.mock.calls).toEqual([[180], [90]]);
    expect(scrollToEnd).not.toHaveBeenCalled();
    expect(transition.active).toBe(true);
    tick();
    expect(scrollToEnd).toHaveBeenCalledOnce();
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: true });
    expect(transition.active).toBe(false);
    transition.reportHeight(120);
    expect(applyHeight).toHaveBeenLastCalledWith(120);
  });

  it('does not start a send transition while reading history', () => {
    nearEnd = false;
    act(() => transition.begin());
    transition.reportHeight(90);
    transition.finish();
    expect(transition.active).toBe(false);
    expect(applyHeight).toHaveBeenCalledWith(90);
    expect(frames.size).toBe(0);
    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  it('preserves a user scroll made during the transition', () => {
    act(() => transition.begin());
    transition.reportHeight(90);
    transition.cancelFollowing();
    transition.finish();
    tick();
    tick();
    expect(applyHeight).toHaveBeenCalledWith(90);
    expect(scrollToEnd).not.toHaveBeenCalled();
    expect(transition.active).toBe(false);
  });

  it('cancels an earlier finish when another send begins', () => {
    act(() => transition.begin());
    transition.reportHeight(90);
    transition.finish();
    act(() => transition.begin());
    tick();
    expect(applyHeight).not.toHaveBeenCalled();
    expect(transition.active).toBe(true);
    transition.reportHeight(110);
    transition.finish();
    tick();
    tick();
    expect(applyHeight).toHaveBeenCalledOnce();
    expect(applyHeight).toHaveBeenCalledWith(110);
    expect(scrollToEnd).toHaveBeenCalledOnce();
  });

  it('respects Reduce Motion and cancels pending work on unmount', () => {
    act(() => renderer.update(<Test animated={false} />));
    act(() => transition.begin());
    transition.finish();
    tick();
    tick();
    expect(scrollToEnd).toHaveBeenCalledOnce();
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
    act(() => transition.begin());
    transition.finish();
    act(() => renderer.unmount());
    expect(frames.size).toBe(0);
  });

  it('publishes a late measurement between the inset and scroll frames', () => {
    act(() => transition.begin());
    expect(transition.isActive()).toBe(true);
    transition.reportHeight(90);
    transition.finish();
    tick();
    transition.reportHeight(110);
    expect(applyHeight).toHaveBeenLastCalledWith(110);
    tick();
    expect(transition.isActive()).toBe(false);
    expect(applyHeight).toHaveBeenLastCalledWith(110);
    expect(scrollToEnd).toHaveBeenCalledOnce();
  });
});
