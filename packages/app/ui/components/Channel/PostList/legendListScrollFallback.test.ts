import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const packageDirectory = path.dirname(
  require.resolve('@legendapp/list/react-native')
);

afterEach(() => {
  vi.useRealTimers();
});

describe.each(['react-native.js', 'react-native.mjs'])(
  'LegendList scroll completion (%s)',
  (bundle) => {
    // The published package does not export its scroll-completion helpers.
    // Execute that section of the installed bundle so these tests cover the
    // pnpm patch, without loading React Native's renderer in Node.
    const source = readFileSync(path.join(packageDirectory, bundle), 'utf8');
    const start = source.indexOf('// src/core/checkFinishedScroll.ts');
    const end = source.indexOf('// src/core/doScrollTo.native.ts', start);
    if (start < 0 || end < 0) {
      throw new Error(
        'LegendList scroll helpers moved; update the patch tests'
      );
    }

    function setup({
      animated = true,
      platform = 'ios',
      isInitialScroll = false,
    } = {}) {
      vi.useFakeTimers();
      const scrollTo = vi.fn();
      const finishScrollTo = vi.fn();
      const state = {
        scrollingTo: {
          animated,
          isInitialScroll,
          index: 1,
          viewPosition: 1,
          offset: 360,
          targetOffset: 360,
        },
        props: { data: ['older message', 'sent message'], horizontal: false },
        didContainersLayout: true,
        didFinishInitialScroll: !isInitialScroll,
        hasScrolled: true,
        scroll: 305,
        scrollPending: 305,
        endOffset: 360,
        scrollLength: 744,
        scrollAdjustHandler: { getAdjust: () => 0 },
        refScroller: { current: { scrollTo } },
      };
      const context = {
        Platform: { OS: platform },
        setTimeout,
        requestAnimationFrame: (callback: () => void) =>
          setTimeout(callback, 16),
        finishScrollTo,
        clampScrollOffset: (_ctx: unknown, offset: number) =>
          Math.min(state.endOffset, Math.max(0, offset)),
        calculateOffsetForIndex: () => state.endOffset,
        calculateOffsetWithOffsetPosition: (_ctx: unknown, offset: number) =>
          offset,
        getContentSize: () => 1104,
        initialScrollWatchdog: {
          get: () => undefined,
          hasNonZeroTargetOffset: (offset?: number) => (offset ?? 0) > 1,
          isAtZeroTargetOffset: (offset: number) => Math.abs(offset) <= 1,
        },
        initialScrollCompletion: { didDispatchNativeScroll: () => false },
      };
      const check = runInNewContext(
        `${source.slice(start, end)}\ncheckFinishedScrollFallback`,
        context
      ) as (ctx: { state: typeof state }) => void;
      check({ state });
      return { scrollTo, finishScrollTo, state };
    }

    it.each(['ios', 'android'])(
      'does not interrupt an animated end scroll on %s at the 100ms check',
      (platform) => {
        const { scrollTo, state, finishScrollTo } = setup({ platform });
        state.scroll = state.scrollPending = 320;
        vi.advanceTimersByTime(100);
        expect(scrollTo).not.toHaveBeenCalled();
        if (platform === 'ios') {
          expect(finishScrollTo).not.toHaveBeenCalled();
          state.scroll = state.scrollPending = 360;
          vi.advanceTimersByTime(100);
          expect(finishScrollTo).toHaveBeenCalledOnce();
        }
      }
    );

    it('retargets a settled animation smoothly when the final row grows', () => {
      const { scrollTo, state, finishScrollTo } = setup();
      state.endOffset = 420;
      state.scroll = state.scrollPending = 350;
      vi.advanceTimersByTime(100);
      state.scroll = state.scrollPending = 360;
      vi.advanceTimersByTime(100);
      expect(scrollTo).not.toHaveBeenCalled();
      expect(finishScrollTo).not.toHaveBeenCalled();

      // Native reached the originally requested offset, but the row is taller.
      vi.advanceTimersByTime(100);
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({
        animated: true,
        x: 0,
        y: 420,
      });
      state.scroll = state.scrollPending = 400;
      vi.advanceTimersByTime(100);
      expect(scrollTo).toHaveBeenCalledTimes(1);
      state.scroll = state.scrollPending = 420;
      vi.advanceTimersByTime(100);
      expect(finishScrollTo).toHaveBeenCalledOnce();
    });

    it('bounds recovery when native scrolling never reaches the end', () => {
      const { scrollTo, finishScrollTo } = setup();
      vi.advanceTimersByTime(600);
      expect(scrollTo).toHaveBeenCalledTimes(5);
      expect(scrollTo.mock.calls.every(([options]) => options.animated)).toBe(
        true
      );
      expect(finishScrollTo).toHaveBeenCalledOnce();
    });

    it('lets a recovery at the final retry finish before releasing ownership', () => {
      const { scrollTo, state, finishScrollTo } = setup();
      state.endOffset = 420;
      for (const offset of [320, 340, 355, 360]) {
        state.scroll = state.scrollPending = offset;
        vi.advanceTimersByTime(100);
      }
      vi.advanceTimersByTime(100);
      expect(scrollTo).toHaveBeenCalledWith({ animated: true, x: 0, y: 420 });
      for (const offset of [380, 410]) {
        state.scroll = state.scrollPending = offset;
        vi.advanceTimersByTime(100);
        expect(finishScrollTo).not.toHaveBeenCalled();
        expect(scrollTo).toHaveBeenCalledTimes(1);
      }
      state.scroll = state.scrollPending = 420;
      vi.advanceTimersByTime(100);
      expect(finishScrollTo).toHaveBeenCalledOnce();
    });

    it('still corrects an unaligned non-animated iOS end scroll', () => {
      const { scrollTo, state, finishScrollTo } = setup({ animated: false });
      vi.advanceTimersByTime(100);
      expect(scrollTo).toHaveBeenCalledWith({ animated: false, x: 0, y: 360 });
      state.scroll = state.scrollPending = 360;
      vi.advanceTimersByTime(100);
      expect(finishScrollTo).toHaveBeenCalledOnce();
    });

    it('preserves initial non-animated scroll recovery', () => {
      const { scrollTo } = setup({ animated: false, isInitialScroll: true });
      vi.advanceTimersByTime(500);
      expect(scrollTo).toHaveBeenCalledWith({ animated: false, x: 0, y: 360 });
    });

    it('does not retry an end scroll that already reached its target', () => {
      const { scrollTo, state, finishScrollTo } = setup({ animated: false });
      state.scroll = state.scrollPending = 360;
      vi.advanceTimersByTime(100);
      expect(scrollTo).not.toHaveBeenCalled();
      expect(finishScrollTo).toHaveBeenCalledOnce();
    });
  }
);
