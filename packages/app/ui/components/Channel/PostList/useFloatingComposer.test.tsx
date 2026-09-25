import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import {
  getFloatingComposerMode,
  useFloatingComposer,
} from './useFloatingComposer';

const state = vi.hoisted(() => ({
  floating: false,
  sending: false,
  distance: 0,
  navigating: true,
  hasNewerPosts: false,
}));
vi.mock('../ConversationLayout', async () => {
  const { useState } = await import('react');
  return {
    useConversationComposerLayout: () => {
      const [floating, setFloating] = useState(false);
      state.floating = floating;
      return { floating, setFloating };
    },
  };
});
const listRef = {
  current: {
    getState: () => ({
      contentLength: 1200,
      scrollLength: 500,
      scroll: 700 - state.distance,
    }),
  },
};
const isSending = () => state.sending;
const isBrowsingHistory = () => state.navigating;
let onScroll: ReturnType<typeof useFloatingComposer>;
let renderer: ReactTestRenderer;
let frames: Map<number, FrameRequestCallback>;
function tick() {
  const callbacks = [...frames.values()];
  frames.clear();
  act(() => callbacks.forEach((callback) => callback(0)));
}
function Harness() {
  onScroll = useFloatingComposer(
    listRef as never,
    true,
    true,
    isSending,
    isBrowsingHistory,
    state.hasNewerPosts
  );
  return null;
}
function scroll(offset: number, contentHeight = 1200, viewportHeight = 500) {
  act(() => onScroll({ offset, contentHeight, viewportHeight }));
}
beforeEach(() => {
  state.floating = false;
  state.sending = false;
  state.distance = 0;
  state.navigating = true;
  state.hasNewerPosts = false;
  frames = new Map();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(() => {
  act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});
function mount() {
  act(() => {
    renderer = create(<Harness />);
  });
}

it('floats away from the end and stays floating until the actual bottom', () => {
  mount();
  scroll(700);
  scroll(675);
  expect(state.floating).toBe(true);
  // Expanding the viewport and adding the same footer preserves the range.
  scroll(675, 1290, 590);
  scroll(685, 1290, 590);
  expect(state.floating).toBe(true);
  scroll(700, 1290, 590);
  expect(state.floating).toBe(false);
  scroll(700);
  expect(state.floating).toBe(false);
});

it('ignores the intermediate resize before the footer is measured', () => {
  mount();
  scroll(700);
  scroll(670);
  expect(state.floating).toBe(true);
  scroll(670, 1200, 590); // viewport expanded, footer not yet reported
  expect(state.floating).toBe(true);
  scroll(670, 1290, 590);
  expect(state.floating).toBe(true);
  scroll(700, 1290, 590);
  expect(state.floating).toBe(false);
});

it('keeps the composer docked during programmatic scrolling after send contraction', () => {
  mount();
  scroll(700);
  state.navigating = false;
  scroll(700, 1250, 550);
  scroll(630, 1250, 550);
  expect(state.floating).toBe(false);
  scroll(700, 1250, 550);
  expect(state.floating).toBe(false);
});

it('does not interpret composer contraction or keyboard resizing as a history scroll', () => {
  mount();
  scroll(700);
  scroll(700, 1200, 300);
  expect(state.floating).toBe(false);
  scroll(900, 1200, 300);
  expect(state.floating).toBe(false);
  state.sending = true;
  scroll(700, 1400, 300);
  scroll(700, 1400, 300);
  expect(state.floating).toBe(false);
});

it('starts floating when a selected history message is the initial anchor', () => {
  state.distance = 400;
  mount();
  expect(state.floating).toBe(true);
});

it('handles short content, bottom bounce, and a dead zone without mode chatter', () => {
  expect(getFloatingComposerMode(-80, false)).toBe(false);
  expect(getFloatingComposerMode(-80, true)).toBe(false);
  expect(getFloatingComposerMode(10, false)).toBe(false);
  expect(getFloatingComposerMode(10, true)).toBe(true);
  expect(getFloatingComposerMode(2, true)).toBe(false);
});

it('docks after a keyboard resize reaches the end without another scroll event', () => {
  state.distance = 50;
  mount();
  scroll(650);
  expect(state.floating).toBe(true);
  // Native clamps to the end as the keyboard closes; geometry then settles.
  scroll(500, 1200, 700);
  state.distance = 0;
  tick();
  tick();
  expect(state.floating).toBe(false);
});

it('stays floating at the loaded history boundary until newer messages are loaded', () => {
  state.hasNewerPosts = true;
  mount();
  scroll(700);
  scroll(650, 1200, 550);
  tick();
  tick();
  expect(state.floating).toBe(true);
  state.hasNewerPosts = false;
  act(() => renderer.update(<Harness />));
  expect(state.floating).toBe(false);
});

it('keeps its exit threshold when the final newer page arrives', () => {
  state.hasNewerPosts = true;
  state.distance = 10;
  mount();
  state.hasNewerPosts = false;
  act(() => renderer.update(<Harness />));
  expect(state.floating).toBe(true);
  scroll(700);
  expect(state.floating).toBe(false);
});
