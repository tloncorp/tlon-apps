/**
 * Node22+: node scripts/test-legend-keyed-target.mjs [--source-dir DIR] [--report FILE].
 * Defaults to both installed native bundles resolved from the invocation cwd.
 * iOS keyed item identity controls; numeric/non-iOS compatibility remains explicit.
 * Native events, scheduling and peripheral rendering are modeled, not presentation proof.
 */
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {
  extractDeclarations,
  extractReprocessAssignment,
  runInstalledControls,
  sha256,
} from './lib/legend-source-controls.mjs';
await runInstalledControls('legend-keyed-target', async (source) => {
  const core = extractDeclarations(source, {
    functions: [
      'checkStructuralDataChange',
      'resetLayoutCachesForDataChange',
      'updateItemPositions',
      'updateTotalSize',
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
    ].concat([
      'pinScrollTargetRenderRange',
      'getTargetViewportRenderRange',
      'getItemBottom',
      'findPositionIndexAtOrBeforeOffset',
    ]),
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
  const bodies = core.bodies + '\n\n' + keyed.bodies + '\n\n' + dynamic.bodies;
  const names = [...core.names, ...keyed.names, ...dynamic.names];
  const assignment = extractReprocessAssignment(source);
  // Extract the component's actual normalizer, props fields and data-change
  // decision. Do not replace the normalized default extractor with undefined.
  const nodes = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    nodes.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(source.tree);
  const normalizers = nodes.filter(
    (node) =>
      node.type === 'VariableDeclarator' &&
      node.id.name === 'keyExtractor' &&
      node.init &&
      source.text
        .slice(node.init.start, node.init.end)
        .includes('keyExtractorProp')
  );
  assert.equal(normalizers.length, 1);
  const normalizer = source.text.slice(
    normalizers[0].init.start,
    normalizers[0].init.end
  );
  const assignments = nodes.filter(
    (node) =>
      node.type === 'AssignmentExpression' &&
      node.left.type === 'MemberExpression' &&
      node.left.object.name === 'state' &&
      node.left.property.name === 'props' &&
      node.right.type === 'ObjectExpression'
  );
  assert.equal(assignments.length, 1);
  const properties = assignments[0].right.properties.filter((prop) =>
    ['keyExtractor', 'keyExtractorProvided'].includes(prop.key.name)
  );
  assert.equal(
    properties.filter((prop) => prop.key.name === 'keyExtractor').length,
    1
  );
  const extractorProps = properties
    .map((prop) => source.text.slice(prop.start, prop.end))
    .join(',');
  const decisionStart = source.text.indexOf(
    '  const didDataReferenceChangeLocal ='
  );
  const decisionEnd = source.text.indexOf(
    '  const shouldResetFreshDataLayout =',
    decisionStart
  );
  assert.ok(decisionStart >= 0 && decisionEnd > decisionStart);
  const dataDecision = source.text.slice(decisionStart, decisionEnd);
  const renderFragments = { normalizer, extractorProps, dataDecision };
  function publishRenderProps(r, data, options = {}) {
    const { state, env } = r;
    env.state = state;
    env.dataProp = data;
    env.dataKey = 'dataKey' in options ? options.dataKey : state.props.dataKey;
    env.dataVersion =
      'dataVersion' in options ? options.dataVersion : state.props.dataVersion;
    env.keyExtractorProp =
      'keyExtractorProp' in options
        ? options.keyExtractorProp
        : r.explicitExtractor;
    env.useWrapIfItem = (value) => value; // This corpus uses ordinary unwrapped items.
    vm.runInContext(
      `{ const keyExtractor = ${normalizer}; ${dataDecision}
      globalThis.renderDecision={didDataChangeLocal,didDataReferenceChangeLocal,didDataKeyChangeLocal,didDataVersionChangeLocal};
      state.props={...state.props,data:dataProp,dataKey,dataVersion,${extractorProps}};
    }`,
      env
    );
    return env.renderDecision;
  }
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
      { length: 90 },
      (_, i) => `scroll-fixture-${i + 30}`
    );
    const state = {
      props: {
        data: keys.map((id) => ({ id })),
        keyExtractor: (x) => x.id,
        maintainVisibleContentPosition: { data: true, size: true },
        horizontal: false,
        maintainScrollAtEnd: false,
      },
      columns: [],
      columnSpans: [],
      positions: keys.map((_, i) => i * 120),
      idCache: keys,
      indexByKey: new Map(keys.map((key, i) => [key, i])),
      idsInView: [keys[80], keys[81]],
      sizes: new Map(keys.map((key) => [key, 120])),
      sizesKnown: new Map(keys.map((key) => [key, 120])),
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
            nativeCalls.push({ ...args });
          },
        },
      },
      pendingScrollResolve: () => resolved++,
      pendingScrollReject: (error) =>
        rejected.push({ message: error.message, code: error.code }),
    };
    state.positions[81] = 9720;
    const values = new Map([
      ['readyToRender', true],
      ['footerSize', 0],
    ]);
    const ctx = { state, values, positionListeners: new Map() };
    state.triggerCalculateItemsInView = (params) =>
      calculations.push({
        scroll: state.scroll,
        pending: state.scrollPending,
        native: state.lastNativeScroll,
        params,
      });
    const env = {
      IS_DEV: false,
      Platform: { OS: os },
      PlatformAdjustBreaksScroll: os === 'android',
      IsNewArchitecture: true,
      Date: { now: () => now },
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
        timers.set(id, { fn, due: now + delay });
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
        c.state.scrollTargetPinnedRange = { offset, index };
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
      addTotalSize: (c, _item, total) => {
        c.state.totalSize = total;
      },
      finishInitialScroll: (_ctx, options) => {
        state.initialScroll = undefined;
        state.didFinishInitialScroll = true;
        options?.onFinished?.();
      },
      areKnownOrFixedItemSizesAvailable: () => true,
    };
    vm.createContext(env);
    vm.runInContext(bodies, env);
    state.scrollAdjustHandler = new env.ScrollAdjustHandler(ctx);
    env.internalState = state;
    env.ctx = ctx;
    vm.runInContext(assignment, env);
    const explicitExtractor = state.props.keyExtractor;
    publishRenderProps({ state, env, explicitExtractor }, state.props.data);
    const snapshot = () => ({
      scroll: state.scroll,
      pending: state.scrollPending,
      native: state.lastNativeScroll,
      target: state.scrollingTo ? { ...state.scrollingTo } : null,
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
      explicitExtractor,
      raf,
      timers,
      calculations,
      snapshot,
      command() {
        env.scrollTo(ctx, {
          index: 81,
          itemSize: 120,
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
            contentOffset: { x: 0, y: value },
            contentSize: { width: 402, height: state.totalSize },
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
  const tick = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  function outcome(promise) {
    const o = { resolved: 0, rejected: 0, code: null, reason: null, key: null };
    promise.then(
      () => o.resolved++,
      (e) => {
        o.rejected++;
        o.code = e.code ?? null;
        o.reason = e.reason ?? null;
        o.key = e.key ?? null;
      }
    );
    return o;
  }
  async function test(name, fn) {
    try {
      results.push({ name, status: 'PASS', evidence: await fn() });
    } catch (e) {
      results.push({
        name,
        status: 'FAIL',
        error: e.message,
        evidence: e.evidence,
      });
    }
  }
  function accepted(value, message, evidence) {
    if (!value) {
      const e = new Error(message);
      e.evidence = evidence;
      throw e;
    }
  }
  function initialize(r) {
    r.state.testInset = 0;
    r.state.scrollLength = 600;
    r.env.resetLayoutCachesForDataChange(r.state);
    r.env.updateItemPositions(r.ctx, true, { doMVCP: false, startIndex: 0 });
    r.state.scroll =
      r.state.scrollPending =
      r.state.lastNativeScroll =
        r.state.totalSize - r.state.scrollLength;
  }
  function mutate(r, kind) {
    const old = r.state.props.data,
      data = [...old];
    if (kind === 'prepend') {
      const extra = { id: 'prepended' };
      r.state.sizesKnown.set(extra.id, 120);
      data.unshift(extra);
    }
    if (kind === 'remove-before') data.splice(30, 1);
    if (kind === 'reorder') [data[81], data[75]] = [data[75], data[81]];
    if (kind === 'remove-target') data.splice(81, 1);
    if (kind === 'append') {
      const extra = { id: 'appended' };
      r.state.sizesKnown.set(extra.id, 120);
      data.push(extra);
    }
    if (kind === 'revise-objects')
      for (let i = 0; i < data.length; i++)
        data[i] = { ...data[i], revision: 2 };
    // Installed render publishes new props before calculateItemsInView.
    r.state.previousData = old;
    r.state.props.data = data;
    r.state.didDataChange = true;
    const apply = r.env.prepareMVCP(r.ctx, true);
    r.env.resetLayoutCachesForDataChange(r.state);
    r.env.updateItemPositions(r.ctx, true, {
      doMVCP: true,
      forceFullUpdate: true,
      startIndex: 0,
    });
    apply?.();
    r.state.didDataChange = false;
  }
  function pointAt(r, index) {
    return r.env.clampScrollOffset(
      r.ctx,
      r.env.calculateOffsetWithOffsetPosition(r.ctx, r.state.positions[index], {
        index,
        itemSize: r.state.sizesKnown.get(r.state.props.data[index]?.id),
        viewPosition: 0.5,
        viewOffset: 0,
      })
    );
  }
  function evidence(r, o, requestedId, index) {
    const keyIndex = r.state.indexByKey.get(requestedId),
      numericId = r.state.props.data[index]?.id ?? null;
    const currentRequestedPoint =
      keyIndex === undefined ? null : pointAt(r, keyIndex);
    return {
      requestedId,
      originalIndex: index,
      currentKeyIndex: keyIndex ?? null,
      occupantAtNumericIndex: numericId,
      currentRequestedPoint,
      nativeOffset: r.state.lastNativeScroll,
      keyLandingError:
        currentRequestedPoint === null
          ? null
          : Math.abs(currentRequestedPoint - r.state.lastNativeScroll),
      promise: o,
      state: r.snapshot(),
    };
  }

  function issue(r, index = 81) {
    const h = r.handle();
    const item = r.state.props.data[index];
    const o = outcome(
      h.scrollToItem({ item, viewPosition: 0.5, animated: false })
    );
    return { h, item, o };
  }
  function settleDispatch(r) {
    for (let i = 0; i < 6 && !r.state.scrollingTo; i++) {
      if (r.timers.size) r.timer();
      r.frame();
    }
  }
  function rebuild(r) {
    const apply = r.env.prepareMVCP(r.ctx, true);
    r.env.resetLayoutCachesForDataChange(r.state);
    r.env.updateItemPositions(r.ctx, true, {
      doMVCP: true,
      forceFullUpdate: true,
      startIndex: 0,
    });
    apply?.();
    r.state.didDataChange = false;
  }
  for (const kind of ['prepend', 'remove-before', 'reorder'])
    await test(`active item ${kind}: rebind, reject neighbor completion, land requested key and pin it`, async () => {
      const r = rig();
      initialize(r);
      const { item, o } = issue(r);
      mutate(r, kind);
      const index = r.state.indexByKey.get(item.id);
      const before = { ...r.state.scrollingTo },
        pin = { ...r.state.scrollTargetPinnedRange };
      accepted(
        before.index === index,
        'keyed target keeps stale numeric index after data rebuild',
        { before, index, pin }
      );
      assert.ok(
        pin.start <= index && pin.end >= index,
        'actual pinned render range includes moved key'
      );
      r.native(pointAt(r, 81));
      r.frame();
      await tick();
      assert.equal(
        o.resolved,
        0,
        'native observation centered at stale numeric index must not complete keyed command'
      );
      r.native(pointAt(r, index));
      r.frame();
      await tick();
      assert.equal(o.resolved, 1);
      assert.equal(o.rejected, 0);
      return { before, pin, ...evidence(r, o, item.id, 81) };
    });
  for (const kind of ['append', 'revise-objects'])
    await test(`active item ${kind} remains valid`, async () => {
      const r = rig();
      initialize(r);
      const { item, o } = issue(r);
      mutate(r, kind);
      r.native(pointAt(r, 81));
      r.frame();
      await tick();
      assert.equal(o.resolved, 1);
      assert.equal(o.rejected, 0);
      return evidence(r, o, item.id, 81);
    });
  await test('active target removal rejects once and never centers successor as success', async () => {
    const r = rig();
    initialize(r);
    const { item, o } = issue(r);
    mutate(r, 'remove-target');
    r.native(pointAt(r, 81));
    r.frame();
    await tick();
    if (!o.rejected && r.timers.size) {
      r.timer();
      await tick();
    }
    assert.equal(o.resolved, 0);
    assert.equal(o.rejected, 1);
    assert.equal(o.reason, 'target-missing');
    assert.equal(o.key, item.id);
    assert.equal(r.state.scrollingTo, undefined);
    assert.equal(r.state.scrollTargetPinnedRange, undefined);
    assert.equal(r.state.pendingScrollResolve, undefined);
    assert.equal(r.state.pendingScrollReject, undefined);
    return evidence(r, o, item.id, 81);
  });
  await test('removed then restored key does not revive the failed old target; fresh request works', async () => {
    const r = rig();
    initialize(r);
    const { item, o } = issue(r);
    mutate(r, 'remove-target');
    r.state.props.data = [
      ...r.state.props.data.slice(0, 81),
      item,
      ...r.state.props.data.slice(81),
    ];
    rebuild(r);
    r.native(pointAt(r, 81));
    r.frame();
    await tick();
    if (!o.rejected && r.timers.size) {
      r.timer();
      await tick();
    }
    assert.equal(o.rejected, 1);
    assert.equal(o.resolved, 0);
    const next = issue(r);
    r.native(pointAt(r, 81));
    r.frame();
    await tick();
    assert.equal(next.o.resolved, 1);
    return { o, next: next.o };
  });
  for (const kind of ['prepend', 'reorder', 'revise-objects'])
    await test(`deferred item ${kind}: accepted key resolves current object/index`, async () => {
      const r = rig();
      initialize(r);
      r.state.didDataChange = true;
      const { item, o } = issue(r);
      mutate(r, kind);
      settleDispatch(r);
      const index = r.state.indexByKey.get(item.id);
      assert.equal(r.state.scrollingTo?.index, index);
      r.native(pointAt(r, index));
      r.frame();
      await tick();
      assert.equal(o.resolved, 1);
      assert.equal(o.rejected, 0);
      return evidence(r, o, item.id, 81);
    });
  await test('deferred item removed before dispatch rejects without native call', async () => {
    const r = rig();
    initialize(r);
    r.state.didDataChange = true;
    const { item, o } = issue(r);
    mutate(r, 'remove-target');
    settleDispatch(r);
    await tick();
    assert.equal(o.resolved, 0);
    assert.equal(o.rejected, 1);
    assert.equal(o.reason, 'target-missing');
    assert.equal(o.key, item.id);
    assert.equal(r.snapshot().nativeCalls.length, 0);
    return { o, state: r.snapshot() };
  });
  await test('item absent at acceptance rejects rather than successful no-start', async () => {
    const r = rig();
    initialize(r);
    const h = r.handle();
    const o = outcome(
      h.scrollToItem({
        item: { id: 'absent' },
        viewPosition: 0.5,
        animated: false,
      })
    );
    await tick();
    assert.equal(o.resolved, 0);
    assert.equal(o.rejected, 1);
    assert.equal(o.reason, 'target-missing');
    assert.equal(r.snapshot().nativeCalls.length, 0);
    return { o };
  });
  await test('new props before rebuilt caches cannot certify old native offset', async () => {
    const r = rig();
    initialize(r);
    const { item, o } = issue(r);
    const oldPoint = pointAt(r, 81);
    const extra = { id: 'prepended' };
    r.state.sizesKnown.set(extra.id, 120);
    r.state.props.data = [extra, ...r.state.props.data];
    r.state.didDataChange = true;
    r.native(oldPoint);
    r.frame();
    await tick();
    assert.equal(o.resolved, 0);
    assert.equal(o.rejected, 0);
    rebuild(r);
    r.native(pointAt(r, 82));
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return evidence(r, o, item.id, 81);
  });
  await test('uncommitted keyed geometry is bounded and does not dispatch guessed index after settle timeout', async () => {
    const r = rig();
    initialize(r);
    const extra = { id: 'prepended' };
    r.state.sizesKnown.set(extra.id, 120);
    r.state.props.data = [extra, ...r.state.props.data];
    r.state.didDataChange = true;
    const { item, o } = issue(r, 82);
    for (let i = 0; i < 60 && !o.rejected; i++) {
      r.frame();
      await tick();
    }
    assert.equal(o.resolved, 0);
    assert.equal(o.rejected, 1);
    assert.equal(o.reason, 'target-geometry-unavailable');
    assert.equal(r.snapshot().nativeCalls.length, 0);
    return { o };
  });
  await test('same-array dataVersion invalidates old geometry until rebuild', async () => {
    const r = rig();
    initialize(r);
    const { item, o } = issue(r);
    const old = pointAt(r, 81);
    r.state.props.dataVersion = 1;
    [r.state.props.data[81], r.state.props.data[75]] = [
      r.state.props.data[75],
      r.state.props.data[81],
    ];
    r.state.didDataChange = true;
    r.native(old);
    r.frame();
    await tick();
    assert.equal(o.resolved, 0);
    rebuild(r);
    r.native(pointAt(r, 75));
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return evidence(r, o, item.id, 81);
  });
  await test('moved keyed retry uses current row size and inset at current index', async () => {
    const r = rig();
    initialize(r);
    const { item, o } = issue(r);
    mutate(r, 'prepend');
    r.state.sizesKnown.set(item.id, 200);
    r.state.testInset = 80;
    rebuild(r);
    const target = pointAt(r, 82);
    for (let i = 0; i < 3 && r.snapshot().nativeCalls.at(-1).y !== target; i++)
      r.timer();
    assert.equal(r.snapshot().nativeCalls.at(-1).y, target);
    r.native(target);
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { target, o };
  });
  await test('unaligned keyed target retains bounded rejection after retries', async () => {
    const r = rig();
    initialize(r);
    const { o } = issue(r);
    for (let i = 0; i < 9 && !o.rejected && r.timers.size; i++) {
      r.timer();
      await tick();
    }
    assert.equal(o.resolved, 0);
    assert.equal(o.rejected, 1);
    assert.equal(o.code, 'LEGEND_SCROLL_UNALIGNED');
    assert.equal(o.reason, 'target-unaligned');
    return { o, calls: r.snapshot().nativeCalls.length };
  });
  await test('deleted old key timer cannot reject newer accepted key', async () => {
    const r = rig();
    initialize(r);
    const old = issue(r);
    const oldTimers = [...r.timers.values()];
    mutate(r, 'remove-target');
    const next = issue(r, 75);
    settleDispatch(r);
    const target = r.state.scrollingTo;
    oldTimers.forEach((x) => x.fn());
    await tick();
    assert.equal(r.state.scrollingTo, target);
    assert.equal(next.o.rejected, 0);
    r.native(pointAt(r, 75));
    r.frame();
    await tick();
    assert.equal(next.o.resolved, 1);
    return { old: old.o, next: next.o };
  });
  for (const kind of ['prepend', 'remove-before', 'reorder', 'remove-target'])
    await test(`numeric scrollToIndex ${kind} preserves numeric API meaning`, async () => {
      const r = rig();
      initialize(r);
      const h = r.handle(),
        o = outcome(
          h.scrollToIndex({ index: 81, viewPosition: 0.5, animated: false })
        );
      mutate(r, kind);
      assert.equal(r.state.scrollingTo.index, 81);
      assert.equal(r.state.scrollingTo.keyedTarget, undefined);
      r.native(pointAt(r, 81));
      r.frame();
      await tick();
      assert.equal(o.resolved, 1);
      assert.equal(o.rejected, 0);
      return { o };
    });
  for (const os of ['android', 'web'])
    await test(`${os} scrollToItem retains existing active numeric semantics`, async () => {
      const r = rig(os);
      initialize(r);
      const { item, o } = issue(r);
      mutate(r, 'prepend');
      assert.equal(r.state.scrollingTo.index, 81);
      assert.equal(r.state.scrollingTo.keyedTarget, undefined);
      r.native(pointAt(r, 81));
      r.frame();
      await tick();
      assert.equal(o.resolved, 1);
      return evidence(r, o, item.id, 81);
    });

  await test('iOS item without explicit keyExtractor preserves legacy numeric behavior', async () => {
    const r = rig();
    publishRenderProps(r, r.state.props.data, { keyExtractorProp: undefined });
    r.state.sizesKnown = new Map(
      r.state.props.data.map((_, i) => [String(i), 120])
    );
    initialize(r);
    const { o } = issue(r);
    assert.equal(r.state.scrollingTo.keyedTarget, undefined);
    r.native(pointAt(r, 81));
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { o };
  });
  await test('keyed origin honors legal clamp without moving to adjacent item', async () => {
    const r = rig();
    initialize(r);
    const { o } = issue(r, 0);
    r.native(0);
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    assert.equal(o.rejected, 0);
    return { o };
  });
  await test('keyed last item stays that key after append instead of becoming new end', async () => {
    const r = rig();
    initialize(r);
    const h = r.handle(),
      item = r.state.props.data.at(-1);
    const o = outcome(
      h.scrollToItem({ item, viewPosition: 1, animated: false })
    );
    mutate(r, 'append');
    assert.equal(r.state.scrollingTo.index, 89);
    const target = r.env.getCurrentTargetOffset(r.ctx, r.state.scrollingTo);
    assert.equal(target, 10200);
    r.native(10320);
    r.frame();
    await tick();
    assert.equal(o.resolved, 0);
    r.native(target);
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { o, target };
  });

  await test('actual normalized default extractor keeps active item numeric', async () => {
    const r = rig();
    publishRenderProps(r, r.state.props.data, { keyExtractorProp: undefined });
    r.state.sizesKnown = new Map(
      Array.from({ length: 100 }, (_, i) => [String(i), 120])
    );
    initialize(r);
    assert.equal(typeof r.state.props.keyExtractor, 'function');
    assert.equal(r.state.props.keyExtractor({ id: 'x' }, 4), '4');
    const { o } = issue(r);
    mutate(r, 'prepend');
    assert.equal(r.state.scrollingTo.keyedTarget, undefined);
    assert.equal(r.state.scrollingTo.index, 81);
    r.native(pointAt(r, 81));
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { o };
  });
  await test('normalized default extractor keeps deferred item-reference lookup', async () => {
    const r = rig();
    publishRenderProps(r, r.state.props.data, { keyExtractorProp: undefined });
    r.state.sizesKnown = new Map(
      Array.from({ length: 100 }, (_, i) => [String(i), 120])
    );
    initialize(r);
    r.state.didDataChange = true;
    const { o } = issue(r);
    mutate(r, 'prepend');
    settleDispatch(r);
    assert.equal(r.state.scrollingTo.index, 82);
    assert.equal(r.state.scrollingTo.keyedTarget, undefined);
    r.native(pointAt(r, 82));
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { o };
  });
  for (const active of [true, false])
    await test(`equivalent new array preserves ${active ? 'active' : 'new'} keyed request without position rebuild`, async () => {
      const r = rig();
      initialize(r);
      const command = active ? issue(r) : null;
      const positions = r.state.positions;
      const oldData = r.state.props.data;
      const decision = publishRenderProps(r, [...oldData]);
      assert.equal(decision.didDataChangeLocal, false);
      assert.equal(r.state.positions, positions);
      const { o } = command ?? issue(r);
      r.native(pointAt(r, 81));
      r.frame();
      await tick();
      assert.equal(o.resolved, 1);
      assert.equal(o.rejected, 0);
      return { o, decision };
    });
  await test('itemsAreEqual-approved new objects reuse committed layout', async () => {
    const r = rig();
    initialize(r);
    r.state.props.itemsAreEqual = (a, b) => a.id === b.id;
    const { o } = issue(r);
    const decision = publishRenderProps(
      r,
      r.state.props.data.map((item) => ({ ...item, revision: 2 }))
    );
    assert.equal(decision.didDataChangeLocal, false);
    r.native(pointAt(r, 81));
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { o, decision };
  });
  await test('structural prepend never adopts equivalent-layout stamp', async () => {
    const r = rig();
    initialize(r);
    const { o } = issue(r);
    const oldPoint = pointAt(r, 81);
    const extra = { id: 'prepended' };
    r.state.sizesKnown.set(extra.id, 120);
    const decision = publishRenderProps(r, [extra, ...r.state.props.data]);
    assert.equal(decision.didDataChangeLocal, true);
    r.native(oldPoint);
    r.frame();
    await tick();
    assert.equal(o.resolved, 0);
    rebuild(r);
    r.native(pointAt(r, 82));
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { o, decision };
  });
  for (const field of ['dataVersion', 'dataKey'])
    await test(`${field} change invalidates reused same-array keyed geometry`, async () => {
      const r = rig();
      initialize(r);
      const { o } = issue(r);
      const decision = publishRenderProps(r, r.state.props.data, {
        [field]: 1,
      });
      assert.equal(decision.didDataChangeLocal, true);
      r.native(pointAt(r, 81));
      r.frame();
      await tick();
      assert.equal(o.resolved, 0);
      rebuild(r);
      r.native(pointAt(r, 81));
      r.frame();
      await tick();
      assert.equal(o.resolved, 1);
      return { o, decision };
    });
  await test('equivalent array cannot revive an already stale layout stamp', async () => {
    const r = rig();
    initialize(r);
    const { o } = issue(r);
    r.state.scrollItemLayoutData = [];
    const decision = publishRenderProps(r, [...r.state.props.data]);
    assert.equal(decision.didDataChangeLocal, false);
    r.native(pointAt(r, 81));
    r.frame();
    await tick();
    assert.equal(o.resolved, 0);
    rebuild(r);
    r.native(pointAt(r, 81));
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { o, decision };
  });
  await test('equivalent array during column change waits for real layout rebuild', async () => {
    const r = rig();
    initialize(r);
    const { o } = issue(r);
    r.state.didColumnsChange = true;
    const decision = publishRenderProps(r, [...r.state.props.data]);
    assert.equal(decision.didDataChangeLocal, false);
    r.native(pointAt(r, 81));
    r.frame();
    await tick();
    assert.equal(o.resolved, 0);
    rebuild(r);
    r.state.didColumnsChange = false;
    r.native(pointAt(r, 81));
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { o, decision };
  });

  function dynamicIssue(r, getViewOffset, extra = {}) {
    const h = r.handle(),
      item = r.state.props.data[81],
      o = outcome(
        h.scrollToItem({
          item,
          viewPosition: 0.5,
          animated: false,
          getViewOffset,
          ...extra,
        })
      );
    return { h, item, o };
  }
  function drain(r, o) {
    return (async () => {
      for (let i = 0; i < 70 && !o.rejected && !o.resolved; i++) {
        if (r.timers.size) r.timer();
        r.frame();
        await tick();
      }
    })();
  }
  await test('dynamic decoration4 uses fresh full offset and current target arguments at dispatch', async () => {
    const r = rig();
    initialize(r);
    const calls = [];
    const { o, item } = dynamicIssue(r, (t) => {
      calls.push(t);
      return 4;
    });
    assert.equal(r.snapshot().nativeCalls.at(-1).y, 9476);
    assert.ok(calls.length);
    assert.equal(calls[0].item, item);
    assert.equal(calls[0].key, item.id);
    assert.equal(calls[0].index, 81);
    assert.equal(calls[0].itemSize, 120);
    r.native(9476);
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { o, calls: calls.length };
  });
  await test('dynamic changed offset invalidates old native acknowledgement even within1pt', async () => {
    const r = rig();
    initialize(r);
    let offset = 4;
    const { o } = dynamicIssue(r, () => offset);
    r.native(9476);
    offset = 4.5;
    r.frame();
    await tick();
    assert.equal(o.resolved, 0);
    assert.equal(
      r.env.getCurrentTargetOffset(r.ctx, r.state.scrollingTo),
      9475.5
    );
    r.native(9475.5);
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { o };
  });
  await test('first native event after changed dynamic geometry is sufficient', async () => {
    const r = rig();
    initialize(r);
    let offset = 4;
    const { o } = dynamicIssue(r, () => offset);
    offset = 8;
    r.native(9472);
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { o };
  });
  await test('dynamic active retry reads latest offset, never captured static fallback', async () => {
    const r = rig();
    initialize(r);
    let offset = 4;
    const { o } = dynamicIssue(r, () => offset, { viewOffset: 99 });
    offset = 8;
    r.timer();
    assert.equal(r.snapshot().nativeCalls.at(-1).y, 9472);
    r.native(9472);
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { o };
  });
  for (const value of [undefined, NaN, Infinity])
    await test(`dynamic unavailable ${String(value)} never dispatches zero or cached fallback`, async () => {
      const r = rig();
      initialize(r);
      const { o } = dynamicIssue(r, () => value, { viewOffset: 4 });
      await drain(r, o);
      assert.equal(o.resolved, 0);
      assert.equal(o.rejected, 1);
      assert.equal(o.reason, 'target-offset-unavailable');
      assert.equal(r.snapshot().nativeCalls.length, 0);
      return { o };
    });
  await test('dynamic throwing getter is bounded typed failure, not uncaught RAF', async () => {
    const r = rig();
    initialize(r);
    const { o } = dynamicIssue(r, () => {
      throw Error('geometry-not-ready');
    });
    await drain(r, o);
    assert.equal(o.resolved, 0);
    assert.equal(o.reason, 'target-offset-unavailable');
    assert.equal(r.snapshot().nativeCalls.length, 0);
    return { o };
  });
  await test('dynamic transient unavailability regains value but cannot reuse prior native observation', async () => {
    const r = rig();
    initialize(r);
    let offset = 4;
    const { o } = dynamicIssue(r, () => offset);
    r.native(9476);
    offset = undefined;
    r.frame();
    await tick();
    assert.equal(o.resolved, 0);
    offset = 4;
    r.env.checkFinishedScroll(r.ctx);
    r.frame();
    await tick();
    assert.equal(o.resolved, 0);
    r.native(9476);
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { o };
  });
  await test('dynamic initially missing geometry becomes ready inside settle budget', async () => {
    const r = rig();
    initialize(r);
    let offset;
    const { o } = dynamicIssue(r, () => offset);
    r.frame();
    assert.equal(r.snapshot().nativeCalls.length, 0);
    offset = 4;
    settleDispatch(r);
    assert.equal(r.snapshot().nativeCalls.at(-1).y, 9476);
    r.native(9476);
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { o };
  });
  await test('dynamic current key index object and itemSize follow prepend and resize', async () => {
    const r = rig();
    initialize(r);
    const seen = [];
    const { o, item } = dynamicIssue(r, (t) => {
      seen.push({
        key: t.key,
        index: t.index,
        itemSize: t.itemSize,
        item: t.item,
      });
      return t.itemSize === 200 ? 8 : 4;
    });
    mutate(r, 'prepend');
    r.state.sizesKnown.set(item.id, 200);
    rebuild(r);
    const current = r.env.getCurrentTargetOffset(r.ctx, r.state.scrollingTo);
    const last = seen.at(-1);
    assert.equal(last.key, item.id);
    assert.equal(last.index, 82);
    assert.equal(last.itemSize, 200);
    assert.equal(last.item, r.state.props.data[82]);
    assert.equal(current, 9632);
    r.native(current);
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { o, last };
  });
  await test('dynamic unavailable while active rejects after unchanged bounded budget', async () => {
    const r = rig();
    initialize(r);
    let offset = 4;
    const { o } = dynamicIssue(r, () => offset);
    offset = undefined;
    const calls = r.snapshot().nativeCalls.length;
    await drain(r, o);
    assert.equal(o.resolved, 0);
    assert.equal(o.rejected, 1);
    assert.equal(o.reason, 'target-offset-unavailable');
    assert.equal(r.snapshot().nativeCalls.length, calls);
    return { o };
  });
  await test('dynamic stale timer and frame never call old getter after new request', async () => {
    const r = rig();
    initialize(r);
    let reads = 0;
    const old = dynamicIssue(r, () => {
      reads++;
      return 4;
    });
    r.env.checkFinishedScroll(r.ctx);
    const frames = [...r.raf.values()],
      timers = [...r.timers.values()];
    const next = issue(r, 75);
    const after = reads;
    frames.forEach((fn) => fn());
    timers.forEach((job) => job.fn());
    await tick();
    assert.equal(reads, after);
    assert.equal(next.o.rejected, 0);
    r.native(pointAt(r, 75));
    r.frame();
    await tick();
    assert.equal(next.o.resolved, 1);
    return { old: old.o, next: next.o };
  });
  await test('dynamic reentrant getter cannot dispatch or mutate over a newer request', async () => {
    const r = rig();
    initialize(r);
    const h = r.handle();
    let replaced = false,
      next;
    const old = outcome(
      h.scrollToItem({
        item: r.state.props.data[81],
        animated: false,
        viewPosition: 0.5,
        getViewOffset: () => {
          if (!replaced) {
            replaced = true;
            next = outcome(
              h.scrollToIndex({ index: 75, viewPosition: 0.5, animated: false })
            );
          }
          return 4;
        },
      })
    );
    await tick();
    assert.equal(r.state.scrollingTo.index, 75);
    assert.equal(r.snapshot().nativeCalls.length, 1);
    r.native(pointAt(r, 75));
    r.frame();
    await tick();
    assert.equal(next.resolved, 1);
    return { old, next };
  });
  await test('old fallback cannot replace the newer request timer after resolver supersession', async () => {
    const r = rig();
    initialize(r);
    const h = r.handle();
    let arm = false,
      next,
      nextTimer;
    const old = dynamicIssue(r, () => {
      if (arm) {
        arm = false;
        next = outcome(
          h.scrollToIndex({ index: 75, viewPosition: 0.5, animated: false })
        );
        nextTimer = r.state.timeoutCheckFinishedScrollFallback;
      }
      return 4;
    });
    arm = true;
    r.timer();
    await tick();
    assert.equal(r.state.scrollingTo.index, 75);
    assert.equal(
      r.state.timeoutCheckFinishedScrollFallback,
      nextTimer,
      'old fallback must not overwrite the replacement request timer'
    );
    r.native(pointAt(r, 75));
    r.frame();
    await tick();
    assert.equal(next.resolved, 1);
    return { old: old.o, next };
  });
  await test('old native event cannot acknowledge newer command created inside active getter', async () => {
    const r = rig();
    initialize(r);
    const h = r.handle();
    let arm = false,
      next;
    const old = dynamicIssue(r, () => {
      if (arm) {
        arm = false;
        next = outcome(
          h.scrollToIndex({ index: 75, viewPosition: 0.5, animated: false })
        );
      }
      return 4;
    });
    arm = true;
    r.native(pointAt(r, 75));
    r.frame();
    await tick();
    assert.equal(
      next.resolved,
      0,
      'event began before replacement request; it is not that request acknowledgement'
    );
    assert.equal(r.state.scrollingTo.index, 75);
    r.native(pointAt(r, 75));
    r.frame();
    await tick();
    assert.equal(next.resolved, 1);
    return { old: old.o, next };
  });
  await test('independent: retired layout resolver cannot clear newer pinned range', async () => {
    const r = rig();
    initialize(r);
    const h = r.handle();
    let arm = false,
      next,
      expectedPin;
    const old = dynamicIssue(r, () => {
      if (arm) {
        arm = false;
        next = outcome(
          h.scrollToIndex({ index: 75, viewPosition: 0.5, animated: false })
        );
        expectedPin = { ...r.state.scrollTargetPinnedRange };
      }
      return 4;
    });
    arm = true;
    r.env.updateItemPositions(r.ctx, false, {
      doMVCP: true,
      forceFullUpdate: true,
      startIndex: 0,
    });
    await tick();
    assert.equal(r.state.scrollingTo.index, 75);
    assert.ok(
      r.state.scrollTargetPinnedRange,
      'replacement pin remains present'
    );
    assert.deepEqual(
      { ...r.state.scrollTargetPinnedRange },
      expectedPin,
      'retired layout erased replacement range'
    );
    return { old: old.o, next, expectedPin };
  });
  await test('independent: getter data reentry cannot dispatch stale pre-getter index', async () => {
    const r = rig();
    initialize(r);
    const item = r.state.props.data[81];
    let reads = 0,
      changed = false;
    const old = dynamicIssue(r, () => {
      reads++;
      if (reads === 2) {
        changed = true;
        mutate(r, 'prepend');
      }
      return 4;
    });
    await tick();
    assert.ok(changed, 'must exercise dispatch getter mutation');
    const currentIndex = r.state.indexByKey.get(item.id);
    const wanted = pointAt(r, currentIndex) - 4;
    const writes = r.snapshot().nativeCalls;
    assert.ok(
      writes.length === 0 || Math.abs(writes.at(-1).y - wanted) < 1,
      `stale dispatch ${writes.at(-1)?.y} vs current key target ${wanted}`
    );
    return { old: old.o, reads, wanted, writes };
  });
  await test('active getter data reentry cannot reuse prior acknowledgement or old item index', async () => {
    const r = rig();
    initialize(r);
    let arm = false;
    const old = dynamicIssue(r, () => {
      if (arm) {
        arm = false;
        mutate(r, 'prepend');
      }
      return 4;
    });
    r.native(9476);
    arm = true;
    r.frame();
    await tick();
    assert.equal(old.o.resolved, 0);
    assert.equal(old.o.rejected, 0);
    assert.equal(r.state.scrollingTo.index, 82);
    const current = pointAt(r, 82) - 4;
    r.native(current);
    r.frame();
    await tick();
    assert.equal(old.o.resolved, 1);
    return { old: old.o, current };
  });
  await test('active getter size-only layout reentry cannot certify its earlier measurement', async () => {
    const r = rig();
    initialize(r);
    let arm = false;
    const old = dynamicIssue(r, () => {
      if (arm) {
        arm = false;
        r.state.sizesKnown.set(r.state.props.data[81].id, 200);
        rebuild(r);
      }
      return 4;
    });
    r.native(9476);
    arm = true;
    r.frame();
    await tick();
    assert.equal(old.o.resolved, 0);
    assert.equal(old.o.rejected, 0);
    const current = pointAt(r, 81) - 4;
    r.native(current);
    r.frame();
    await tick();
    assert.equal(old.o.resolved, 1);
    return { old: old.o, current };
  });
  await test('dispatch getter target removal rejects missing rather than dispatching its neighbor', async () => {
    const r = rig();
    initialize(r);
    let reads = 0;
    const old = dynamicIssue(r, () => {
      if (++reads === 2) mutate(r, 'remove-target');
      return 4;
    });
    await tick();
    assert.equal(old.o.resolved, 0);
    assert.equal(old.o.rejected, 1);
    assert.equal(old.o.reason, 'target-missing');
    assert.equal(r.snapshot().nativeCalls.length, 0);
    return { old: old.o, reads };
  });
  await test('active getter target removal cannot certify neighboring item', async () => {
    const r = rig();
    initialize(r);
    let arm = false;
    const old = dynamicIssue(r, () => {
      if (arm) {
        arm = false;
        mutate(r, 'remove-target');
      }
      return 4;
    });
    r.native(9476);
    arm = true;
    r.frame();
    await tick();
    assert.equal(old.o.resolved, 0);
    assert.equal(old.o.rejected, 1);
    assert.equal(old.o.reason, 'target-missing');
    return { old: old.o };
  });
  for (const os of ['android', 'web'])
    await test(`${os} ignores unsupported dynamic item offset seam`, async () => {
      const r = rig(os);
      initialize(r);
      let reads = 0;
      const { o } = dynamicIssue(
        r,
        () => {
          reads++;
          return 4;
        },
        { viewOffset: 8 }
      );
      assert.equal(reads, 0);
      r.native(9472);
      r.frame();
      await tick();
      assert.equal(o.resolved, 1);
      return { o };
    });
  await test('numeric API ignores dynamic getter instead of becoming keyed', async () => {
    const r = rig();
    initialize(r);
    let reads = 0;
    const h = r.handle(),
      o = outcome(
        h.scrollToIndex({
          index: 81,
          viewPosition: 0.5,
          viewOffset: 8,
          animated: false,
          getViewOffset: () => {
            reads++;
            return 4;
          },
        })
      );
    assert.equal(reads, 0);
    r.native(9472);
    r.frame();
    await tick();
    assert.equal(o.resolved, 1);
    return { o };
  });
  return {
    results,
    extractedFunctions: names,
    extractedSha256: sha256(
      bodies + '\n' + assignment + JSON.stringify(renderFragments)
    ),
    renderFragments,
    reprocessAssignment: assignment,
    scope:
      '37 existing keyed plus25 dynamic offset controls; actual normalization and equivalent-data decision fragments; exact public/dispatch/MVCP/cache/position/native-event/completion/pin bodies; manual native events and scheduling, peripheral rendering/thresholds stubbed. Ordinary iOS with stable keyExtractor only; numeric/non-iOS compatibility explicit. No UIKit or presentation proof.',
  };
});
