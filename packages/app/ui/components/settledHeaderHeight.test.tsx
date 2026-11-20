import React, { useLayoutEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

import {
  HEADER_REPORT_WAIT_MS,
  resetReportedHeaderHeights,
  useSettledHeaderHeight,
} from './settledHeaderHeight';

setupReactTestEnvironment();

// iOS 26 on an iPhone 17: the navigator guesses 100.67, the header is 116.
const GUESS = 100.67;
const REAL = 116;

function renderScreen(reported: number, guess = GUESS) {
  let height = 0;
  let props = { reported, guess };
  function Probe() {
    const value = useSettledHeaderHeight(props.reported, props.guess);
    useLayoutEffect(() => {
      height = value;
    });
    return null;
  }
  let tree: ReturnType<typeof create>;
  act(() => {
    tree = create(<Probe />);
  });
  return {
    get height() {
      return height;
    },
    report(next: number, nextGuess = props.guess) {
      props = { reported: next, guess: nextGuess };
      act(() => tree.update(<Probe />));
    },
    unmount() {
      act(() => tree.unmount());
    },
  };
}

describe('useSettledHeaderHeight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetReportedHeaderHeights();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the reported height once the header reports', () => {
    const screen = renderScreen(GUESS);
    screen.report(REAL);
    expect(screen.height).toBe(REAL);
  });

  it('starts a later screen at the height an earlier header reported', () => {
    const first = renderScreen(GUESS);
    first.report(REAL);
    const second = renderScreen(GUESS);
    expect(second.height).toBe(REAL);
  });

  it('moves a screen still on the guess to a height reported after its wait', () => {
    // A chat restored beneath a thread: it never shows its header, waits out
    // the guess, and the thread's header reports afterwards.
    const hidden = renderScreen(GUESS);
    act(() => {
      vi.advanceTimersByTime(HEADER_REPORT_WAIT_MS + 1);
    });
    expect(hidden.height).toBeCloseTo(GUESS);
    const thread = renderScreen(GUESS);
    thread.report(REAL);
    expect(hidden.height).toBe(REAL);
  });

  it('takes the guess as real when no header ever says otherwise', () => {
    const screen = renderScreen(GUESS);
    act(() => {
      vi.advanceTimersByTime(HEADER_REPORT_WAIT_MS + 1);
    });
    expect(screen.height).toBeCloseTo(GUESS);
  });

  it('keeps each screen geometry separate', () => {
    const portrait = renderScreen(GUESS);
    portrait.report(REAL);
    // Landscape: a different guess, and a header that matches it.
    const landscape = renderScreen(68, 68);
    act(() => {
      vi.advanceTimersByTime(HEADER_REPORT_WAIT_MS + 1);
    });
    expect(landscape.height).toBe(68);
  });

  it('gives a screen without a header the last reported height', () => {
    const first = renderScreen(GUESS);
    first.report(REAL);
    const botChat = renderScreen(0);
    expect(botChat.height).toBe(REAL);
  });
});
