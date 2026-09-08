/**
 * Node22+: node scripts/test-legend-indexed-completion.mjs [--source-dir DIR] [--report FILE].
 * Default: both installed native bundles, resolved from the invocation cwd.
 * Actual dependency bodies run with modeled native delivery and manual scheduling.
 * This suite does not establish native rendering, presentation, or zero-jank proof.
 */
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {
  extractDeclarations,
  extractReprocessAssignment,
  runInstalledControls,
  sha256,
} from './lib/legend-source-controls.mjs';
await runInstalledControls('legend-indexed-completion', async (source) => {
  const { bodies: coreBodies, names: coreNames } = extractDeclarations(source, {
    functions: [
      'scrollTo',
      'doScrollTo',
      'getAverageSizeSnapshot',
      'syncInitialScrollNativeWatchdog',
      'getId',
      'calculateOffsetWithOffsetPosition',
      'clampScrollOffset',
      'prepareMVCP',
      'resolveAnchorLock',
      'updateAnchorLock',
      'shouldQueueNativeMVCPAdjust',
      'getPredictedNativeClamp',
      'getProgressTowardAmount',
      'settlePendingNativeMVCPAdjust',
      'maybeApplyPredictedNativeMVCPAdjust',
      'resolvePendingNativeMVCPAdjust',
      'requestAdjust',
      'updateScroll',
      'isInMVCPActiveMode',
      'hasScrollCompletionOwnership',
      'isEndAlignedLastItemTarget',
      'getCurrentTargetOffset',
      'getResolvedScrollCompletionState',
      'checkFinishedScroll',
      'checkFinishedScrollFrame',
      'checkFinishedScrollFallback',
      'isSilentInitialDispatch',
      'getInitialScrollWatchdogTargetOffset',
      'isNativeInitialNonZeroTarget',
      'shouldFinishInitialScrollWithoutNativeProgress',
      'shouldFinishInitialZeroTargetScroll',
      'scrollToFallbackOffset',
      'finishScrollTo',
      'recalculateSettledScroll',
      'createImperativeHandle',
      'scrollToEnd',
      'scrollToIndex',
      'clampScrollIndex',
      'getItemSizeAtIndex',
      'onScroll',
      'trackInitialScrollNativeProgress',
      'shouldDeferPublicOnScroll',
      'cloneScrollEvent',
    ],
    optionalFunctions: [
      'routesNativeReadAdjustment',
      'captureNativeReadPreparation',
      'ownsNativeReadPreparation',
      'acknowledgeNativeReadAdjustment',

      'isObservedIOSIndexedScroll',
      'ownsScrollCompletion',
      'takePendingScrollSettlement',
      'failIndexedScrollTo',
      'createIndexedScrollFailure',
    ],
    variables: ['ScrollAdjustHandler'],
  });
  const keyed = extractDeclarations(source, {
    functions: [],
    optionalFunctions: [
      'findKeyedScrollItemIndex',
      'refreshKeyedScrollTarget',
      'createKeyedScrollFailure',
    ],
  });
  const dynamic = extractDeclarations(source, {
    functions: [],
    optionalFunctions: ['readKeyedViewOffset', 'resolveKeyedViewOffset'],
  });
  const bodies = coreBodies + '\n\n' + keyed.bodies + '\n\n' + dynamic.bodies;
  const names = [...coreNames, ...keyed.names, ...dynamic.names];
  const assignment = extractReprocessAssignment(source);
  function rig(os = 'ios') {
    let now = 0,
      nextId = 0;
    const raf = new Map(),
      timers = new Map(),
      nativeCalls = [],
      calculations = [],
      signals = [];
    let resolved = 0;
    const rejected = [];
    let nativeThrows = false,
      scheduleThrows = false;
    const keys = Array.from(
      {
        length: 90,
      },
      (_, i) => `scroll-fixture-${i + 30}`
    );
    const state = {
      props: {
        data: keys.map((id) => ({
          id,
        })),
        keyExtractor: (x) => x.id,
        maintainVisibleContentPosition: {
          data: true,
          size: true,
        },
        horizontal: false,
        maintainScrollAtEnd: false,
      },
      positions: keys.map((_, i) => i * 120),
      idCache: keys,
      indexByKey: new Map(keys.map((key, i) => [key, i])),
      idsInView: [keys[80], keys[81]],
      sizes: new Map(keys.map((key) => [key, 129.625])),
      sizesKnown: new Map(keys.map((key) => [key, 129.625])),
      averageSizes: {},
      scroll: 10487.333333333334,
      scrollPending: 10487.333333333334,
      lastNativeScroll: 10487.333333333334,
      scrollLength: 671,
      totalSize: 11158.25,
      scrollHistory: [],
      hasScrolled: true,
      didContainersLayout: true,
      didFinishInitialScroll: true,
      scrollProcessingEnabled: true,
      refScroller: {
        current: {
          scrollTo: (args) => {
            if (nativeThrows) throw new Error('native-method-threw');
            nativeCalls.push({
              ...args,
            });
          },
        },
      },
      pendingScrollResolve: () => resolved++,
      pendingScrollReject: (error) =>
        rejected.push({
          message: error.message,
          code: error.code,
        }),
    };
    state.positions[81] = 9746;
    const values = new Map([
      ['readyToRender', true],
      ['footerSize', 0],
    ]);
    const ctx = {
      state,
      values,
    };
    state.triggerCalculateItemsInView = (params) =>
      calculations.push({
        scroll: state.scroll,
        pending: state.scrollPending,
        native: state.lastNativeScroll,
        params,
      });
    const env = {
      Platform: {
        OS: os,
      },
      PlatformAdjustBreaksScroll: os === 'android',
      IsNewArchitecture: true,
      Date: {
        now: () => now,
      },
      INITIAL_SCROLL_COMPLETION_TARGET_EPSILON: 1,
      INITIAL_SCROLL_ZERO_TARGET_EPSILON: 1,
      INITIAL_SCROLL_MAX_FALLBACK_CHECKS: 20,
      SILENT_INITIAL_SCROLL_RETRY_DELAY_MS: 16,
      SILENT_INITIAL_SCROLL_TARGET_EPSILON: 1,
      MVCP_POSITION_EPSILON: 0.1,
      MVCP_ANCHOR_LOCK_TTL_MS: 300,
      MVCP_ANCHOR_LOCK_QUIET_PASSES_TO_RELEASE: 2,
      NATIVE_END_CLAMP_EPSILON: 1,
      requestAnimationFrame: (fn) => {
        const id = ++nextId;
        raf.set(id, fn);
        return id;
      },
      cancelAnimationFrame: (id) => raf.delete(id),
      setTimeout: (fn, delay) => {
        const id = ++nextId;
        timers.set(id, {
          fn,
          due: now + delay,
        });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      peek$: (c, key) => c.values.get(key),
      set$: (c, key, value) => {
        c.values.set(key, value);
        signals.push([key, value]);
      },
      getContentSize: (c) => c.state.totalSize,
      getContentInsetEnd: () => state.testInset ?? 98,
      getTopOffsetAdjustment: () => state.testHeader ?? 0,
      getItemSize: (c, key) => c.state.sizesKnown.get(key),
      calculateOffsetForIndex: (c, index) => c.state.positions[index],
      pinScrollTargetRenderRange: (c, offset, index) => {
        c.state.scrollTargetPinnedRange = {
          offset,
          index,
        };
      },
      getScrollVelocity: () => 0,
      updateAdaptiveRender: () => {},
      checkThresholds: () => {},
      beginReachedEdgeUserScroll: () => undefined,
      flushSync: (fn) => fn(),
      scheduleFullDrawDistancePrewarm: () => {},
      doMaintainScrollAtEnd: () => {},
      toNativeHorizontalOffset: (_state, value) => value,
      toLogicalHorizontalOffset: (_state, value) => value,
      clearFinishedBootstrapInitialScrollTargetIfMovedAway: () => {},
      initialScrollCompletion: {
        didDispatchNativeScroll: () => false,
        resetFlags: () => {},
        markInitialScrollNativeDispatch: () => {},
      },
      initialScrollWatchdog: {
        get: () => undefined,
        hasNonZeroTargetOffset: (value) =>
          typeof value === 'number' && value > 1,
        isAtZeroTargetOffset: (value) =>
          typeof value === 'number' && Math.abs(value) <= 1,
        clear: () => {},
      },
      addTotalSize: () => {
        throw Error('unexpected total-size branch');
      },
      finishInitialScroll: (_ctx, options) => {
        state.initialScroll = undefined;
        state.didFinishInitialScroll = true;
        options?.onFinished?.();
      },
      areKnownOrFixedItemSizesAvailable: () => true,
    };
    env.ctx = ctx;
    env.internalState = state;
    vm.createContext(env);
    vm.runInContext(bodies, env);
    state.scrollAdjustHandler = new env.ScrollAdjustHandler(ctx);
    vm.runInContext(assignment, env);
    const snapshot = () => ({
      scroll: state.scroll,
      pending: state.scrollPending,
      native: state.lastNativeScroll,
      target: state.scrollingTo
        ? {
            ...state.scrollingTo,
          }
        : null,
      appliedAdjust: state.scrollAdjustHandler.appliedAdjust,
      resolved,
      nativeCalls: [...nativeCalls],
      rejected: [...rejected],
      revision: state.scrollCommandRevision ?? 0,
      nativeRevision: state.nativeScrollEventRevision ?? 0,
    });
    return {
      state,
      ctx,
      env,
      raf,
      timers,
      calculations,
      snapshot,
      command() {
        env.scrollTo(ctx, {
          index: 81,
          itemSize: 129.625,
          offset: 9746,
          viewPosition: 0.5,
          viewOffset: 0,
          animated: false,
        });
      },
      grow() {
        const apply = env.prepareMVCP(ctx, false);
        state.positions[81] += 502.125;
        state.totalSize += 502.125;
        apply();
      },
      native(value) {
        env.onScroll(ctx, {
          nativeEvent: {
            contentOffset: {
              x: 0,
              y: value,
            },
            contentSize: {
              width: 402,
              height: state.totalSize,
            },
          },
        });
      },
      handle() {
        return env.createImperativeHandle(ctx, () => {
          if (scheduleThrows) throw new Error('commit-scheduler-threw');
        });
      },
      failNative() {
        nativeThrows = true;
      },
      failScheduler() {
        scheduleThrows = true;
      },
      frame() {
        now += 16;
        const pending = [...raf.values()];
        raf.clear();
        for (const fn of pending) fn();
      },
      timer() {
        const ordered = [...timers].sort((a, b) => a[1].due - b[1].due);
        assert.ok(ordered.length);
        const [id, job] = ordered[0];
        timers.delete(id);
        now = job.due;
        job.fn();
      },
      observed: () => resolved,
    };
  }
  const results = [];
  function test(name, fn) {
    let evidence;
    try {
      evidence = fn();
      results.push({
        name,
        status: 'PASS',
        evidence,
      });
    } catch (error) {
      results.push({
        name,
        status: 'FAIL',
        error: error.message,
        evidence: error.evidence,
      });
    }
  }
  function accepted(condition, message, evidence) {
    if (!condition) {
      const error = new Error(message);
      error.evidence = evidence;
      throw error;
    }
  }
  test('positive: aligned native event completes unchanged ordinary center', () => {
    const r = rig();
    r.command();
    assert.equal(r.state.scrollPending, 9524.3125);
    r.native(9524.333333333334);
    r.frame();
    assert.equal(r.observed(), 1);
    assert.equal(r.state.scrollingTo, undefined);
    return r.snapshot();
  });
  test('positive: no change leaves current-center calculation equal to request', () => {
    const r = rig();
    r.command();
    const actual = r.env.getCurrentTargetOffset(r.ctx, r.state.scrollingTo);
    const independentlyRecomputed = r.env.calculateOffsetWithOffsetPosition(
      r.ctx,
      r.state.positions[81],
      r.state.scrollingTo
    );
    assert.equal(actual, independentlyRecomputed);
    return {
      actual,
      independentlyRecomputed,
    };
  });
  test('regression: requested offset without a native event must not complete after row measurement', () => {
    const r = rig();
    r.command();
    r.grow();
    const before = r.snapshot();
    assert.equal(before.scroll, 10026.4375);
    assert.equal(before.pending, 9524.3125);
    assert.equal(before.native, 10487.333333333334);
    r.frame();
    const after = r.snapshot();
    accepted(
      r.observed() === 0 && r.state.scrollingTo !== undefined,
      'command resolved from requested scrollPending without native acknowledgment',
      {
        before,
        after,
      }
    );
    return after;
  });
  test('regression: center completion target must follow current measured item position', () => {
    const r = rig();
    r.command();
    r.grow();
    const stored = r.env.getCurrentTargetOffset(r.ctx, r.state.scrollingTo);
    const currentCenter = r.env.calculateOffsetWithOffsetPosition(
      r.ctx,
      r.state.positions[81],
      r.state.scrollingTo
    );
    accepted(
      Math.abs(stored - currentCenter) <= 1,
      'ordinary index keeps stale targetOffset after measured position changed',
      {
        stored,
        currentCenter,
        difference: currentCenter - stored,
        state: r.snapshot(),
      }
    );
    return {
      stored,
      currentCenter,
    };
  });
  test('regression: old requested native offset must not certify changed center geometry', () => {
    const r = rig();
    r.command();
    r.grow();
    r.native(9524.333333333334);
    r.frame();
    accepted(
      r.observed() === 0,
      'old center event completes despite moved selected item',
      r.snapshot()
    );
    return r.snapshot();
  });
  test('regression: ordinary fallback cannot use historical hasScrolled as current landing', () => {
    const r = rig();
    r.command();
    r.state.scrollPending = r.state.lastNativeScroll;
    const before = r.snapshot();
    assert.equal(
      r.env.getResolvedScrollCompletionState(r.ctx, r.state.scrollingTo)
        .isAtResolvedTarget,
      false
    );
    r.timer();
    const after = r.snapshot();
    accepted(
      r.observed() === 0,
      '100ms fallback resolves unaligned ordinary target because prior hasScrolled is true',
      {
        before,
        after,
      }
    );
    return after;
  });
  const tick = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  async function asyncTest(name, fn) {
    try {
      const evidence = await fn();
      results.push({
        name,
        status: 'PASS',
        evidence,
      });
    } catch (error) {
      results.push({
        name,
        status: 'FAIL',
        error: error.message,
        evidence: error.evidence,
      });
    }
  }
  function outcome(promise) {
    const value = {
      resolved: 0,
      rejected: 0,
      code: null,
      message: null,
    };
    promise.then(
      () => value.resolved++,
      (error) => {
        value.rejected++;
        value.code = error.code ?? null;
        value.message = error.message;
      }
    );
    return value;
  }
  function currentTarget(r) {
    return r.env.calculateOffsetWithOffsetPosition(
      r.ctx,
      r.state.positions[r.state.scrollingTo.index],
      r.state.scrollingTo
    );
  }
  await asyncTest(
    'public matching native observation resolves after delayed size change',
    async () => {
      const r = rig();
      const h = r.handle();
      const o = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      r.grow();
      r.frame();
      await tick();
      assert.equal(o.resolved, 0);
      r.native(10026.4375);
      r.frame();
      await tick();
      assert.equal(o.resolved, 1);
      assert.equal(o.rejected, 0);
      return {
        o,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'bounded unaligned failure rejects public request then permits a new command',
    async () => {
      const r = rig();
      const h = r.handle();
      const o = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      for (let i = 0; i < 10 && o.rejected === 0 && r.timers.size; i++) {
        r.timer();
        await tick();
      }
      assert.equal(o.resolved, 0);
      assert.equal(o.rejected, 1);
      assert.equal(o.code, 'LEGEND_SCROLL_UNALIGNED');
      assert.equal(r.state.scrollingTo, undefined);
      assert.equal(r.state.pendingScrollResolve, undefined);
      assert.equal(r.state.pendingScrollReject, undefined);
      assert.equal(r.state.pendingScrollRequest, undefined);
      const next = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      r.native(9524.333333333334);
      r.frame();
      await tick();
      assert.equal(next.resolved, 1);
      return {
        o,
        next,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'finite fallback retries updated current center instead of old offset',
    async () => {
      const r = rig();
      const h = r.handle();
      const o = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      r.grow();
      r.frame();
      r.timer();
      assert.equal(r.snapshot().nativeCalls.at(-1).y, 10026.4375);
      r.native(10026.4375);
      r.frame();
      await tick();
      assert.equal(o.resolved, 1);
      return {
        o,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'missing current index position never dispatches NaN and fails explicitly',
    async () => {
      const r = rig();
      const h = r.handle();
      const o = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      r.state.positions[81] = undefined;
      for (let i = 0; i < 8 && r.timers.size; i++) {
        r.timer();
        await tick();
      }
      assert.equal(o.code, 'LEGEND_SCROLL_UNALIGNED');
      assert.equal(o.resolved, 0);
      assert.ok(r.snapshot().nativeCalls.every((x) => Number.isFinite(x.y)));
      return {
        o,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'already observed and logically aligned no-op can complete without another event',
    async () => {
      const r = rig();
      r.state.scroll =
        r.state.scrollPending =
        r.state.lastNativeScroll =
          9524.3125;
      const h = r.handle();
      const o = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      r.timer();
      await tick();
      assert.equal(o.resolved, 1);
      assert.equal(o.rejected, 0);
      return {
        o,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'unobserved coincident pending value is not an already aligned native no-op',
    async () => {
      const r = rig();
      r.state.scroll = r.state.scrollPending = 9524.3125;
      r.state.lastNativeScroll = undefined;
      const h = r.handle();
      const o = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      r.timer();
      await tick();
      assert.equal(o.resolved, 0);
      assert.equal(o.rejected, 0);
      r.native(9524.3125);
      r.frame();
      await tick();
      assert.equal(o.resolved, 1);
      return {
        o,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'current item height/header/inset and legal lower clamp all affect center completion',
    async () => {
      const r = rig();
      const h = r.handle();
      const o = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      r.state.sizesKnown.set(r.state.idCache[81], 200);
      r.state.testHeader = 10;
      r.state.testInset = 120;
      const target = 9746 + 10 - 0.5 * (671 - 120 - 200);
      assert.equal(
        r.env.getCurrentTargetOffset(r.ctx, r.state.scrollingTo),
        target
      );
      r.native(target);
      r.frame();
      await tick();
      assert.equal(o.resolved, 1);
      const z = rig();
      z.state.positions[0] = 0;
      const zh = z.handle();
      const zo = outcome(
        zh.scrollToIndex({
          index: 0,
          viewPosition: 0.5,
          animated: false,
        })
      );
      z.native(0);
      z.frame();
      await tick();
      assert.equal(zo.resolved, 1);
      return {
        o,
        zo,
        target,
      };
    }
  );
  await asyncTest(
    'observed end follows latest content extent and upper legal clamp',
    async () => {
      const r = rig();
      const h = r.handle();
      const o = outcome(
        h.scrollToEnd({
          animated: false,
        })
      );
      r.state.runPendingScrollToEnd();
      r.state.positions[89] = 14000;
      r.state.totalSize = 13000;
      const target = 13000 - 671;
      assert.equal(
        r.env.getCurrentTargetOffset(r.ctx, r.state.scrollingTo),
        target
      );
      r.native(target);
      r.frame();
      await tick();
      assert.equal(o.resolved, 1);
      return {
        o,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'old target finish cannot settle new latest queued for layout',
    async () => {
      const r = rig();
      const h = r.handle();
      const old = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      const next = outcome(
        h.scrollToEnd({
          animated: false,
        })
      );
      r.env.finishScrollTo(r.ctx);
      await tick();
      assert.equal(next.resolved, 0);
      assert.equal(next.rejected, 0);
      assert.ok(r.state.pendingScrollResolve);
      r.state.runPendingScrollToEnd();
      const target = r.env.getCurrentTargetOffset(r.ctx, r.state.scrollingTo);
      r.native(target);
      r.frame();
      await tick();
      assert.equal(next.resolved, 1);
      return {
        old,
        next,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'retained old completion RAF cannot clear newer dispatched target',
    async () => {
      const r = rig();
      const h = r.handle();
      const old = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      r.grow();
      const oldFrames = [...r.raf.values()];
      const next = outcome(
        h.scrollToIndex({
          index: 89,
          viewPosition: 1,
          animated: false,
        })
      );
      for (
        let i = 0;
        i < 4 && r.state.ignoreScrollFromMVCP && r.timers.size;
        i++
      )
        r.timer();
      r.frame();
      r.frame();
      const target = r.state.scrollingTo;
      assert.equal(target.index, 89);
      for (const fn of oldFrames) fn();
      await tick();
      assert.equal(r.state.scrollingTo, target);
      assert.equal(next.resolved, 0);
      r.native(r.env.getCurrentTargetOffset(r.ctx, target));
      r.frame();
      await tick();
      assert.equal(next.resolved, 1);
      return {
        old,
        next,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'old ordinary fallback cannot settle/retry/reject a replacement command',
    async () => {
      const r = rig();
      const h = r.handle();
      const old = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      const previousJobs = [...r.timers.values()];
      const next = outcome(
        h.scrollToIndex({
          index: 89,
          viewPosition: 1,
          animated: false,
        })
      );
      const target = r.state.scrollingTo;
      const count = r.snapshot().nativeCalls.length;
      for (const job of previousJobs) job.fn();
      await tick();
      assert.equal(r.state.scrollingTo, target);
      assert.equal(next.resolved, 0);
      assert.equal(next.rejected, 0);
      assert.equal(r.snapshot().nativeCalls.length, count);
      return {
        old,
        next,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'new intent invalidates old completion before latest layout dispatch',
    async () => {
      const r = rig();
      const h = r.handle();
      const old = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      r.grow();
      const jobs = [...r.raf.values()];
      const next = outcome(
        h.scrollToEnd({
          animated: false,
        })
      );
      const prior = r.state.scrollingTo;
      for (const fn of jobs) fn();
      await tick();
      assert.equal(r.state.scrollingTo, prior);
      assert.equal(next.resolved, 0);
      assert.equal(next.rejected, 0);
      return {
        old,
        next,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'deferred native method exception rejects exactly the queued request',
    async () => {
      const r = rig();
      const h = r.handle();
      const o = outcome(
        h.scrollToEnd({
          animated: false,
        })
      );
      r.failNative();
      assert.doesNotThrow(() => r.state.runPendingScrollToEnd());
      await tick();
      assert.equal(o.resolved, 0);
      assert.equal(o.rejected, 1);
      assert.equal(o.message, 'native-method-threw');
      assert.equal(r.state.pendingScrollReject, undefined);
      return {
        o,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'commit scheduler exception rejects without leaving a pending callback',
    async () => {
      const r = rig();
      const h = r.handle();
      r.failScheduler();
      const o = outcome(
        h.scrollToEnd({
          animated: false,
        })
      );
      await tick();
      assert.equal(o.rejected, 1);
      assert.equal(o.message, 'commit-scheduler-threw');
      assert.equal(r.state.pendingScrollResolve, undefined);
      assert.equal(r.state.pendingScrollReject, undefined);
      assert.equal(r.state.pendingScrollToEnd, undefined);
      return {
        o,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'deferred readiness getter exception rejects without escaping RAF',
    async () => {
      const r = rig();
      r.state.didDataChange = true;
      const h = r.handle();
      const o = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      r.state.didDataChange = false;
      Object.defineProperty(r.state.props, 'data', {
        get() {
          throw new Error('readiness-threw');
        },
      });
      assert.doesNotThrow(() => r.frame());
      await tick();
      assert.equal(o.rejected, 1);
      assert.equal(o.message, 'readiness-threw');
      assert.equal(r.state.pendingScrollResolve, undefined);
      return {
        o,
      };
    }
  );
  await asyncTest(
    'same-millisecond native delivery uses event identity rather than wallclock change',
    async () => {
      const r = rig();
      r.state.lastNativeScrollTime = 0;
      const h = r.handle();
      const o = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      r.native(9524.3125);
      assert.equal(r.state.lastNativeScrollTime, 0);
      r.frame();
      await tick();
      assert.equal(o.resolved, 1);
      return {
        o,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'retained initial target does not become a successful readiness exit on unaligned ordinary failure',
    async () => {
      const r = rig();
      r.state.initialScroll = {
        index: 89,
        viewPosition: 1,
      };
      r.state.didFinishInitialScroll = false;
      const h = r.handle();
      const o = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      for (let i = 0; i < 8 && r.timers.size; i++) {
        r.timer();
        await tick();
      }
      assert.equal(o.code, 'LEGEND_SCROLL_UNALIGNED');
      assert.equal(r.state.didFinishInitialScroll, false);
      assert.ok(r.state.initialScroll);
      return {
        o,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'native initial zero-fit completion behavior remains available',
    async () => {
      const r = rig();
      r.state.totalSize = 200;
      r.state.didFinishInitialScroll = false;
      r.state.hasScrolled = false;
      r.env.scrollTo(r.ctx, {
        index: 0,
        offset: 0,
        viewPosition: 0,
        animated: false,
        isInitialScroll: true,
      });
      r.env.checkFinishedScrollFallback(r.ctx);
      r.timer();
      await tick();
      assert.equal(r.state.scrollingTo, undefined);
      assert.equal(r.observed(), 1);
      return r.snapshot();
    }
  );
  await asyncTest(
    'terminal cleanup error still rejects the exact failed request',
    async () => {
      const r = rig();
      const h = r.handle();
      const o = outcome(
        h.scrollToEnd({
          animated: false,
        })
      );
      r.failNative();
      let once = false;
      r.state.triggerCalculateItemsInView = () => {
        if (!once) {
          once = true;
          return;
        }
        throw new Error('cleanup-layout-threw');
      };
      assert.doesNotThrow(() => r.state.runPendingScrollToEnd());
      await tick();
      assert.equal(o.rejected, 1);
      assert.equal(o.message, 'native-method-threw');
      assert.equal(r.state.pendingScrollResolve, undefined);
      assert.equal(r.state.pendingScrollReject, undefined);
      return {
        o,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'failure before newer latest dispatch retires superseded target without settling readiness',
    async () => {
      const r = rig();
      const h = r.handle();
      const old = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      const next = outcome(
        h.scrollToEnd({
          animated: false,
        })
      );
      Object.defineProperty(r.state.props, 'data', {
        get() {
          throw new Error('new-latest-readiness-threw');
        },
      });
      assert.doesNotThrow(() => r.state.runPendingScrollToEnd());
      await tick();
      assert.equal(next.rejected, 1);
      assert.equal(next.resolved, 0);
      assert.equal(r.state.scrollingTo, undefined);
      assert.equal(r.state.pendingScrollRequest, undefined);
      return {
        old,
        next,
        state: r.snapshot(),
      };
    }
  );
  await asyncTest(
    'exact pending promise cancellation prevents held end dispatch',
    async () => {
      const r = rig(),
        h = r.handle();
      const promise = h.scrollToEnd({ animated: false }),
        o = outcome(promise);
      const request = r.state.pendingScrollRequest;
      assert.equal(h.cancelScroll(promise), true);
      r.state.runPendingScrollToEnd();
      r.frame();
      await tick();
      assert.equal(o.rejected, 1);
      assert.equal(o.resolved, 0);
      assert.equal(r.state.pendingScrollRequest, undefined);
      assert.equal(r.snapshot().nativeCalls.length, 0);
      assert.equal(h.cancelScroll(promise), false);
      return { revision: request.revision, o, state: r.snapshot() };
    }
  );
  await asyncTest(
    'old cancelled identity cannot retire newer pending request',
    async () => {
      const r = rig(),
        h = r.handle();
      const old = h.scrollToEnd({ animated: false });
      outcome(old);
      const next = h.scrollToEnd({ animated: false }),
        o = outcome(next);
      const request = r.state.pendingScrollRequest;
      assert.equal(h.cancelScroll(old), false);
      assert.equal(r.state.pendingScrollRequest, request);
      r.state.runPendingScrollToEnd();
      r.frame();
      await tick();
      assert.equal(r.snapshot().nativeCalls.length, 1);
      assert.equal(r.state.scrollingTo.scrollCommandRevision, request.revision);
      return { o, state: r.snapshot() };
    }
  );
  await asyncTest('another list cannot retire the same promise', async () => {
    const a = rig(),
      b = rig(),
      ah = a.handle(),
      bh = b.handle();
    const promise = ah.scrollToEnd({ animated: false });
    outcome(promise);
    assert.equal(bh.cancelScroll(promise), false);
    a.state.runPendingScrollToEnd();
    a.frame();
    await tick();
    assert.equal(a.snapshot().nativeCalls.length, 1);
    assert.equal(b.snapshot().nativeCalls.length, 0);
    return { a: a.snapshot(), b: b.snapshot() };
  });
  await asyncTest(
    'active cancellation stops JS retries and preserves already delivered native command',
    async () => {
      const r = rig(),
        h = r.handle();
      const promise = h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        }),
        o = outcome(promise);
      assert.equal(r.snapshot().nativeCalls.length, 1);
      assert.equal(h.cancelScroll(promise), true);
      for (let i = 0; i < 5; i++) r.frame();
      await tick();
      assert.equal(o.rejected, 1);
      assert.equal(o.resolved, 0);
      assert.equal(r.state.scrollingTo, undefined);
      assert.equal(r.snapshot().nativeCalls.length, 1);
      return { o, state: r.snapshot() };
    }
  );
  await asyncTest(
    'cancel cleanup cannot invalidate a reentrant newer request',
    async () => {
      const r = rig(),
        h = r.handle();
      const promise = h.scrollToIndex({
        index: 81,
        viewPosition: 0.5,
        animated: false,
      });
      outcome(promise);
      let next;
      r.state.triggerCalculateItemsInView = () => {
        r.state.triggerCalculateItemsInView = () => {};
        next = h.scrollToEnd({ animated: false });
        outcome(next);
      };
      assert.equal(h.cancelScroll(promise), true);
      assert.ok(next);
      const current = r.state.pendingScrollRequest;
      r.state.runPendingScrollToEnd();
      r.frame();
      await tick();
      assert.equal(r.state.scrollingTo.scrollCommandRevision, current.revision);
      assert.equal(r.snapshot().nativeCalls.length, 2);
      return r.snapshot();
    }
  );
  for (const os of ['android', 'web'])
    await asyncTest(`${os} unchanged aligned ordinary completion`, async () => {
      const r = rig(os);
      const h = r.handle();
      const o = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          animated: false,
        })
      );
      r.native(9524.3125);
      r.frame();
      await tick();
      assert.equal(o.resolved, 1);
      assert.equal(o.rejected, 0);
      return {
        o,
        state: r.snapshot(),
      };
    });
  return {
    results,
    extractedFunctions: names,
    extractedSha256: sha256(bodies + '\n' + assignment),
    reprocessAssignment: assignment,
    scope:
      '33 actual-source completion/cancellation controls; manual native events and scheduling, peripheral thresholds/rendering stubbed. Target post identity across data reordering is a separate open contract.',
  };
});
