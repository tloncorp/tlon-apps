import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(`${process.cwd()}/package.json`);
const React = require('react');
const Renderer = require('react-test-renderer');
const shim = require('use-sync-external-store/shim');
import assert from 'node:assert/strict';
import { runInstalledControls, sha256 } from './lib/legend-source-controls.mjs';

// These are the explicit modeled boundaries, not replacements for dispatch,
// range/position calculation, container allocation, ownership or completion.
const boundaries = new Set([
  'useStateContext',
  'useArr$',
  'getItemSize',
  'getContentInsetEnd',
  'addTotalSize',
  'scheduleContainerLayout',
  'getEffectiveDrawDistance',
  'getScrollVelocity',
  'updateAdaptiveRender',
  'checkThresholds',
  'beginReachedEdgeUserScroll',
  'scheduleFullDrawDistancePrewarm',
  'doMaintainScrollAtEnd',
  'finishInitialScroll',
  'updateViewableItems',
  'toNativeHorizontalOffset',
  'toLogicalHorizontalOffset',
  'toPhysicalHorizontalItemPosition',
  'clearFinishedBootstrapInitialScrollTargetIfMovedAway',
]);
const roots = [
  'ScrollAdjust',
  'createImperativeHandle',
  'scrollTo',
  'doScrollTo',
  'calculateItemsInView',
  'updateItemPositions',
  'prepareMVCP',
  'requestAdjust',
  'onScroll',
  'getCurrentTargetOffset',
  'getResolvedScrollCompletionState',
  'checkFinishedScrollFrame',
  'findAvailableContainers',
  'syncMountedContainer',
  'handleStickyRecycling',
];

