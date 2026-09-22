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
let onScroll: ReturnType<typeof useFloatingComposer>;
let renderer: ReactTestRenderer;
function Harness() {
  onScroll = useFloatingComposer(listRef as never, true, true, isSending);
  return null;
}
function scroll(offset: number, contentHeight = 1200, viewportHeight = 500) {
  act(() => onScroll({ offset, contentHeight, viewportHeight }));
}
beforeEach(() => {
  state.floating = false;
  state.sending = false;
  state.distance = 0;
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
  scroll(670);
  expect(state.floating).toBe(true);
  scroll(670, 1200, 590); // viewport expanded, footer not yet reported
  expect(state.floating).toBe(true);
  scroll(670, 1290, 590);
  expect(state.floating).toBe(true);
  scroll(700, 1290, 590);
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
