/**
 * Node22+: node scripts/test-legend-native-recovery.mjs [--source-dir DIR] [--report FILE].
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
await runInstalledControls('legend-native-recovery', async (source) => {
  const { bodies: coreBodies, names: coreNames } = extractDeclarations(source, {
    functions: [
      'createImperativeHandle',
      'shouldDeferPublicOnScroll',
      'onScroll',
      'updateScroll',
      'requestAdjust',
      'trackInitialScrollNativeProgress',
      'clearFinishedBootstrapInitialScrollTargetIfMovedAway',
      'resolvePendingNativeMVCPAdjust',
      'settlePendingNativeMVCPAdjust',
      'getPredictedNativeClamp',
      'getProgressTowardAmount',
      'maybeApplyPredictedNativeMVCPAdjust',
      'scrollTo',
      'doScrollTo',
      'finishScrollTo',
      'getAverageSizeSnapshot',
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
  const base = 9524.333333333334,
    amount = 502.125;
  function rig() {
    let now = 1000,
      nextId = 0;
    const timers = new Map(),
      frames = new Map(),
      nativeCalls = [],
      events = [],
      recalculations = [],
      signals = [],
      steps = [];
    const state = {
      props: {
        data: [
          {
            id: 'one',
          },
          {
            id: 'two',
          },
        ],
        horizontal: false,
        maintainVisibleContentPosition: {
          data: true,
          size: true,
        },
        onScroll: (e) =>
          events.push({
            offset: e.nativeEvent.contentOffset.y,
            time: now,
          }),
      },
      refScroller: {
        current: {
          scrollTo: (v) =>
            nativeCalls.push({
              options: v,
              time: now,
            }),
        },
      },
      scroll: base,
      scrollPending: base,
      scrollLength: 671,
      scrollHistory: [],
      scrollProcessingEnabled: true,
      didContainersLayout: true,
      didFinishInitialScroll: true,
      nativeContentInset: {
        top: 0,
        bottom: 98,
        left: 0,
        right: 0,
      },
      positions: [0, 100],
      sizesKnown: new Map(),
      averageSizes: {},
      lastNativeScroll: undefined,
      lastNativeScrollTime: undefined,
      triggerCalculateItemsInView: () =>
        recalculations.push({
          scroll: state.scroll,
          pending: state.scrollPending,
          time: now,
        }),
      timeouts: new Set(),
    };
    const ctx = {
      state,
      values: new Map([['readyToRender', true]]),
    };
    const env = {
      ctx,
      internalState: state,
      console,
      Platform: {
        OS: 'ios',
      },
      IsNewArchitecture: true,
      PlatformAdjustBreaksScroll: false,
      Date: {
        now: () => now,
      },
      setTimeout: (fn, delay) => {
        timers.set(++nextId, {
          fn,
          delay,
          due: now + delay,
        });
        return nextId;
      },
      clearTimeout: (id) => timers.delete(id),
      requestAnimationFrame: (fn) => {
        frames.set(++nextId, fn);
        return nextId;
      },
      cancelAnimationFrame: (id) => frames.delete(id),
      peek$: (c, k) => c.values.get(k),
      set$: (c, k, v) => {
        c.values.set(k, v);
        signals.push({
          key: k,
          value: v,
          time: now,
        });
      },
      getContentSize: () => 11660.375,
      getScrollVelocity: () => 0,
      updateAdaptiveRender: () => {},
      isInMVCPActiveMode: () => false,
      beginReachedEdgeUserScroll: () => undefined,
      checkThresholds: () => {},
      flushSync: (fn) => fn(),
      scheduleFullDrawDistancePrewarm: () => {},
      doMaintainScrollAtEnd: () => {},
      checkFinishedScroll: () => {},
      checkFinishedScrollFallback: () => {},
      toNativeHorizontalOffset: (_s, offset) => offset,
      toLogicalHorizontalOffset: (_s, offset) => offset,
      calculateOffsetWithOffsetPosition: (_c, n) => n,
      clampScrollOffset: (_c, n) => n,
      pinScrollTargetRenderRange: () => {},
      syncInitialScrollNativeWatchdog: () => {},
      initialScrollCompletion: {
        resetFlags: () => {},
        markInitialScrollNativeDispatch: () => {},
      },
      initialScrollWatchdog: {
        get: () => undefined,
      },
      recalculateSettledScroll: () =>
        recalculations.push({
          settled: true,
          scroll: state.scroll,
          time: now,
        }),
      MVCP_POSITION_EPSILON: 0.1,
      NATIVE_END_CLAMP_EPSILON: 1,
    };
    vm.createContext(env);
    vm.runInContext(bodies, env);
    state.scrollAdjustHandler = new env.ScrollAdjustHandler(ctx);
    vm.runInContext(assignment, env);
    const handle = env.createImperativeHandle(ctx, () => {});
    const snap = () => ({
      commandRevision: state.scrollCommandRevision,
      nativeEventRevision: state.nativeScrollEventRevision,
      scroll: state.scroll,
      pending: state.scrollPending,
      native: state.lastNativeScroll,
      nativeTime: state.lastNativeScrollTime,
      ignored: !!state.ignoreScrollFromMVCPIgnored,
      suppression: state.ignoreScrollFromMVCP
        ? {
            ...state.ignoreScrollFromMVCP,
          }
        : null,
      applied: state.scrollAdjustHandler.appliedAdjust,
      activeTarget: state.scrollingTo
        ? {
            ...state.scrollingTo,
          }
        : null,
      events: events.length,
      recalculations: recalculations.length,
      nativeCalls: nativeCalls.length,
    });
    const step = (name) =>
      steps.push({
        name,
        ...snap(),
      });
    const deliver = (offset) => {
      env.onScroll(ctx, {
        nativeEvent: {
          contentOffset: {
            x: 0,
            y: offset,
          },
          contentSize: {
            width: 402,
            height: 11562.333333333334,
          },
          layoutMeasurement: {
            width: 402,
            height: 671,
          },
          contentInset: {
            top: 0,
            bottom: 98,
            left: 0,
            right: 0,
          },
        },
      });
    };
    return {
      state,
      ctx,
      env,
      handle,
      timers,
      frames,
      nativeCalls,
      events,
      recalculations,
      signals,
      steps,
      snap,
      step,
      deliver,
      advance(ms) {
        now += ms;
        for (const [id, t] of [...timers])
          if (t.due <= now) {
            timers.delete(id);
            t.fn();
          }
      },
      tick(ms = 1) {
        now += ms;
      },
      prepare() {
        deliver(base);
        step('initial-native');
        env.requestAdjust(ctx, amount, true);
        step('adjust-request');
      },
      ignore() {
        deliver(base);
        step('unchanged-post-adjust-native');
      },
    };
  }
  const results = [];
  function test(name, fn) {
    let r;
    try {
      r = rig();
      fn(r);
      results.push({
        name,
        status: 'PASS',
        steps: r.steps,
        final: r.snap(),
      });
    } catch (e) {
      results.push({
        name,
        status: 'FAIL',
        message: e.message,
        steps: r?.steps,
        final: r?.snap(),
        stack: e.stack?.split('\n').slice(0, 4).join('\n'),
      });
    }
  }
  function assertRecovered(r) {
    assert.equal(
      r.state.scroll,
      base,
      'private scroll must converge to the actual delivered post-adjust native offset'
    );
    assert.equal(
      r.state.scrollPending,
      base,
      'pending must not become an unobserved offset'
    );
    assert.equal(r.state.lastNativeScroll, base);
    assert.equal(
      r.nativeCalls.length,
      0,
      'recovery must not issue captured-offset native writes'
    );
  }
  test('REC01 unchanged post-adjust native event recovers private and pending after100ms', (r) => {
    r.prepare();
    r.tick();
    r.ignore();
    assert.equal(r.state.ignoreScrollFromMVCPIgnored, true);
    r.advance(100);
    r.step('suppression-timeout');
    assertRecovered(r);
  });
  test('REC02 intervening logical predicted update cannot erase native recovery witness', (r) => {
    r.prepare();
    r.tick();
    r.ignore();
    r.env.updateScroll(r.ctx, base + amount, true);
    r.step('logical-prediction');
    assert.equal(r.state.ignoreScrollFromMVCPIgnored, false);
    r.advance(100);
    r.step('suppression-timeout');
    assertRecovered(r);
  });
  test('REC03 same-millisecond native event ordering still counts as fresh observation', (r) => {
    r.prepare();
    const initialTime = r.state.lastNativeScrollTime;
    r.ignore();
    assert.equal(r.state.lastNativeScrollTime, initialTime);
    r.advance(100);
    r.step('same-ms-suppression-timeout');
    assertRecovered(r);
  });
  test('REC04 actual native compensation at predicted offset is retained', (r) => {
    r.prepare();
    r.tick();
    r.deliver(base + amount);
    r.step('actual-compensation');
    r.advance(100);
    r.step('suppression-timeout');
    assert.equal(r.state.scroll, base + amount);
    assert.equal(r.state.scrollPending, base + amount);
    assert.equal(r.state.lastNativeScroll, base + amount);
    assert.equal(r.nativeCalls.length, 0);
  });
  test('REC05 no post-adjust native event does not adopt stale initial observation', (r) => {
    r.prepare();
    const count = r.recalculations.length;
    r.advance(100);
    r.step('timeout-without-event');
    assert.equal(r.state.scroll, base + amount);
    assert.equal(r.state.lastNativeScroll, base);
    assert.equal(r.events.length, 1);
    assert.equal(r.recalculations.length, count);
    assert.equal(r.nativeCalls.length, 0);
  });
  test('REC06 processing-disabled event cannot invent a new observation', (r) => {
    r.prepare();
    const time = r.state.lastNativeScrollTime;
    r.state.scrollProcessingEnabled = false;
    r.tick();
    r.deliver(base + amount);
    r.step('disabled-event');
    r.advance(100);
    r.step('disabled-timeout');
    assert.equal(r.state.lastNativeScroll, base);
    assert.equal(r.state.lastNativeScrollTime, time);
    assert.equal(r.events.length, 1);
    assert.equal(r.state.scroll, base + amount);
    assert.equal(r.nativeCalls.length, 0);
  });
  test('REC07 fresh enabled native event restores state after disabled interval', (r) => {
    r.prepare();
    r.state.scrollProcessingEnabled = false;
    r.tick();
    r.deliver(base + amount);
    r.advance(100);
    r.state.scrollProcessingEnabled = true;
    r.tick();
    r.deliver(base);
    r.step('resumed-fresh-event');
    assertRecovered(r);
  });
  test('REC08 forced old timeout cannot clear newer suppression after command-finish ABA', (r) => {
    r.prepare();
    r.tick();
    r.ignore();
    const old = [...r.timers.values()][0].fn;
    r.env.scrollTo(r.ctx, {
      offset: 9000,
      animated: false,
      precomputedWithViewOffset: true,
    });
    r.tick();
    r.deliver(9000);
    r.env.finishScrollTo(r.ctx);
    assert.equal(r.state.scrollingTo, undefined);
    r.step('new-command-native-finished');
    r.env.requestAdjust(r.ctx, 20, true);
    const current = r.state.ignoreScrollFromMVCP;
    r.step('new-adjustment');
    old();
    r.step('force-dequeued-old-timeout');
    assert.equal(
      r.state.ignoreScrollFromMVCP,
      current,
      'retired timeout must not clear a newer suppression owner'
    );
    assert.equal(r.state.lastNativeScroll, 9000);
  });
  test('REC09 old timeout after completed newer command preserves new native position', (r) => {
    r.prepare();
    r.tick();
    r.ignore();
    const old = [...r.timers.values()][0].fn;
    r.env.scrollTo(r.ctx, {
      offset: 9000,
      animated: false,
      precomputedWithViewOffset: true,
    });
    r.tick();
    r.deliver(9000);
    r.env.finishScrollTo(r.ctx);
    r.step('new-command-finished');
    old();
    r.step('old-timeout');
    assert.equal(r.state.scroll, 9000);
    assert.equal(r.state.scrollPending, 9000);
    assert.equal(r.state.lastNativeScroll, 9000);
    assert.equal(r.nativeCalls.length, 1);
  });
  test('REC10 newer accepted public request cancels old recovery before dispatch', (r) => {
    r.prepare();
    r.tick();
    r.ignore();
    const privateBefore = r.state.scroll,
      pendingBefore = r.state.scrollPending,
      calls = r.recalculations.length;
    r.handle.scrollToOffset({
      offset: 9000,
      animated: false,
    });
    r.step('new-public-request-queued');
    r.advance(100);
    r.step('old-recovery-timeout');
    assert.equal(r.state.scroll, privateBefore);
    assert.equal(
      r.state.scrollPending,
      pendingBefore,
      'retired recovery must not rewrite pending while newer command awaits dispatch'
    );
    assert.equal(r.recalculations.length, calls);
    assert.equal(r.state.ignoreScrollFromMVCP, undefined);
  });
  test('REC11 disabling processing after fresh event prevents reconciliation', (r) => {
    r.prepare();
    r.tick();
    r.ignore();
    r.state.scrollProcessingEnabled = false;
    const calls = r.recalculations.length;
    r.advance(100);
    r.step('disabled-after-observation-timeout');
    assert.equal(r.state.scroll, base + amount);
    assert.equal(r.state.scrollPending, base);
    assert.equal(r.state.lastNativeScroll, base);
    assert.equal(r.recalculations.length, calls);
    assert.equal(r.nativeCalls.length, 0);
  });
  test('REC12 nonfinite cached observation is not adopted by recovery', (r) => {
    r.prepare();
    r.tick();
    r.ignore();
    r.state.lastNativeScroll = NaN;
    r.advance(100);
    r.step('invalid-observation-timeout');
    assert.equal(r.state.scroll, base + amount);
    assert.ok(Number.isFinite(r.state.scrollPending));
    assert.equal(r.nativeCalls.length, 0);
  });
  test('REC13 forced old timeout cannot clear newer adjustment in same command', (r) => {
    r.prepare();
    r.tick();
    r.ignore();
    const old = [...r.timers.values()][0].fn;
    r.env.requestAdjust(r.ctx, 20, true);
    const current = r.state.ignoreScrollFromMVCP;
    old();
    r.step('old-timeout-same-command');
    assert.equal(r.state.ignoreScrollFromMVCP, current);
  });
  test('REC14 recovery does not manufacture a hasScrolled user-action flag', (r) => {
    r.prepare();
    r.tick();
    r.ignore();
    r.state.hasScrolled = false;
    r.advance(100);
    r.step('recovery-no-user-action');
    assert.equal(r.state.hasScrolled, false);
    assert.equal(r.nativeCalls.length, 0);
  });
  test('REC15 Android original self-reprocessing behavior remains unchanged', (r) => {
    r.env.Platform.OS = 'android';
    r.env.PlatformAdjustBreaksScroll = true;
    r.prepare();
    r.tick();
    r.ignore();
    r.advance(100);
    r.step('android-original-timeout');
    assert.equal(r.state.scroll, base + amount);
    assert.equal(r.state.scrollPending, base + amount);
    assert.equal(r.state.lastNativeScroll, base);
    assert.equal(r.state.scrollAdjustHandler.appliedAdjust, amount);
    assert.equal(r.nativeCalls.length, 0);
  });
  test('REC16 web relative adjustment has no native suppression timeout', (r) => {
    r.env.Platform.OS = 'web';
    r.prepare();
    r.step('web-adjustment');
    assert.equal(r.state.scroll, base + amount);
    assert.equal(r.state.scrollAdjustHandler.appliedAdjust, amount);
    assert.equal(r.timers.size, 0);
    assert.equal(r.state.ignoreScrollFromMVCP, undefined);
    assert.equal(r.nativeCalls.length, 0);
  });
  test('REC17 pre-ready relative adjustment applies exactly once through existing RAF', (r) => {
    r.ctx.values.set('readyToRender', false);
    r.deliver(base);
    r.env.requestAdjust(r.ctx, amount, true);
    r.step('pre-ready-adjustment');
    assert.equal(r.state.scroll, base + amount);
    assert.equal(r.state.adjustingFromInitialMount, 1);
    assert.equal(r.state.scrollAdjustHandler.appliedAdjust, 0);
    assert.equal(r.frames.size, 1);
    assert.equal(r.timers.size, 0);
    const pending = [...r.frames.values()];
    r.frames.clear();
    pending.forEach((fn) => fn());
    r.step('existing-layout-raf');
    assert.equal(r.state.adjustingFromInitialMount, 0);
    assert.equal(r.state.scrollAdjustHandler.appliedAdjust, amount);
    assert.equal(r.state.scroll, base + amount);
    assert.equal(r.state.ignoreScrollFromMVCP, undefined);
    assert.equal(r.nativeCalls.length, 0);
  });
  test('REC18 negative adjustment recovers unchanged freshly observed native offset', (r) => {
    r.deliver(base);
    r.env.requestAdjust(r.ctx, -amount, true);
    r.step('negative-adjustment');
    r.tick();
    r.ignore();
    assert.equal(r.state.ignoreScrollFromMVCPIgnored, true);
    r.advance(100);
    r.step('negative-suppression-timeout');
    assertRecovered(r);
    assert.equal(r.state.scrollAdjustHandler.appliedAdjust, -amount);
  });
  return {
    results,
    extractedFunctions: names,
    extractedSha256: sha256(bodies + '\n' + assignment),
    reprocessAssignment: assignment,
    scope:
      '18 actual-source suppression recovery controls; actual onScroll/updateScroll/requestAdjust/handler and closure, modeled native delivery and scheduling. No retrospective runtime cause or native rendering claim.',
  };
});