await runInstalledControls('native-dispatch-render-handoff', async (source) => {
  if (source.text.includes('nativeReadPointIntent')) {
    assert.ok(
      source.text.includes(
        'useArr$(["otherAxisSize", "nativeReadPointAdjustment"])'
      )
    );
    assert.ok(
      source.text.includes(
        '...Platform.OS === "ios" ? { nativeReadPointAdjustment } : {}'
      )
    );
    assert.equal(
      source.text.split('    nativeReadPointIntent,').length - 1,
      2,
      'public prop must be consumed and copied to current normalized props'
    );
  }
  const declarations = new Map(
    source.tree.body
      .filter((n) => n.type === 'FunctionDeclaration')
      .map((n) => [n.id.name, n])
  );
  const selected = new Set();
  function visit(node, collect) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Identifier') collect(node.name);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach((child) => visit(child, collect));
      else if (value && typeof value === 'object') visit(value, collect);
    }
  }
  function add(name) {
    if (boundaries.has(name) || selected.has(name) || !declarations.has(name))
      return;
    selected.add(name);
    visit(declarations.get(name), add);
  }
  for (const name of roots) {
    assert.ok(declarations.has(name), `missing actual function ${name}`);
    add(name);
  }
  const adjust = source.tree.body.find(
    (n) =>
      n.type === 'VariableDeclaration' &&
      n.declarations.some((d) => d.id.name === 'ScrollAdjustHandler')
  );
  assert.ok(adjust);
  visit(adjust, add);
  const bodies =
    [...selected]
      .map((name) => declarations.get(name))
      .sort((a, b) => a.start - b.start)
      .map((n) => source.text.slice(n.start, n.end))
      .join('\n') +
    '\n' +
    source.text.slice(adjust.start, adjust.end);

  let lastRigSnapshot;
  function rig(os = 'ios') {
    let now = 0,
      nextId = 0,
      settled = 0;
    const raf = new Map(),
      timers = new Map(),
      dispatches = [],
      publications = [],
      rejected = [];
    // Explicit geometry corpus, not a fabricated reconstruction of unknown R8
    // rows. The revision magnitude is from the retained R8 target-position delta.
    const keys = Array.from(
      { length: 90 },
      (_, i) => `scroll-fixture-${i + 30}`
    );
    const sizes = new Map(keys.map((k) => [k, 120]));
    sizes.set(keys[10], 121 + 2 / 3);
    const positions = [];
    let total = 0;
    for (const key of keys) {
      positions.push(total);
      total += sizes.get(key);
    }
    const state = {
      props: {
        data: keys.map((id) => ({ id })),
        keyExtractor: (item) => item?.id,
        keyExtractorProvided: true,
        maintainVisibleContentPosition: { data: true, size: true },
        maintainScrollAtEnd: false,
        horizontal: false,
        alwaysRenderIndicesArr: [],
        alwaysRenderIndicesSet: new Set(),
        stickyHeaderIndicesArr: [],
        stickyHeaderIndicesSet: new Set(),
        recycleItems: true,
      },
      positions,
      columns: [],
      columnSpans: [],
      idCache: [...keys],
      indexByKey: new Map(keys.map((k, i) => [k, i])),
      sizes: new Map(sizes),
      sizesKnown: new Map(sizes),
      averageSizes: {},
      totalSize: total,
      scrollLength: 671,
      scroll: total - 573,
      scrollPending: total - 573,
      lastNativeScroll: total - 573,
      lastNativeScrollTimestamp: 0,
      scrollHistory: [],
      didContainersLayout: true,
      didFinishInitialScroll: true,
      hasScrolled: true,
      scrollProcessingEnabled: true,
      scrollCommandRevision: 0,
      nativeScrollEventRevision: 0,
      containerItemKeys: new Map(),
      containerItemMetadata: new Map(),
      containerItemGenerations: [],
      stickyContainerPool: new Set(),
      startBuffered: 81,
      endBuffered: 89,
      startBufferedId: keys[81],
      idsInView: keys.slice(85),
      enableScrollForNextCalculateItemsInView: false,
      scrollItemLayoutData: null,
      scrollItemLayoutVersion: undefined,
      scrollItemLayoutKey: undefined,
      timeouts: new Set(),
      pendingScrollResolve: () => settled++,
      pendingScrollReject: (error) => rejected.push(error.code),
    };
    state.scrollItemLayoutData = state.props.data;
    const values = new Map([
      ['numContainers', 9],
      ['numContainersPooled', 9],
      ['numColumns', 1],
      ['stylePaddingTop', 0],
      ['alignItemsAtEndPadding', 0],
      ['headerSize', 0],
      ['footerSize', 0],
      ['readyToRender', true],
      ['activeStickyIndex', -1],
      ['isWithinMaintainScrollAtEndThreshold', false],
      ['totalSize', total],
    ]);
    const ctx = {
      state,
      values,
      listeners: new Map(),
      positionListeners: new Map(),
      containerLayoutTriggers: new Map(),
    };
    for (let i = 81; i < 90; i++) {
      const c = i - 81,
        key = keys[i];
      state.containerItemKeys.set(key, c);
      values.set(`containerItemKey${c}`, key);
      values.set(`containerItemIndex${c}`, i);
      values.set(`containerItemData${c}`, state.props.data[i]);
      values.set(`containerPosition${c}`, positions[i]);
    }
    state.refScroller = {
      current: {
        scrollTo: (args) =>
          dispatches.push({
            time: now,
            ...args,
            current: state.scrollingTo
              ? env.getCurrentTargetOffset(ctx, state.scrollingTo)
              : null,
            revision: state.scrollCommandRevision,
          }),
      },
    };
    const env = {
      React2: { createElement: (type, props) => ({ type, props }) },
      React2__namespace: { createElement: (type, props) => ({ type, props }) },
      ReactNative: { View: 'View' },
      View$1: 'View',
      useStateContext: () => ctx,
      useArr$: (names) => names.map((name) => values.get(name)),
      console,
      IS_DEV: false,
      Platform: { OS: os },
      IsNewArchitecture: true,
      PlatformAdjustBreaksScroll: os === 'android',
      POSITION_OUT_OF_VIEW: -1e7,
      MVCP_POSITION_EPSILON: 0.1,
      MVCP_ANCHOR_LOCK_TTL_MS: 300,
      MVCP_ANCHOR_LOCK_QUIET_PASSES_TO_RELEASE: 2,
      NATIVE_END_CLAMP_EPSILON: 1,
      RENDER_RANGE_PROJECTION_FULL_VELOCITY: 4,
      RENDER_RANGE_PROJECTION_SETTLE_DELAY: 100,
      INITIAL_SCROLL_COMPLETION_TARGET_EPSILON: 1,
      INITIAL_SCROLL_ZERO_TARGET_EPSILON: 1,
      INITIAL_SCROLL_MAX_FALLBACK_CHECKS: 20,
      SILENT_INITIAL_SCROLL_RETRY_DELAY_MS: 16,
      SILENT_INITIAL_SCROLL_TARGET_EPSILON: 1,
      Date: { now: () => now },
      requestAnimationFrame: (fn) => {
        const id = ++nextId;
        raf.set(id, fn);
        return id;
      },
      cancelAnimationFrame: (id) => raf.delete(id),
      setTimeout: (fn, delay) => {
        const id = ++nextId;
        timers.set(id, { fn, due: now + delay });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      batchedUpdates: (fn) => fn(),
      flushSync: (fn) => fn(),
      getItemSize: (c, key) => c.state.sizesKnown.get(key),
      getContentInsetEnd: () => 98,
      addTotalSize: (c, _key, value) => {
        c.state.totalSize = value;
        c.values.set('totalSize', value);
      },
      getEffectiveDrawDistance: () => 100,
      getScrollVelocity: () => 0,
      updateAdaptiveRender: () => {},
      checkThresholds: () => {},
      beginReachedEdgeUserScroll: () => undefined,
      scheduleFullDrawDistancePrewarm: () => {},
      doMaintainScrollAtEnd: () => {},
      updateViewableItems: () => {},
      scheduleContainerLayout: () =>
        publications.push([...state.containerItemKeys.keys()]),
      toNativeHorizontalOffset: (_s, value) => value,
      toLogicalHorizontalOffset: (_s, value) => value,
      toPhysicalHorizontalItemPosition: (_s, value) => value,
      clearFinishedBootstrapInitialScrollTargetIfMovedAway: () => {},
      initialScrollCompletion: {
        didDispatchNativeScroll: () => false,
        resetFlags: () => {},
        markInitialScrollNativeDispatch: () => {},
      },
      initialScrollWatchdog: {
        get: () => undefined,
        hasNonZeroTargetOffset: (n) => n > 1,
        isAtZeroTargetOffset: (n) => Math.abs(n) <= 1,
        clear: () => {},
      },
      finishInitialScroll: () => {
        throw Error('ordinary command cannot finish initial readiness');
      },
    };
    vm.createContext(env);
    vm.runInContext(bodies, env);
    state.scrollAdjustHandler = new env.ScrollAdjustHandler(ctx);
    let onCalculate;
    state.triggerCalculateItemsInView = (params) => {
      if (onCalculate) {
        const callback = onCalculate;
        onCalculate = undefined;
        callback();
      }
      env.calculateItemsInView(ctx, params);
    };
    function visibleKeys(offset = state.lastNativeScroll) {
      return keys.filter(
        (key, i) =>
          positions[i] < offset + 573 &&
          positions[i] + state.sizesKnown.get(key) > offset
      );
    }
    function currentOffset(index = 10) {
      return positions[index] - (573 - state.sizesKnown.get(keys[index])) / 2;
    }
    function command(index = 10, options = {}) {
      env.scrollTo(ctx, {
        keyedTarget: true,
        targetKey: keys[index],
        index,
        itemSize: state.sizesKnown.get(keys[index]),
        offset: positions[index],
        viewPosition: 0.5,
        viewOffset: 0,
        animated: false,
        ...options,
      });
      return state.scrollingTo;
    }
    function native(offset) {
      now += 1;
      env.onScroll(ctx, {
        nativeEvent: {
          contentOffset: { x: 0, y: offset },
          timestamp: now,
          contentSize: { width: 402, height: state.totalSize },
          contentInset: { top: 0, bottom: 98, left: 0, right: 0 },
        },
      });
    }
    function frame() {
      now += 16;
      const callbacks = [...raf.values()];
      raf.clear();
      callbacks.forEach((fn) => fn());
    }
    function timer() {
      const first = [...timers].sort((a, b) => a[1].due - b[1].due)[0];
      assert.ok(first);
      timers.delete(first[0]);
      now = first[1].due;
      first[1].fn();
    }
    function revise() {
      // New host sizes are known; positions still belong to the prior layout.
      state.sizesKnown.set(keys[5], 120 + 659 + 1 / 3);
      state.sizes.set(keys[5], 120 + 659 + 1 / 3);
      state.sizesKnown.set(keys[89], 61);
      state.sizes.set(keys[89], 61);
      state.minIndexSizeChanged = 5;
    }
    lastRigSnapshot = () => ({
      dispatches: [...dispatches],
      keys: [...state.containerItemKeys.keys()],
      scroll: state.scroll,
      native: state.lastNativeScroll,
      targetPosition: state.positions[10],
      appliedAdjust: state.scrollAdjustHandler.appliedAdjust,
      settled,
      rejected: [...rejected],
    });
    return {
      ctx,
      state,
      env,
      keys,
      dispatches,
      publications,
      rejected,
      visibleKeys,
      currentOffset,
      command,
      native,
      frame,
      timer,
      revise,
      values,
      beforeNextCalculation: (fn) => {
        onCalculate = fn;
      },
      settled: () => settled,
      snapshot: () => ({
        dispatches: [...dispatches],
        keys: [...state.containerItemKeys.keys()],
        scroll: state.scroll,
        native: state.lastNativeScroll,
        current: state.scrollingTo
          ? env.getCurrentTargetOffset(ctx, state.scrollingTo)
          : null,
        settled,
        rejected: [...rejected],
      }),
    };
  }

  const results = [];
  async function test(name, fn) {
    try {
      results.push({ name, status: 'PASS', evidence: await fn() });
    } catch (error) {
      results.push({
        name,
        status: 'FAIL',
        error: error.stack,
        evidence: lastRigSnapshot?.(),
      });
    }
  }
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
  await test('unchanged layout dispatches current target, waits for native acknowledgement', () => {
    const r = rig();
    const expected = r.currentOffset();
    r.command();
    near(r.dispatches[0].y, expected);
    r.frame();
    assert.equal(r.settled(), 0);
    r.native(expected);
    r.frame();
    assert.equal(r.settled(), 1);
    return r.snapshot();
  });
  await test('synchronous position revision cannot dispatch captured stale target', () => {
    const r = rig();
    const old = r.currentOffset();
    r.revise();
    r.command();
    assert.ok(r.currentOffset() - old > 659);
    near(r.dispatches[0].y, r.currentOffset());
    return r.snapshot();
  });
  await test('outgoing native-visible rows survive before native delivery', () => {
    const r = rig();
    const visible = r.visibleKeys();
    r.command();
    for (const key of visible)
      assert.ok(
        r.state.containerItemKeys.has(key),
        `retired native-visible ${key}`
      );
    assert.equal(r.settled(), 0);
    return { visible, ...r.snapshot() };
  });
  await test('revised target retains outgoing rows and rejects old-offset completion', () => {
    const r = rig();
    const visible = r.visibleKeys(),
      old = r.currentOffset();
    r.revise();
    r.command();
    for (const key of visible)
      assert.ok(
        r.state.containerItemKeys.has(key),
        `retired native-visible ${key}`
      );
    r.native(old);
    r.frame();
    assert.equal(r.settled(), 0);
    const middle = r.visibleKeys();
    r.state.scroll = r.state.totalSize - 573;
    r.env.calculateItemsInView(r.ctx);
    for (const key of middle)
      assert.ok(
        r.state.containerItemKeys.has(key),
        `retired intermediate native-visible ${key}`
      );
    r.native(r.currentOffset());
    r.frame();
    assert.equal(r.settled(), 1);
    return r.snapshot();
  });
  await test('newer request accepted during calculation prevents old dispatch continuation', () => {
    const r = rig();
    r.beforeNextCalculation(() => r.command(50));
    r.command();
    assert.equal(r.state.scrollingTo.targetKey, r.keys[50]);
    assert.equal(r.dispatches.length, 1);
    near(r.dispatches[0].y, r.currentOffset(50));
    return r.snapshot();
  });
  await test('new command accepted by a range-size callback keeps its own target pin and dispatch', () => {
    const r = rig();
    const read = r.env.getItemSize;
    let fired = false;
    r.env.getItemSize = (ctx, key, ...args) => {
      if (!fired && ctx.state.scrollingTo?.targetKey === r.keys[10]) {
        fired = true;
        r.command(50);
      }
      return read(ctx, key, ...args);
    };
    r.command();
    assert.ok(fired);
    assert.equal(r.dispatches.length, 1);
    assert.equal(r.state.scrollingTo.targetKey, r.keys[50]);
    near(r.dispatches[0].y, r.currentOffset(50));
    assert.ok(
      r.state.scrollTargetPinnedRange.start <= 50 &&
        r.state.scrollTargetPinnedRange.end >= 50
    );
    return r.snapshot();
  });
  await test('drag cancellation during calculation prevents old dispatch continuation', () => {
    const r = rig();
    r.beforeNextCalculation(() => {
      r.state.scrollCommandRevision++;
      r.state.scrollingTo = undefined;
      r.state.scrollTargetPinnedRange = undefined;
    });
    r.command();
    assert.equal(r.dispatches.length, 0);
    return r.snapshot();
  });
  await test('new command retires outgoing reservation from the older observed viewport', () => {
    const r = rig();
    const initial = r.visibleKeys(),
      initialContainers = initial.map((k) => r.state.containerItemKeys.get(k));
    r.command();
    for (const key of initial) assert.ok(r.state.containerItemKeys.has(key));
    r.native(r.currentOffset(50));
    r.command(70);
    for (const id of initialContainers)
      assert.ok(
        !r.state.stickyContainerPool.has(id),
        `old row reservation survives new command: ${id}`
      );
    r.state.scrollCommandRevision++;
    r.state.scrollingTo = undefined;
    r.state.scrollTargetPinnedRange = undefined;
    r.env.calculateItemsInView(r.ctx, { forceFullItemPositions: true });
    assert.equal(r.state.stickyContainerPool.size, 0);
    return r.snapshot();
  });
  await test('fresh acknowledgement removes outgoing reservation without initial readiness', () => {
    const r = rig();
    const initial = r.visibleKeys(),
      initialContainers = initial.map((k) => r.state.containerItemKeys.get(k));
    r.command();
    for (const key of initial) assert.ok(r.state.containerItemKeys.has(key));
    r.native(r.currentOffset());
    r.frame();
    assert.equal(r.state.scrollingTo, undefined);
    assert.equal(r.settled(), 1);
    for (const id of initialContainers)
      assert.ok(!r.state.stickyContainerPool.has(id));
    return r.snapshot();
  });
  await test('geometry becoming unavailable during calculation cannot dispatch stale offset or finish', () => {
    const r = rig();
    let available = true;
    r.beforeNextCalculation(() => {
      available = false;
    });
    r.command(10, { getViewOffset: () => (available ? 0 : undefined) });
    assert.equal(r.dispatches.length, 0);
    assert.equal(r.settled(), 0);
    for (let i = 0; i < 10 && !r.rejected.length; i++) r.timer();
    assert.deepEqual(r.rejected, ['LEGEND_SCROLL_UNALIGNED']);
    assert.equal(r.settled(), 0);
    return r.snapshot();
  });
  await test('actual public scrollToItem retains identity through synchronous position revision', async () => {
    const r = rig();
    r.revise();
    let resolved = 0;
    const handle = r.env.createImperativeHandle(r.ctx, () => {});
    const promise = handle.scrollToItem({
      item: r.state.props.data[10],
      viewPosition: 0.5,
      animated: false,
    });
    promise.then(() => resolved++);
    near(r.dispatches[0].y, r.currentOffset());
    assert.equal(r.state.scrollingTo.targetKey, r.keys[10]);
    r.native(r.currentOffset());
    r.frame();
    await promise;
    assert.equal(resolved, 1);
    return r.snapshot();
  });
  for (const os of ['android', 'web'])
    await test(`${os} dispatch and retention policy remains unchanged`, () => {
      const r = rig(os);
      const target = r.command();
      near(r.dispatches[0].y, r.currentOffset());
      assert.equal(target.nativeRetainedKeys, undefined);
      return r.snapshot();
    });
  await test('animated iOS requests retain existing path', () => {
    const r = rig();
    const target = r.command(10, { animated: true });
    near(r.dispatches[0].y, r.currentOffset());
    assert.equal(target.nativeRetainedKeys, undefined);
    return r.snapshot();
  });
  await test('unchanged active keyed layout issues no relative adjustment', () => {
    const r = rig();
    r.command();
    const before = r.state.scrollAdjustHandler.appliedAdjust;
    r.env.calculateItemsInView(r.ctx, { doMVCP: true });
    near(r.state.scrollAdjustHandler.appliedAdjust, before);
    return r.snapshot();
  });
  await test('held outgoing native offset receives no relative target-growth compensation', () => {
    const r = rig();
    r.command();
    const oldNative = r.state.lastNativeScroll,
      oldPosition = r.state.positions[10],
      before = r.state.scrollAdjustHandler.appliedAdjust;
    r.revise();
    r.env.calculateItemsInView(r.ctx, { doMVCP: true });
    const amount = r.state.scrollAdjustHandler.appliedAdjust - before;
    const evidence = {
      ...r.snapshot(),
      relativeAmount: amount,
      targetPositionDelta: r.state.positions[10] - oldPosition,
      heldNative: oldNative,
      legalMaximum: r.state.totalSize - 573,
      hypotheticalRelativeNativeOffset: oldNative + amount,
    };
    // This is a projection of a relative write onto a deliberately held native
    // viewport, not a claim that this modeled writer produced the R8 frames.
    assert.equal(amount, 0, JSON.stringify(evidence));
    assert.equal(r.state.lastNativeScroll, oldNative);
    assert.equal(r.settled(), 0);
    r.timer();
    near(r.dispatches.at(-1).y, r.currentOffset());
    r.native(r.currentOffset());
    r.frame();
    assert.equal(r.settled(), 1);
    return evidence;
  });
  await test('relayout allocates newly intersecting observed-viewport rows while native delivery is held', () => {
    const r = rig();
    r.command();
    r.revise();
    r.env.calculateItemsInView(r.ctx, { doMVCP: true });
    const required = r.visibleKeys();
    assert.ok(required.length > 0);
    for (const key of required)
      assert.ok(
        r.state.containerItemKeys.has(key),
        `new observed-viewport row missing: ${key}`
      );
    return { required, ...r.snapshot() };
  });
  await test('ordinary READ keeps its unchanged relative-anchor compensation', () => {
    const r = rig();
    const key = r.state.idsInView[0],
      index = r.state.indexByKey.get(key),
      apply = r.env.prepareMVCP(r.ctx, false);
    for (let i = index; i < r.state.positions.length; i++)
      r.state.positions[i] += 50;
    r.state.totalSize += 50;
    apply();
    near(r.state.scrollAdjustHandler.appliedAdjust, 50);
    return r.snapshot();
  });
  await test('acknowledged command retires exclusivity and normal READ compensates again', () => {
    const r = rig();
    r.command();
    r.native(r.currentOffset());
    r.frame();
    assert.equal(r.state.scrollingTo, undefined);
    const key = r.state.idsInView[0],
      index = r.state.indexByKey.get(key),
      apply = r.env.prepareMVCP(r.ctx, false);
    for (let i = index; i < r.state.positions.length; i++)
      r.state.positions[i] += 50;
    r.state.totalSize += 50;
    apply();
    near(r.state.scrollAdjustHandler.appliedAdjust, 50);
    return r.snapshot();
  });
  for (const cause of ['new-command', 'completed-command-ABA', 'drag-ABA'])
    await test(`old READ preparation cannot apply after ${cause}`, () => {
      const r = rig();
      const key = r.state.idsInView[0],
        index = r.state.indexByKey.get(key),
        apply = r.env.prepareMVCP(r.ctx, false);
      if (cause === 'drag-ABA') {
        r.state.scrollCommandRevision++;
        r.state.scrollingTo = undefined;
      } else {
        r.command(50);
        if (cause === 'completed-command-ABA') {
          r.native(r.currentOffset(50));
          r.frame();
          assert.equal(r.state.scrollingTo, undefined);
        }
      }
      const before = r.state.scrollAdjustHandler.appliedAdjust;
      for (let i = index; i < r.state.positions.length; i++)
        r.state.positions[i] += 50;
      r.state.totalSize += 50;
      apply();
      near(r.state.scrollAdjustHandler.appliedAdjust, before);
      return r.snapshot();
    });

  await test('routed READ never predicts the native offset or normal ledger', () => {
    const r = rig();
    r.state.props.nativeReadPointCorrection = true;
    r.state.props.nativeReadPointIntent = 'A';
    const before = r.state.scroll,
      pending = r.state.scrollPending;
    r.env.requestAdjust(r.ctx, 50, false);
    near(r.state.scroll, before);
    near(r.state.scrollPending, pending);
    near(r.state.scrollAdjustHandler.getAdjust(), 0);
    near(r.state.nativeReadRelativeSignal?.amount, 50);
    assert.equal(r.state.ignoreScrollFromMVCP, undefined);
    return r.snapshot();
  });
  await test('routed relative deltas accumulate in actual native sentinel', () => {
    const r = rig();
    r.state.props.nativeReadPointCorrection = true;
    r.state.props.nativeReadPointIntent = 'A';
    r.ctx.values.set('scrollAdjust', 30);
    r.ctx.values.set('scrollAdjustUserOffset', 7);
    r.env.requestAdjust(r.ctx, 50, false);
    r.env.requestAdjust(r.ctx, -12, false);
    near(r.env.ScrollAdjust().props.style.top, 1e7 + 30 + 7);
    assert.deepEqual(
      (({ intent, amount }) => ({ intent, amount }))(
        JSON.parse(r.ctx.values.get('nativeReadPointAdjustment'))
      ),
      { intent: 'A', amount: 38 }
    );
    near(r.state.scrollAdjustHandler.getAdjust(), 0);
  });
  await test('READ legacy fallback native event is accepted immediately', () => {
    const r = rig();
    r.state.props.nativeReadPointCorrection = true;
    r.state.props.nativeReadPointIntent = 'A';
    const before = r.state.scroll;
    r.env.requestAdjust(r.ctx, 50, false);
    r.native(before + 50);
    near(r.state.scroll, before + 50);
    assert.equal(r.state.ignoreScrollFromMVCP, undefined);
  });
  await test('READ provider native delta differing from sentinel is accepted immediately', () => {
    const r = rig();
    r.state.props.nativeReadPointCorrection = true;
    r.state.props.nativeReadPointIntent = 'A';
    const before = r.state.scroll;
    r.env.requestAdjust(r.ctx, 50, false);
    r.native(before - 38);
    near(r.state.scroll, before - 38);
    assert.equal(r.state.ignoreScrollFromMVCP, undefined);
  });
  await test('READ unavailable native result does not leave a predicted jump', () => {
    const r = rig();
    r.state.props.nativeReadPointCorrection = true;
    r.state.props.nativeReadPointIntent = 'A';
    const before = r.state.scroll;
    r.env.requestAdjust(r.ctx, 50, false);
    near(r.state.scroll, before);
    near(r.state.lastNativeScroll, before);
    assert.equal(r.state.ignoreScrollFromMVCPTimeout, undefined);
  });
  await test('READ negative data change does not queue a second clamp writer', () => {
    const r = rig();
    r.state.props.nativeReadPointCorrection = true;
    r.state.props.nativeReadPointIntent = 'A';
    const before = r.state.scroll;
    const apply = r.env.prepareMVCP(r.ctx, true);
    for (let i = 0; i < r.state.positions.length; i++)
      r.state.positions[i] -= 138;
    r.state.totalSize -= 176;
    apply();
    assert.equal(r.state.pendingNativeMVCPAdjust, undefined);
    near(r.state.scroll, before);
    near(r.state.scrollAdjustHandler.getAdjust(), 0);
    near(r.state.nativeReadRelativeSignal?.amount, -138);
  });
  await test('READ admission retires an older deferred clamp calculation', () => {
    const r = rig();
    r.state.props.nativeReadPointCorrection = true;
    r.state.props.nativeReadPointIntent = 'A';
    r.state.pendingNativeMVCPAdjust = {
      amount: -138,
      manualApplied: 0,
      startScroll: r.state.scroll,
      furthestProgressTowardAmount: 0,
    };
    const apply = r.env.prepareMVCP(r.ctx, false);
    assert.equal(r.state.pendingNativeMVCPAdjust, undefined);
    assert.equal(typeof apply, 'function');
  });
  await test('disabling READ routing preserves cumulative signal and ordinary next delta', () => {
    const r = rig();
    r.state.props.nativeReadPointCorrection = true;
    r.state.props.nativeReadPointIntent = 'A';
    r.env.requestAdjust(r.ctx, 50, false);
    r.state.props.nativeReadPointCorrection = false;
    const before = r.state.scroll;
    r.env.requestAdjust(r.ctx, 7, false);
    near(r.state.scroll, before + 7);
    near(r.state.scrollAdjustHandler.getAdjust(), 7);
    near(r.state.nativeReadRelativeSignal?.amount, 50);
    near(r.env.ScrollAdjust().props.style.top, 1e7 + 7);
  });
  for (const stateCase of [
    'target',
    'deferred-target',
    'initial',
    'maintain-end',
    'pending-end',
    'horizontal',
  ])
    await test(`READ routing preserves ${stateCase} path`, () => {
      const r = rig();
      r.state.props.nativeReadPointCorrection = true;
      r.state.props.nativeReadPointIntent = 'A';
      if (stateCase === 'target')
        r.state.scrollingTo = { index: 10, itemSize: 120, animated: false };
      if (stateCase === 'deferred-target')
        r.state.pendingScrollRequest = { revision: 1 };
      if (stateCase === 'initial') r.state.didFinishInitialScroll = false;
      if (stateCase === 'maintain-end')
        r.state.maintainingScrollAtEnd = 'pending';
      if (stateCase === 'pending-end') r.state.pendingScrollToEnd = true;
      if (stateCase === 'horizontal') r.state.props.horizontal = true;
      const before = r.state.scroll;
      r.env.requestAdjust(r.ctx, 50, false);
      near(r.state.scroll, before + 50);
      assert.equal(r.state.nativeReadRelativeSignal?.amount, undefined);
    });
  for (const os of ['android', 'web'])
    await test(`${os} ignores native READ routing port`, () => {
      const r = rig(os);
      r.state.props.nativeReadPointCorrection = true;
      r.state.props.nativeReadPointIntent = 'A';
      const before = r.state.scroll;
      r.env.requestAdjust(r.ctx, 50, false);
      near(r.state.scroll, before + 50);
      assert.equal(r.state.nativeReadRelativeSignal?.amount, undefined);
    });
  for (const cause of ['new-command', 'completed-command-ABA', 'drag-ABA'])
    await test(`old routed READ preparation cannot publish after ${cause}`, () => {
      const r = rig();
      r.state.props.nativeReadPointCorrection = true;
      r.state.props.nativeReadPointIntent = 'A';
      const index = r.state.indexByKey.get(r.state.idsInView[0]),
        apply = r.env.prepareMVCP(r.ctx, false);
      if (cause === 'drag-ABA') r.state.scrollCommandRevision++;
      else {
        r.command(50);
        if (cause === 'completed-command-ABA') {
          r.native(r.currentOffset(50));
          r.frame();
        }
      }
      for (let i = index; i < r.state.positions.length; i++)
        r.state.positions[i] += 50;
      r.state.totalSize += 50;
      apply();
      assert.equal(r.state.nativeReadRelativeSignal?.amount, undefined);
    });

  await test('new scope/visit intent starts a separate cumulative relative payload', () => {
    const r = rig();
    r.state.props.nativeReadPointCorrection = true;
    r.state.props.nativeReadPointIntent = '["scope","visit",1]';
    r.env.requestAdjust(r.ctx, 50, false);
    r.state.props.nativeReadPointIntent = '["scope","visit",2]';
    r.env.requestAdjust(r.ctx, 7, false);
    assert.deepEqual(
      (({ intent, amount }) => ({ intent, amount }))(
        JSON.parse(r.ctx.values.get('nativeReadPointAdjustment'))
      ),
      { intent: '["scope","visit",2]', amount: 7 }
    );
    near(r.state.scrollAdjustHandler.getAdjust(), 0);
  });
  await test('a boolean without exact native intent never claims tagged routing', () => {
    const r = rig();
    r.state.props.nativeReadPointCorrection = true;
    const before = r.state.scroll;
    r.env.requestAdjust(r.ctx, 7, false);
    near(r.state.scroll, before + 7);
    assert.equal(r.ctx.values.get('nativeReadPointAdjustment'), undefined);
  });
  function readRig() {
    const r = rig();
    r.state.props.nativeReadPointCorrection = true;
    r.state.props.nativeReadPointIntent = 'A';
    r.state.scroll = r.state.lastNativeScroll = 10376;
    return r;
  }
  function shifted(r, amount) {
    for (let i = 0; i < r.state.positions.length; i++)
      r.state.positions[i] += amount;
    r.state.totalSize += amount;
  }
  function emitted(r) {
    return JSON.parse(r.ctx.values.get('nativeReadPointAdjustment'));
  }
  function ackNative(r, offset, overrides = {}) {
    const signal = emitted(r),
      operation = signal.operation;
    r.env.onScroll(r.ctx, {
      nativeEvent: {
        timestamp: (r.state.lastNativeScrollTimestamp || 0) + 1,
        contentOffset: { x: 0, y: offset },
        contentSize: { width: 402, height: r.state.totalSize },
        nativeReadPointAdjustmentAck: {
          intent: signal.intent,
          operationId: operation?.id,
          startOffset: operation?.startOffset,
          startAmount: operation?.startAmount,
          amount: signal.amount,
          target: offset,
          ...overrides,
        },
      },
    });
  }
  await test('READ operation keeps pre-change actual native origin when clamp arrives before apply', () => {
    const r = readRig(),
      apply = r.env.prepareMVCP(r.ctx, true);
    shifted(r, -129.666666666668);
    r.native(10357.666666666666);
    apply();
    const signal = emitted(r);
    assert.equal(signal.operation.startOffset, 10376);
    near(
      signal.operation.startOffset +
        signal.amount -
        signal.operation.startAmount,
      10246.333333333332
    );
    near(r.state.scroll, 10357.666666666666);
    return signal;
  });
  await test('READ subsequent mutation before ACK preserves original basis after intermediate clamp', () => {
    const r = readRig();
    let apply = r.env.prepareMVCP(r.ctx, true);
    shifted(r, -129.666666666668);
    apply();
    const first = emitted(r);
    r.native(10357.666666666666);
    apply = r.env.prepareMVCP(r.ctx, false);
    shifted(r, -38);
    apply();
    const second = emitted(r);
    assert.deepEqual(second.operation, first.operation);
    near(
      second.operation.startOffset +
        second.amount -
        second.operation.startAmount,
      10208.333333333332
    );
    return second;
  });
  await test('READ actual target ACK rebases only next operation', () => {
    const r = readRig();
    r.env.requestAdjust(r.ctx, -50, false);
    const first = emitted(r);
    ackNative(r, 10326);
    r.env.requestAdjust(r.ctx, -38, false);
    const second = emitted(r);
    assert.ok(second.operation.id > first.operation.id);
    near(second.operation.startOffset, 10326);
    near(second.operation.startAmount, -50);
    near(
      second.operation.startOffset +
        second.amount -
        second.operation.startAmount,
      10288
    );
  });
  await test('READ logical predicted update cannot acknowledge operation', () => {
    const r = readRig();
    r.env.requestAdjust(r.ctx, -50, false);
    const first = emitted(r);
    r.env.updateScroll(r.ctx, 10326, true, { markHasScrolled: false });
    r.env.requestAdjust(r.ctx, -38, false);
    assert.deepEqual(emitted(r).operation, first.operation);
  });
  await test('READ repeated old native timestamp cannot acknowledge operation', () => {
    const r = readRig();
    r.state.lastNativeScrollTimestamp = 100;
    r.env.requestAdjust(r.ctx, -50, false);
    const first = emitted(r);
    r.env.onScroll(r.ctx, {
      nativeEvent: {
        timestamp: 100,
        contentOffset: { x: 0, y: 10326 },
        contentSize: { width: 402, height: r.state.totalSize },
      },
    });
    r.env.requestAdjust(r.ctx, -38, false);
    assert.deepEqual(emitted(r).operation, first.operation);
  });
  await test('READ unavailable native observation never substitutes private speculative offset', () => {
    const r = readRig();
    r.state.lastNativeScroll = undefined;
    r.state.scroll = 9999;
    const apply = r.env.prepareMVCP(r.ctx, false);
    shifted(r, -50);
    apply();
    assert.equal(r.ctx.values.get('nativeReadPointAdjustment'), undefined);
    near(r.state.scroll, 9999);
  });
  await test('READ native provider different target does not rebase fallback operation', () => {
    const r = readRig();
    r.env.requestAdjust(r.ctx, -50, false);
    const first = emitted(r);
    r.native(10338);
    r.env.requestAdjust(r.ctx, -38, false);
    assert.deepEqual(emitted(r).operation, first.operation);
    near(r.state.scroll, 10338);
  });
  for (const cause of ['newer-prepare', 'newer-request', 'scope', 'disabled'])
    await test(`READ old preparation cannot publish after ${cause}`, () => {
      const r = readRig(),
        apply = r.env.prepareMVCP(r.ctx, false);
      shifted(r, -50);
      if (cause === 'newer-prepare') r.env.prepareMVCP(r.ctx, false);
      if (cause === 'newer-request') r.env.requestAdjust(r.ctx, 7, false);
      if (cause === 'scope') r.state.props.nativeReadPointIntent = 'B';
      if (cause === 'disabled') r.state.props.nativeReadPointCorrection = false;
      const before = r.ctx.values.get('nativeReadPointAdjustment'),
        scroll = r.state.scroll,
        adjust = r.state.scrollAdjustHandler.getAdjust();
      apply();
      assert.equal(r.ctx.values.get('nativeReadPointAdjustment'), before);
      near(r.state.scroll, scroll);
      near(r.state.scrollAdjustHandler.getAdjust(), adjust);
    });
  await test('READ exact ACK arriving during preparation rebases without losing its new delta', () => {
    const r = readRig();
    r.env.requestAdjust(r.ctx, -50, false);
    const first = emitted(r);
    const apply = r.env.prepareMVCP(r.ctx, false);
    ackNative(r, 10326);
    shifted(r, -38);
    apply();
    assert.ok(emitted(r).operation.id > first.operation.id);
    near(emitted(r).operation.startOffset, 10326);
    near(
      emitted(r).operation.startOffset +
        emitted(r).amount -
        emitted(r).operation.startAmount,
      10288
    );
  });
  await test('READ terminal legal-clamp ACK prevents old displacement reviving after growth', () => {
    const r = readRig();
    r.env.requestAdjust(r.ctx, 500, false);
    const first = emitted(r);
    ackNative(r, 10357.666666666666);
    const apply = r.env.prepareMVCP(r.ctx, false);
    shifted(r, 100);
    apply();
    const second = emitted(r);
    assert.ok(second.operation.id > first.operation.id);
    near(second.operation.startOffset, 10357.666666666666);
    near(
      second.operation.startOffset +
        second.amount -
        second.operation.startAmount,
      10457.666666666666
    );
  });
  await test('READ terminal clamp ACK arriving during next prepare uses bounded native basis', () => {
    const r = readRig();
    r.env.requestAdjust(r.ctx, 500, false);
    const apply = r.env.prepareMVCP(r.ctx, false);
    ackNative(r, 10357.666666666666);
    shifted(r, 100);
    apply();
    const signal = emitted(r);
    near(
      signal.operation.startOffset +
        signal.amount -
        signal.operation.startAmount,
      10457.666666666666
    );
  });
  await test('READ ordinary coincident target observation is not an operation ACK', () => {
    const r = readRig();
    r.env.requestAdjust(r.ctx, -50, false);
    const first = emitted(r);
    r.native(10326);
    r.env.requestAdjust(r.ctx, -38, false);
    assert.deepEqual(emitted(r).operation, first.operation);
  });
  for (const [name, change] of [
    ['older-amount', { amount: -50 }],
    ['wrong-basis', { startOffset: 9999 }],
    ['wrong-intent', { intent: 'B' }],
    ['older-operation', { operationId: 0 }],
  ])
    await test(`READ ${name} ACK cannot settle newer signal`, () => {
      const r = readRig();
      r.env.requestAdjust(r.ctx, -50, false);
      r.env.requestAdjust(r.ctx, -38, false);
      const current = emitted(r);
      ackNative(r, 10326, change);
      r.env.requestAdjust(r.ctx, -1, false);
      assert.deepEqual(emitted(r).operation, current.operation);
    });
  await test('READ exact owned ACK survives legacy negative-inset event filter without processing scroll', () => {
    const r = readRig();
    r.state.initialScroll = { viewPosition: 1 };
    r.state.nativeContentInset = { top: 0, bottom: 98, left: 0, right: 0 };
    r.env.requestAdjust(r.ctx, -11000, false);
    const signal = emitted(r);
    r.env.onScroll(r.ctx, {
      nativeEvent: {
        timestamp: 1,
        contentOffset: { x: 0, y: -20 },
        contentSize: { width: 402, height: r.state.totalSize },
        contentInset: { top: 20, bottom: 98, left: 0, right: 0 },
        nativeReadPointAdjustmentAck: {
          intent: signal.intent,
          operationId: signal.operation.id,
          startOffset: signal.operation.startOffset,
          startAmount: signal.operation.startAmount,
          amount: signal.amount,
          target: -20,
        },
      },
    });
    near(r.state.scroll, 10376);
    near(r.state.lastNativeScroll, 10376);
    r.env.requestAdjust(r.ctx, 100, false);
    const next = emitted(r);
    assert.ok(next.operation.id > signal.operation.id);
    near(next.operation.startOffset, -20);
    near(
      next.operation.startOffset + next.amount - next.operation.startAmount,
      80
    );
  });
  function published(r) {
    const pad = [
      'headerSize',
      'stylePaddingTop',
      'alignItemsAtEndPadding',
    ].reduce((n, k) => n + (r.values.get(k) || 0), 0);
    return new Map(
      [...r.state.containerItemKeys].map(([key, container]) => [
        key,
        {
          container,
          position: r.values.get(`containerPosition${container}`),
          y:
            r.values.get(`containerPosition${container}`) +
            pad -
            r.state.lastNativeScroll,
          height: r.state.sizesKnown.get(key),
        },
      ])
    );
  }
  const outgoing = (r) =>
    new Map(
      [...published(r)].filter(([, v]) => v.y < 573 && v.y + v.height > 0)
    );
  function preserve(r, before) {
    const after = published(r);
    for (const [key, row] of before) {
      assert.ok(after.has(key), `outgoing row removed ${key}`);
      near(after.get(key).y, row.y);
      assert.equal(after.get(key).container, row.container);
      assert.ok(
        after.get(key).y < 573 && after.get(key).y + after.get(key).height > 0,
        `outgoing row lost exposure ${key}`
      );
    }
  }
  function change(r, amount = 1714 + 1 / 3) {
    const key = r.keys[5];
    r.state.sizesKnown.set(key, 120 + amount);
    r.state.sizes.set(key, 120 + amount);
    r.state.minIndexSizeChanged = 5;
  }
  function pending(r, index = 10) {
    let available = false,
      status = 'pending',
      error;
    const handle = r.env.createImperativeHandle(r.ctx);
    const promise = handle.scrollToItem({
      item: r.state.props.data[index],
      viewPosition: 0.5,
      animated: false,
      getViewOffset: () => (available ? 0 : undefined),
    });
    promise.then(
      () => {
        status = 'resolved';
      },
      (value) => {
        status = 'rejected';
        error = value;
      }
    );
    return {
      promise,
      ready: () => {
        available = true;
      },
      status: () => status,
      error: () => error,
    };
  }
  async function dispatch(r, p) {
    p.ready();
    for (let frame = 0; frame < 10 && !r.dispatches.length; frame++) r.frame();
    await Promise.resolve();
    assert.equal(
      r.dispatches.length,
      1,
      'one absolute native dispatch; no pre-scroll'
    );
    assert.equal(p.status(), 'pending');
  }
  async function acknowledge(r, p, index = 10) {
    const desired = r.currentOffset(index);
    near(r.dispatches.at(-1).y, desired);
    r.native(desired);
    r.frame();
    await p.promise;
    assert.equal(p.status(), 'resolved');
    assert.equal(r.state.pendingScrollRequest, undefined);
    assert.equal(r.state.scrollingTo, undefined);
    const row = published(r).get(r.keys[index]);
    near(row.y + row.height / 2, 573 / 2);
  }
  await test('unmeasured destination window exhausts existing budget without any native dispatch', async () => {
    const r = rig();
    r.state.sizesKnown.delete(r.keys[9]);
    r.env.getItemSize = (ctx, key) =>
      ctx.state.sizesKnown.get(key) ?? ctx.state.sizes.get(key) ?? 120;
    const p = pending(r);
    p.ready();
    for (let i = 0; i < 60; i++) r.frame();
    await Promise.resolve();
    assert.equal(r.dispatches.length, 0);
    assert.equal(p.status(), 'rejected');
    assert.equal(p.error()?.code, 'LEGEND_SCROLL_UNALIGNED');
    assert.equal(r.state.pendingScrollRequest, undefined);
    assert.equal(r.state.scrollTargetPinnedRange, undefined);
  });
  await test('new target during destination window acquisition permanently cancels the outgoing request', async () => {
    const r = rig();
    r.state.sizesKnown.delete(r.keys[9]);
    r.env.getItemSize = (ctx, key) =>
      ctx.state.sizesKnown.get(key) ?? ctx.state.sizes.get(key) ?? 120;
    const old = pending(r);
    old.ready();
    r.frame();
    assert.equal(r.dispatches.length, 0);
    const next = pending(r, 20);
    await dispatch(r, next);
    await acknowledge(r, next, 20);
    for (let i = 0; i < 60; i++) r.frame();
    await Promise.resolve();
    assert.equal(r.dispatches.length, 1);
    assert.equal(old.status(), 'resolved');
  });
  await test('drag revision retires a waiting destination window and cannot dispatch on later measurement', async () => {
    const r = rig();
    r.state.sizesKnown.delete(r.keys[9]);
    r.env.getItemSize = (ctx, key) =>
      ctx.state.sizesKnown.get(key) ?? ctx.state.sizes.get(key) ?? 120;
    const p = pending(r);
    p.ready();
    r.frame();
    assert.equal(r.dispatches.length, 0);
    r.state.scrollCommandRevision++;
    r.state.sizesKnown.set(r.keys[9], 120);
    r.env.calculateItemsInView(r.ctx, { doMVCP: true });
    for (let i = 0; i < 60; i++) r.frame();
    assert.equal(r.dispatches.length, 0);
    assert.equal(r.state.pendingScrollRequest?.nativeAcquisition, undefined);
  });
  await test('destination predecessor measured after allocation cannot cause a second visible stop', async () => {
    const r = rig(),
      initial = r.state.lastNativeScroll,
      before = outgoing(r),
      predecessor = r.keys[9];
    // Known position/estimated size is not a measured native cell.
    r.state.sizesKnown.delete(predecessor);
    r.env.getItemSize = (ctx, key) =>
      ctx.state.sizesKnown.get(key) ?? ctx.state.sizes.get(key) ?? 120;
    const measured = new Set([...r.state.containerItemKeys.keys()]);
    let status = 'pending';
    const handle = r.env.createImperativeHandle(r.ctx);
    const promise = handle.scrollToItem({
      item: r.state.props.data[10],
      viewPosition: 0.5,
      animated: false,
      getViewOffset: () => (measured.has(r.keys[10]) ? 0 : undefined),
    });
    promise.then(
      () => (status = 'resolved'),
      () => (status = 'rejected')
    );
    const observations = [];
    for (let turn = 0; turn < 12 && r.dispatches.length === 0; turn++) {
      const newlyMounted = [...r.state.containerItemKeys.keys()].filter(
        (k) => !measured.has(k)
      );
      let changed = false;
      for (const key of newlyMounted) {
        measured.add(key);
        if (key === predecessor) {
          r.state.sizesKnown.set(key, 120 + 659 + 1 / 3);
          r.state.sizes.set(key, 120 + 659 + 1 / 3);
          r.state.minIndexSizeChanged = 9;
          changed = true;
        }
      }
      if (changed) r.env.calculateItemsInView(r.ctx, { doMVCP: true });
      observations.push({
        turn,
        measuredPredecessor: measured.has(predecessor),
        targetPosition: r.state.positions[10],
        dispatches: r.dispatches.length,
      });
      preserve(r, before);
      r.frame();
    }
    assert.equal(r.dispatches.length, 1);
    const first = r.dispatches[0];
    // Explicit subsequent native measurement: old source first allocates the
    // destination predecessor during dispatch. The actual estimate revision
    // is delivered here before the held native command's offset event.
    if (
      !measured.has(predecessor) &&
      r.state.containerItemKeys.has(predecessor)
    ) {
      measured.add(predecessor);
      r.state.sizesKnown.set(predecessor, 120 + 659 + 1 / 3);
      r.state.sizes.set(predecessor, 120 + 659 + 1 / 3);
      r.state.minIndexSizeChanged = 9;
      r.env.calculateItemsInView(r.ctx, { doMVCP: true });
    }
    near(r.state.lastNativeScroll, initial);
    assert.ok(
      measured.has(predecessor),
      'destination predecessor must actually be measured'
    );
    near(first.y, r.currentOffset(10));
    assert.equal(status, 'pending');
    r.native(first.y);
    r.frame();
    await promise;
    assert.equal(status, 'resolved');
    assert.equal(r.dispatches.length, 1, 'no second native stop');
    return { observations, first, ...r.snapshot() };
  });
  function readyMountedTarget(r, index = 81) {
    let status = 'pending',
      error;
    const promise = r.env.createImperativeHandle(r.ctx).scrollToItem({
      item: r.state.props.data[index],
      viewPosition: 0.5,
      animated: false,
      getViewOffset: () => 0,
    });
    promise.then(
      () => (status = 'resolved'),
      (e) => {
        status = 'rejected';
        error = e;
      }
    );
    return { promise, status: () => status, error: () => error };
  }
  function unknownCenterPredecessor(r) {
    const key = r.keys[78];
    r.state.sizesKnown.delete(key);
    r.env.getItemSize = (ctx, k) =>
      ctx.state.sizesKnown.get(k) ?? ctx.state.sizes.get(k) ?? 120;
    return key;
  }
  function measureCenterPredecessor(r, key) {
    r.state.sizesKnown.set(key, 622);
    r.state.sizes.set(key, 622);
    r.state.minIndexSizeChanged = 78;
    r.env.calculateItemsInView(r.ctx, { doMVCP: true });
  }
  await test('ready mounted center waits for newly allocated predecessor before its one native dispatch', async () => {
    const r = rig(),
      before = outgoing(r),
      key = unknownCenterPredecessor(r),
      initial = r.state.lastNativeScroll;
    assert.ok(r.state.containerItemKeys.has(r.keys[81]));
    const p = readyMountedTarget(r);
    let measured = false;
    // Deliberately withhold one native measurement across multiple JS frames.
    for (let turn = 0; turn < 12 && !r.dispatches.length; turn++) {
      if (turn >= 3 && r.state.containerItemKeys.has(key) && !measured) {
        measureCenterPredecessor(r, key);
        measured = true;
      }
      preserve(r, before);
      r.frame();
    }
    assert.equal(r.dispatches.length, 1);
    const first = r.dispatches[0];
    if (!measured && r.state.containerItemKeys.has(key)) {
      measureCenterPredecessor(r, key);
      measured = true;
    }
    assert.ok(measured, 'actual allocated predecessor measurement required');
    preserve(r, before);
    near(r.state.lastNativeScroll, initial);
    near(first.y, r.currentOffset(81));
    assert.equal(p.status(), 'pending');
    r.native(first.y);
    r.frame();
    await p.promise;
    assert.equal(p.status(), 'resolved');
    assert.equal(r.dispatches.length, 1);
    return { first, current: r.currentOffset(81), ...r.snapshot() };
  });
  await test('ready center cannot dispatch while its acquired predecessor remains unmeasured', async () => {
    const r = rig(),
      key = unknownCenterPredecessor(r),
      p = readyMountedTarget(r);
    for (let i = 0; i < 60; i++) r.frame();
    await Promise.resolve();
    assert.equal(r.dispatches.length, 0);
    assert.equal(p.status(), 'rejected');
    assert.equal(p.error()?.reason, 'target-geometry-unavailable');
    assert.equal(r.state.pendingScrollRequest, undefined);
    assert.equal(r.state.scrollTargetPinnedRange, undefined);
    assert.equal(r.state.sizesKnown.has(key), false);
  });
  await test('new target retires ready-center window before later predecessor measurement', async () => {
    const r = rig(),
      key = unknownCenterPredecessor(r),
      old = readyMountedTarget(r);
    r.frame();
    assert.equal(r.dispatches.length, 0);
    const next = pending(r, 20);
    await dispatch(r, next);
    await acknowledge(r, next, 20);
    measureCenterPredecessor(r, key);
    for (let i = 0; i < 60; i++) r.frame();
    await Promise.resolve();
    assert.equal(old.status(), 'resolved');
    assert.equal(r.dispatches.length, 1);
  });
  await test('drag invalidation retires ready-center window permanently', async () => {
    const r = rig(),
      key = unknownCenterPredecessor(r);
    readyMountedTarget(r);
    r.frame();
    assert.equal(r.dispatches.length, 0);
    r.state.scrollCommandRevision++;
    measureCenterPredecessor(r, key);
    for (let i = 0; i < 60; i++) r.frame();
    assert.equal(r.dispatches.length, 0);
    assert.equal(r.state.pendingScrollRequest?.nativeAcquisition, undefined);
  });
  await test('fully mounted measured center destination keeps immediate public dispatch', async () => {
    const r = rig(),
      p = readyMountedTarget(r, 85);
    assert.equal(r.dispatches.length, 1);
    near(r.dispatches[0].y, r.currentOffset(85));
    assert.equal(p.status(), 'pending');
    r.native(r.currentOffset(85));
    r.frame();
    await p.promise;
    assert.equal(p.status(), 'resolved');
  });
  await test('unchanged acquisition keeps outgoing geometry through one absolute dispatch and observed acknowledgement', async () => {
    const r = rig(),
      before = outgoing(r),
      initial = r.state.lastNativeScroll,
      p = pending(r);
    preserve(r, before);
    assert.equal(r.dispatches.length, 0);
    near(r.state.scroll, initial);
    await dispatch(r, p);
    preserve(r, before);
    near(r.state.lastNativeScroll, initial);
    await acknowledge(r, p);
    return { before: [...before], after: [...published(r)], ...r.snapshot() };
  });
  await test('target acquisition position rebuild preserves outgoing coordinates, not merely keys', async () => {
    const r = rig(),
      before = outgoing(r),
      initial = r.state.lastNativeScroll;
    r.beforeNextCalculation(() => change(r));
    const p = pending(r);
    assert.ok(r.state.positions[85] - before.get(r.keys[85]).position > 1714);
    assert.equal(r.dispatches.length, 0);
    near(r.state.lastNativeScroll, initial);
    preserve(r, before);
    assert.equal(r.state.scrollAdjustHandler.appliedAdjust, 0);
    await dispatch(r, p);
    preserve(r, before);
    await acknowledge(r, p);
    return { before: [...before], after: [...published(r)], ...r.snapshot() };
  });
  await test('later size pass while acquisition waits cannot shift the native outgoing rows', async () => {
    const r = rig(),
      before = outgoing(r),
      p = pending(r);
    change(r);
    r.env.calculateItemsInView(r.ctx, { doMVCP: true });
    preserve(r, before);
    assert.equal(r.state.scrollAdjustHandler.appliedAdjust, 0);
    assert.equal(r.dispatches.length, 0);
    await dispatch(r, p);
    preserve(r, before);
    await acknowledge(r, p);
  });
  await test('parent header/padding coordinates are retained exactly during acquisition', async () => {
    const r = rig();
    r.values.set('headerSize', 31);
    r.values.set('stylePaddingTop', 17);
    const before = outgoing(r);
    r.beforeNextCalculation(() => change(r));
    const p = pending(r);
    preserve(r, before);
    assert.equal(r.dispatches.length, 0);
    p.ready();
  });
  await test('new target accepted reentrantly prevents old acquisition and its queued checks from dispatching', async () => {
    const r = rig();
    let replacement;
    r.beforeNextCalculation(() => {
      replacement = pending(r, 50);
    });
    const old = pending(r);
    await dispatch(r, replacement);
    near(r.dispatches[0].y, r.currentOffset(50));
    await acknowledge(r, replacement, 50);
    r.frame();
    assert.equal(r.dispatches.length, 1);
    assert.equal(r.state.pendingScrollRequest, undefined);
  });
  await test('drag cancellation during acquisition cannot freeze or dispatch old geometry', async () => {
    const r = rig();
    r.beforeNextCalculation(() => {
      r.state.scrollCommandRevision++;
      r.state.scrollingTo = undefined;
      r.state.scrollTargetPinnedRange = undefined;
      change(r);
    });
    pending(r);
    r.frame();
    r.frame();
    assert.equal(r.dispatches.length, 0);
    for (const [key, row] of published(r)) {
      const i = r.state.indexByKey.get(key);
      near(row.position, r.state.positions[i]);
    }
  });
  await test('removed outgoing key is not retained or revived if reinserted during the same request', async () => {
    const r = rig(),
      before = outgoing(r),
      p = pending(r),
      key = [...before.keys()][0],
      item = r.state.props.data.find((x) => x.id === key);
    r.state.props.data = r.state.props.data.filter((x) => x.id !== key);
    r.env.calculateItemsInView(r.ctx, { dataChanged: true, doMVCP: true });
    assert.ok(!r.state.containerItemKeys.has(key));
    r.state.props.data = [...r.state.props.data, item];
    r.env.calculateItemsInView(r.ctx, { dataChanged: true, doMVCP: true });
    const restored = published(r).get(key);
    if (restored)
      near(restored.position, r.state.positions[r.state.indexByKey.get(key)]);
    assert.equal(r.dispatches.length, 0);
    p.ready();
  });
  await test('target removal rejects owned acquisition and releases row positions without success', async () => {
    const r = rig(),
      p = pending(r);
    change(r);
    r.env.calculateItemsInView(r.ctx, { doMVCP: true });
    r.state.props.data = r.state.props.data.filter((x) => x.id !== r.keys[10]);
    r.env.calculateItemsInView(r.ctx, { dataChanged: true, doMVCP: true });
    for (let i = 0; i < 52; i++) r.frame();
    await Promise.resolve();
    assert.equal(p.status(), 'rejected');
    assert.equal(p.error().reason, 'target-missing');
    assert.equal(r.state.pendingScrollRequest, undefined);
    assert.equal(r.dispatches.length, 0);
    for (const [key, row] of published(r))
      near(row.position, r.state.positions[r.state.indexByKey.get(key)]);
  });
  await test('unavailable timeout releases frozen positions and cannot finish readiness', async () => {
    const r = rig(),
      p = pending(r);
    change(r);
    r.env.calculateItemsInView(r.ctx, { doMVCP: true });
    for (let i = 0; i < 52; i++) r.frame();
    await Promise.resolve();
    assert.equal(p.status(), 'rejected');
    assert.equal(p.error().code, 'LEGEND_SCROLL_UNALIGNED');
    assert.equal(r.state.pendingScrollRequest, undefined);
    assert.equal(r.dispatches.length, 0);
    for (const [key, row] of published(r))
      near(row.position, r.state.positions[r.state.indexByKey.get(key)]);
  });
  await test('physical container generation change cannot reuse an old position hold', () => {
    const r = rig(),
      before = outgoing(r);
    pending(r);
    change(r);
    const [key, row] = [...before][0];
    r.state.containerItemGenerations[row.container] =
      (r.state.containerItemGenerations[row.container] || 0) + 1;
    r.env.calculateItemsInView(r.ctx, { doMVCP: true });
    const current = published(r).get(key);
    if (current)
      near(current.position, r.state.positions[r.state.indexByKey.get(key)]);
  });
  await test('direct newer command retires acquisition positions and stale pending frames', () => {
    const r = rig();
    pending(r);
    change(r);
    r.env.calculateItemsInView(r.ctx, { doMVCP: true });
    r.command(50);
    r.frame();
    r.frame();
    assert.equal(r.dispatches.length, 1);
    near(r.dispatches[0].y, r.currentOffset(50));
    assert.equal(r.state.pendingScrollRequest?.nativeAcquisition, undefined);
    for (const [key, row] of published(r))
      near(row.position, r.state.positions[r.state.indexByKey.get(key)]);
  });
  await test('native host detach releases acquisition; replacement host cannot adopt old held positions', async () => {
    const r = rig(),
      p = pending(r);
    change(r);
    r.env.calculateItemsInView(r.ctx, { doMVCP: true });
    r.state.refScroller.current = null;
    for (let i = 0; i < 52; i++) r.frame();
    await Promise.resolve();
    assert.equal(p.status(), 'rejected');
    assert.equal(p.error().reason, 'target-unmounted');
    assert.equal(r.state.pendingScrollRequest, undefined);
    assert.equal(r.dispatches.length, 0);
    r.state.refScroller.current = {
      scrollTo: () => {
        throw Error('old request revived');
      },
    };
    r.env.calculateItemsInView(r.ctx, { forceFullItemPositions: true });
    r.frame();
    for (const [key, row] of published(r))
      near(row.position, r.state.positions[r.state.indexByKey.get(key)]);
  });
  await test('parent padding change cannot move held native coordinates while internal geometry updates', () => {
    const r = rig(),
      before = outgoing(r);
    pending(r);
    r.values.set('headerSize', 29);
    r.values.set('stylePaddingTop', 13);
    change(r);
    r.env.calculateItemsInView(r.ctx, { doMVCP: true });
    preserve(r, before);
    assert.equal(r.dispatches.length, 0);
  });
  for (const os of ['android', 'web'])
    await test(`${os} direct API retains its original dispatch semantics`, async () => {
      const r = rig(os),
        p = pending(r);
      assert.equal(r.dispatches.length, 1);
      p.ready();
      assert.equal(r.state.pendingScrollRequest?.nativeAcquisition, undefined);
    });
  // Actual native component/store bodies with actual React batching. Only the
  // native Animated.Value delivery is modeled: its attached height is visible
  // immediately, while host props change only after the held React commit.
  const componentNames = [
    'ContainersLayer',
    'PositionViewState',
    'useAnimatedValue',
    'ContextState',
    'SIGNAL_NAMES_SEPARATOR',
  ];
  const componentNodes = componentNames.map((name) => {
    const matches = source.tree.body.filter(
      (node) =>
        node.type === 'VariableDeclaration' &&
        node.declarations.some((d) => d.id.name === name)
    );
    assert.equal(matches.length, 1, `Missing actual component ${name}`);
    return matches[0];
  });
  const componentFunctions = new Set();
  function addComponentFunction(name) {
    if (
      name === 'useStateContext' ||
      !declarations.has(name) ||
      componentFunctions.has(name)
    )
      return;
    componentFunctions.add(name);
    visit(declarations.get(name), addComponentFunction);
  }
  componentNodes.forEach((node) => visit(node, addComponentFunction));
  const componentBodies = [...componentFunctions]
    .map((name) => declarations.get(name))
    .concat(componentNodes)
    .sort((a, b) => a.start - b.start)
    .map((node) => source.text.slice(node.start, node.end))
    .join('\n');
  async function publication(kind, fabric = true, horizontal = false) {
    const r = rig();
    r.env.IsNewArchitecture = fabric;
    r.state.props.horizontal = horizontal;
    // Use the actual publisher rather than this runner's peripheral size stub.
    r.env.getAlignItemsAtEndPadding = () => 0;
    vm.runInContext(
      ['addTotalSize', 'updateContentMetricsState']
        .map((name) => {
          const node = declarations.get(name);
          assert(node);
          return source.text.slice(node.start, node.end);
        })
        .join('\n'),
      r.env
    );
    r.state.sizesKnown.set(r.keys[85], 129 + 2 / 3);
    r.state.sizes.set(r.keys[85], 129 + 2 / 3);
    r.env.calculateItemsInView(r.ctx, { dataChanged: true });
    const key = r.keys[87],
      id = r.state.containerItemKeys.get(key);
    class NativeAnimatedValue {
      constructor(value) {
        this.value = value;
      }
      setValue(value) {
        this.value = value;
      }
    }
    const env = {
      ...React,
      ...shim,
      React2: React,
      React2__namespace: React,
      React,
      React__namespace: React,
      Animated: { Value: NativeAnimatedValue, View: 'AnimatedView' },
      View: 'NativeView',
      View$1: 'NativeView',
      ReactNative: {
        Animated: { Value: NativeAnimatedValue, View: 'AnimatedView' },
        View: 'NativeView',
      },
      typedMemo: React.memo,
      shim,
      IsNewArchitecture: fabric,
      useStateContext: () => r.ctx,
      ContainerLayoutCoordinator: React.Fragment,
      POSITION_OUT_OF_VIEW: -1e7,
    };
    vm.createContext(env);
    vm.runInContext(componentBodies, env);
    let tree;
    const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await Renderer.act(async () => {
        tree = Renderer.create(
          React.createElement(
            env.ContextState.Provider,
            { value: r.ctx },
            React.createElement(
              env.ContainersLayer,
              { horizontal },
              React.createElement(env.PositionViewState, {
                id,
                horizontal,
                style: {},
                testID: 'surviving-row',
              })
            )
          )
        );
      });
      function nativeFrame() {
        const size =
          tree.root.findByType('AnimatedView').props.style[
            horizontal ? 'width' : 'height'
          ];
        const row = tree.root.findByType('NativeView').props.style;
        return {
          extent: typeof size === 'number' ? size : size.value,
          position: row.at(-1)[horizontal ? 'left' : 'top'],
        };
      }
      const before = nativeFrame(),
        observed = [];
      const listener = () => observed.push(nativeFrame());
      r.ctx.listeners.get('totalSize').add(listener);
      r.env.batchedUpdates = Renderer.unstable_batchedUpdates;
      await Renderer.act(async () => {
        if (kind === 'remove') {
          r.state.previousData = r.state.props.data;
          r.state.props.data = r.state.props.data.filter(
            (item) => item.id !== r.keys[85]
          );
          r.env.calculateItemsInView(r.ctx, { dataChanged: true });
        } else if (kind === 'append') {
          const next = { id: 'new-tail' };
          r.state.sizesKnown.set(next.id, 76);
          r.state.sizes.set(next.id, 76);
          r.state.props.data = [...r.state.props.data, next];
          r.env.calculateItemsInView(r.ctx, { dataChanged: true });
        } else {
          r.state.sizesKnown.set(r.keys[85], 173);
          r.state.sizes.set(r.keys[85], 173);
          r.state.minIndexSizeChanged = 85;
          r.env.calculateItemsInView(r.ctx, { doMVCP: false });
        }
        observed.push(nativeFrame());
      });
      const after = nativeFrame();
      r.ctx.listeners.get('totalSize').delete(listener);
      assert.equal(
        r.values.get(`containerItemKey${id}`),
        key,
        'Actual surviving container ownership must remain current'
      );
      assert.equal(after.extent, r.values.get('totalSize'));
      assert.equal(
        after.position,
        r.state.positions[r.state.indexByKey.get(key)]
      );
      assert(observed.length > 0, 'Actual extent signal must publish');
      return { before, observed, after, key, dispatches: r.dispatches.length };
    } finally {
      if (tree) await Renderer.act(async () => tree.unmount());
      globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
    }
  }
  for (const kind of ['remove', 'append', 'size'])
    await test(`Fabric ${kind} commits extent with current surviving positions`, async () => {
      const result = await publication(kind);
      if (kind !== 'append')
        assert.notEqual(result.before.position, result.after.position);
      assert.notEqual(result.before.extent, result.after.extent);
      if (kind === 'append') {
        assert(
          result.observed.every(
            (frame) => frame.position === result.before.position
          )
        );
        assert.equal(result.after.extent - result.before.extent, 76);
      } else
        assert(
          result.observed.every(
            (frame) =>
              frame.extent === result.before.extent &&
              frame.position === result.before.position
          ),
          `New extent escaped the held React commit: ${JSON.stringify(result)}`
        );
      return result;
    });
  await test('Fabric horizontal removal shares width and position commit', async () => {
    const result = await publication('remove', true, true);
    assert.notEqual(result.before.position, result.after.position);
    assert(
      result.observed.every(
        (frame) =>
          frame.extent === result.before.extent &&
          frame.position === result.before.position
      ),
      `New width escaped the held React commit: ${JSON.stringify(result)}`
    );
    return result;
  });
  await test('Legacy native extent retains its existing Animated delivery', async () => {
    const result = await publication('remove', false);
    assert(
      result.observed.some(
        (frame) =>
          frame.extent === result.after.extent &&
          frame.position === result.before.position
      )
    );
    return result;
  });
  return {
    results,
    extractedFunctions: [...selected].sort(),
    extractedHash: sha256(bodies),
    publicationComponentHash: sha256(componentBodies),
    modeledBoundaries: [...boundaries].sort(),
  };
});
