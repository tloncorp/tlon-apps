/**
 * Node22+: node scripts/test-legend-offscreen-target.mjs [--source-dir DIR] [--report FILE].
 * Defaults to both installed native bundles resolved from the invocation cwd.
 * iOS keyed offscreen render acquisition; existing native command controls remain separate.
 * Native events, scheduling and peripheral rendering are modeled, not presentation proof.
 */
import vm from 'node:vm';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(process.cwd() + '/package.json');
const ts = require('typescript');
const registryPath =
  process.cwd() + '/packages/app/ui/components/Channel/postTargetLayout.ts';
const registrySource = fs.readFileSync(registryPath, 'utf8');
const registryModule = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(registrySource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  { exports: registryModule.exports }
);
const createRegistry = registryModule.exports.createPostTargetLayoutRegistry;
import assert from 'node:assert/strict';
import {
  extractDeclarations,
  extractReprocessAssignment,
  runInstalledControls,
  sha256,
} from './lib/legend-source-controls.mjs';
await runInstalledControls(
  'legend-offscreen-dynamic-acquisition',
  async (source) => {
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
    const bodies =
      core.bodies + '\n\n' + keyed.bodies + '\n\n' + dynamic.bodies;
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
      env.dataKey =
        'dataKey' in options ? options.dataKey : state.props.dataKey;
      env.dataVersion =
        'dataVersion' in options
          ? options.dataVersion
          : state.props.dataVersion;
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
      const o = {
        resolved: 0,
        rejected: 0,
        code: null,
        reason: null,
        key: null,
      };
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
        r.env.calculateOffsetWithOffsetPosition(
          r.ctx,
          r.state.positions[index],
          {
            index,
            itemSize: r.state.sizesKnown.get(r.state.props.data[index]?.id),
            viewPosition: 0.5,
            viewOffset: 0,
          }
        )
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
    function appRegistry(r) {
      const registry = createRegistry('channel-a', (fn) =>
        r.env.requestAnimationFrame(fn)
      );
      const leases = new Map();
      const publish = (index) => {
        const key = r.state.props.data[index].id;
        const lease = registry.createLease('channel-a', key, {
          leading: false,
          trailing: true,
        });
        lease.activate();
        lease.layout('cell', 120);
        lease.layout('trailing-separator', 8);
        leases.set(index, lease);
        return lease;
      };
      let reads = 0;
      return {
        registry,
        publish,
        leases,
        get reads() {
          return reads;
        },
        getViewOffset: ({ key, itemSize }) => {
          reads++;
          const geometry = registry.get(key, itemSize);
          return geometry
            ? 0.5 * geometry.cellSizeDelta +
                0.5 * geometry.trailing -
                0.5 * geometry.leading
            : undefined;
        },
      };
    }
    async function finish(r, o) {
      const call = r.snapshot().nativeCalls.at(-1);
      if (call) {
        r.native(call.y);
        r.frame();
        await tick();
      }
      return {
        o,
        pin: r.state.scrollTargetPinnedRange ?? null,
        nativeCalls: r.snapshot().nativeCalls,
        calculations: r.calculations,
      };
    }
    for (const cachedSize of [true, false])
      await test(`far offscreen ${cachedSize ? 'cached-size' : 'never-mounted estimate'} target acquires mounted geometry before dispatch`, async () => {
        const r = rig();
        initialize(r);
        const a = appRegistry(r),
          index = 1,
          item = r.state.props.data[index];
        if (cachedSize) {
          const oldLease = a.publish(index);
          r.frame();
          assert.ok(a.registry.get(item.id, 120));
          oldLease.deactivate();
          a.leases.delete(index);
        } else {
          r.state.sizesKnown.delete(item.id);
          r.state.sizes.delete(item.id);
          r.env.getItemSize = () => 120;
        }
        assert.equal(a.registry.get(item.id, 120), undefined);
        const h = r.handle(),
          o = outcome(
            h.scrollToItem({
              item,
              viewPosition: 0.5,
              animated: false,
              getViewOffset: a.getViewOffset,
            })
          );
        let pinned = false;
        for (let i = 0; i < 55 && !o.rejected && !o.resolved; i++) {
          const range = r.state.scrollTargetPinnedRange;
          if (range && range.start <= index && range.end >= index) {
            pinned = true;
            if (!a.leases.has(index)) a.publish(index);
          }
          r.frame();
          await tick();
          if (r.snapshot().nativeCalls.length) break;
        }
        const e = await finish(r, o);
        e.reads = a.reads;
        e.pinnedBeforeDispatch = pinned;
        e.registryAvailable = a.registry.get(item.id, 120) !== undefined;
        e.cachedSize = cachedSize;
        accepted(
          pinned,
          'Current target never acquired its render pin before waiting on mounted-only geometry',
          e
        );
        accepted(
          o.resolved === 1 && o.rejected === 0,
          'Current known target failed to complete after acquired geometry',
          e
        );
        return e;
      });
    await test('already mounted measured far target dispatches and completes', async () => {
      const r = rig();
      initialize(r);
      const a = appRegistry(r),
        index = 1;
      a.publish(index);
      r.frame();
      const item = r.state.props.data[index],
        o = outcome(
          r.handle().scrollToItem({
            item,
            viewPosition: 0.5,
            animated: false,
            getViewOffset: a.getViewOffset,
          })
        );
      const e = await finish(r, o);
      assert.equal(o.resolved, 1);
      assert.equal(o.rejected, 0);
      return e;
    });
    await test('far static offset retains target pin and dispatch compatibility', async () => {
      const r = rig();
      initialize(r);
      const index = 1,
        item = r.state.props.data[index],
        o = outcome(
          r.handle().scrollToItem({
            item,
            viewPosition: 0.5,
            animated: false,
            viewOffset: 4,
          })
        );
      const pin = { ...r.state.scrollTargetPinnedRange };
      assert.ok(pin.start <= index && pin.end >= index);
      const e = await finish(r, o);
      assert.equal(o.resolved, 1);
      return { pin, ...e };
    });
    await test('independently arriving current registry geometry releases queued request', async () => {
      const r = rig();
      initialize(r);
      const a = appRegistry(r),
        index = 1,
        item = r.state.props.data[index],
        o = outcome(
          r.handle().scrollToItem({
            item,
            viewPosition: 0.5,
            animated: false,
            getViewOffset: a.getViewOffset,
          })
        );
      r.frame();
      assert.equal(r.snapshot().nativeCalls.length, 0);
      a.publish(index);
      for (let i = 0; i < 4; i++) {
        r.frame();
        await tick();
      }
      const e = await finish(r, o);
      assert.equal(o.resolved, 1);
      assert.equal(o.rejected, 0);
      return e;
    });
    await test('newer command permanently retires old offscreen geometry queue', async () => {
      const r = rig();
      initialize(r);
      const a = appRegistry(r),
        h = r.handle(),
        index = 1,
        item = r.state.props.data[index],
        old = outcome(
          h.scrollToItem({
            item,
            viewPosition: 0.5,
            animated: false,
            getViewOffset: a.getViewOffset,
          })
        );
      r.frame();
      const forced = [...r.raf.values()];
      const next = outcome(
        h.scrollToItem({
          item: r.state.props.data[75],
          viewPosition: 0.5,
          animated: false,
          viewOffset: 4,
        })
      );
      const reads = a.reads,
        writes = r.snapshot().nativeCalls.length;
      a.publish(index);
      for (const fn of forced) fn();
      for (let i = 0; i < 4; i++) {
        r.frame();
        await tick();
      }
      assert.equal(a.reads, reads);
      assert.equal(r.snapshot().nativeCalls.length, writes);
      const e = await finish(r, next);
      assert.equal(next.resolved, 1);
      return { old, next, reads, ...e };
    });
    function pending(r, index = 1) {
      const a = appRegistry(r),
        h = r.handle(),
        item = r.state.props.data[index];
      const o = outcome(
        h.scrollToItem({
          item,
          viewPosition: 0.5,
          animated: false,
          getViewOffset: a.getViewOffset,
        })
      );
      return { a, h, item, o, index };
    }
    const hasPin = (r, index) =>
      r.state.scrollTargetPinnedRange?.start <= index &&
      r.state.scrollTargetPinnedRange?.end >= index;
    async function untilDeadline(r) {
      for (let i = 0; i < 55; i++) {
        r.frame();
        await tick();
      }
    }
    await test('pending acquisition pins only the target and never prepays logical/native movement', async () => {
      const r = rig();
      initialize(r);
      const before = r.snapshot(),
        p = pending(r),
        range = r.state.scrollTargetPinnedRange;
      accepted(hasPin(r, 1), 'No acquisition render pin', {
        pin: range ?? null,
        state: r.snapshot(),
      });
      assert.equal(range.start, 1);
      assert.equal(range.end, 1);
      assert.equal(r.state.scroll, before.scroll);
      assert.equal(r.state.scrollPending, before.pending);
      assert.equal(r.snapshot().nativeCalls.length, 0);
      assert.ok(r.calculations.length > 0);
      return { range, state: r.snapshot(), o: p.o };
    });
    await test('unavailable deadline clears only its acquisition pin and settles once', async () => {
      const r = rig();
      initialize(r);
      const p = pending(r);
      const forced = [...r.raf.values()];
      await untilDeadline(r);
      assert.equal(p.o.rejected, 1);
      assert.equal(r.state.scrollTargetPinnedRange, undefined);
      const reads = p.a.reads;
      for (const fn of forced) fn();
      await tick();
      assert.equal(p.a.reads, reads);
      assert.equal(r.snapshot().nativeCalls.length, 0);
      assert.equal(p.o.rejected, 1);
      return { o: p.o, reads };
    });
    await test('coherent reorder reacquires exact key at new index without moving before geometry', async () => {
      const r = rig();
      initialize(r);
      const p = pending(r),
        data = [...r.state.props.data];
      [data[1], data[10]] = [data[10], data[1]];
      publishRenderProps(r, data);
      rebuild(r);
      r.frame();
      accepted(
        hasPin(r, 10),
        'Target acquisition did not follow coherent key reorder',
        { pin: r.state.scrollTargetPinnedRange ?? null, o: p.o }
      );
      assert.equal(r.snapshot().nativeCalls.length, 0);
      p.a.publish(10);
      for (let i = 0; i < 4; i++) {
        r.frame();
        await tick();
      }
      const e = await finish(r, p.o);
      assert.equal(p.o.resolved, 1);
      return e;
    });
    await test('removed target clears acquisition and rejects without targeting successor', async () => {
      const r = rig();
      initialize(r);
      r.state.props.maintainVisibleContentPosition = {
        data: false,
        size: false,
      };
      const p = pending(r),
        data = [...r.state.props.data];
      data.splice(1, 1);
      publishRenderProps(r, data);
      rebuild(r);
      r.frame();
      assert.equal(r.state.scrollTargetPinnedRange, undefined);
      r.frame();
      await tick();
      assert.equal(p.o.rejected, 1);
      assert.equal(p.o.reason, 'target-missing');
      assert.equal(r.state.scrollTargetPinnedRange, undefined);
      assert.equal(r.snapshot().nativeCalls.length, 0);
      return p.o;
    });
    await test('stale layout association cannot dispatch or keep an incorrect index pin', async () => {
      const r = rig();
      initialize(r);
      r.state.props.maintainVisibleContentPosition = {
        data: false,
        size: false,
      };
      const p = pending(r),
        data = [{ id: 'new-front' }, ...r.state.props.data];
      publishRenderProps(r, data);
      r.frame();
      assert.equal(r.state.scrollTargetPinnedRange, undefined);
      assert.equal(r.snapshot().nativeCalls.length, 0);
      r.state.sizesKnown.set('new-front', 120);
      rebuild(r);
      r.frame();
      assert.ok(hasPin(r, 2));
      p.a.publish(2);
      for (let i = 0; i < 4; i++) {
        r.frame();
        await tick();
      }
      const e = await finish(r, p.o);
      assert.equal(p.o.resolved, 1);
      return e;
    });
    await test('native ref detach terminates acquisition without waiting for a nonexistent mount', async () => {
      const r = rig();
      initialize(r);
      const p = pending(r);
      r.state.refScroller.current = null;
      r.frame();
      await tick();
      assert.equal(p.o.rejected, 1);
      assert.equal(p.o.reason, 'target-unmounted');
      assert.equal(r.state.scrollTargetPinnedRange, undefined);
      return p.o;
    });
    await test('new dynamic request pin survives forced old callbacks and old deadline', async () => {
      const r = rig();
      initialize(r);
      const p = pending(r),
        forced = [...r.raf.values()];
      const next = outcome(
        p.h.scrollToItem({
          item: r.state.props.data[20],
          viewPosition: 0.5,
          animated: false,
          getViewOffset: p.a.getViewOffset,
        })
      );
      assert.ok(hasPin(r, 20));
      const range = r.state.scrollTargetPinnedRange;
      for (const fn of forced) fn();
      assert.equal(r.state.scrollTargetPinnedRange, range);
      p.a.publish(20);
      for (let i = 0; i < 4; i++) {
        r.frame();
        await tick();
      }
      const e = await finish(r, next);
      assert.equal(next.resolved, 1);
      return { old: p.o, ...e };
    });
    await test('reentrant render calculation cannot publish or clean a superseded pin', async () => {
      const r = rig();
      initialize(r);
      const a = appRegistry(r),
        h = r.handle();
      let next,
        entered = false;
      r.state.triggerCalculateItemsInView = () => {
        if (!entered) {
          entered = true;
          next = outcome(
            h.scrollToItem({
              item: r.state.props.data[20],
              viewPosition: 0.5,
              animated: false,
              getViewOffset: a.getViewOffset,
            })
          );
        }
      };
      const old = outcome(
        h.scrollToItem({
          item: r.state.props.data[1],
          viewPosition: 0.5,
          animated: false,
          getViewOffset: a.getViewOffset,
        })
      );
      assert.ok(entered);
      assert.ok(hasPin(r, 20));
      a.publish(20);
      for (let i = 0; i < 4; i++) {
        r.frame();
        await tick();
      }
      const e = await finish(r, next);
      assert.equal(next.resolved, 1);
      return { old, ...e };
    });
    await test('revoked app getter cannot dispatch and releases resources by bounded deadline', async () => {
      const r = rig();
      initialize(r);
      const a = appRegistry(r),
        h = r.handle();
      let active = true;
      const o = outcome(
        h.scrollToItem({
          item: r.state.props.data[1],
          viewPosition: 0.5,
          animated: false,
          getViewOffset: (t) => (active ? a.getViewOffset(t) : undefined),
        })
      );
      assert.ok(hasPin(r, 1));
      active = false;
      a.publish(1);
      await untilDeadline(r);
      assert.equal(o.rejected, 1);
      assert.equal(r.state.scrollTargetPinnedRange, undefined);
      assert.equal(r.snapshot().nativeCalls.length, 0);
      return o;
    });
    await test('force-dequeued old readiness cannot duplicate a dispatched current target', async () => {
      const r = rig();
      initialize(r);
      const p = pending(r),
        forced = [...r.raf.values()];
      p.a.publish(1);
      for (let i = 0; i < 4; i++) {
        r.frame();
        await tick();
      }
      const writes = r.snapshot().nativeCalls.length;
      assert.equal(writes, 1);
      for (const fn of forced) fn();
      assert.equal(r.snapshot().nativeCalls.length, writes);
      const e = await finish(r, p.o);
      assert.equal(p.o.resolved, 1);
      return e;
    });
    await test('getter data rebuild cannot publish an acquisition pin for the old index', async () => {
      const r = rig();
      initialize(r);
      const a = appRegistry(r),
        h = r.handle(),
        item = r.state.props.data[1];
      let changed = false;
      const o = outcome(
        h.scrollToItem({
          item,
          viewPosition: 0.5,
          animated: false,
          getViewOffset: (t) => {
            if (!changed) {
              changed = true;
              const data = [...r.state.props.data];
              [data[1], data[10]] = [data[10], data[1]];
              publishRenderProps(r, data);
              rebuild(r);
            }
            return a.getViewOffset(t);
          },
        })
      );
      const first = r.state.scrollTargetPinnedRange;
      accepted(
        !first || hasPin(r, 10),
        'Getter rebuilt current target at10 but preparation pinned old index1',
        {
          first: first ?? null,
          currentIndex: r.state.indexByKey.get(item.id),
          o,
        }
      );
      r.frame();
      assert.ok(hasPin(r, 10));
      a.publish(10);
      for (let i = 0; i < 4; i++) {
        r.frame();
        await tick();
      }
      const e = await finish(r, o);
      assert.equal(o.resolved, 1);
      return e;
    });
    await test('end acceptance cleanup cannot overwrite a reentrant newer deferred end', async () => {
      const r = rig();
      initialize(r);
      const p = pending(r);
      let next,
        expected,
        entered = false;
      r.state.triggerCalculateItemsInView = () => {
        if (!entered) {
          entered = true;
          next = outcome(p.h.scrollToEnd({ animated: false }));
          expected = r.state.pendingScrollToEnd;
        }
      };
      const oldEnd = outcome(p.h.scrollToEnd({ animated: false }));
      assert.ok(entered);
      accepted(
        r.state.pendingScrollToEnd === expected,
        'Older end overwrote newer end accepted by cleanup callback',
        {
          oldToken: r.state.pendingScrollToEnd?.token,
          newToken: expected?.token,
        }
      );
      r.state.runPendingScrollToEnd();
      const e = await finish(r, next);
      assert.equal(next.resolved, 1);
      return { old: p.o, oldEnd, ...e };
    });
    await test('direct new target replaces acquisition without a stale pin or getter revival', async () => {
      const r = rig();
      initialize(r);
      const p = pending(r),
        forced = [...r.raf.values()];
      r.command();
      const next = r.state.scrollTargetPinnedRange,
        reads = p.a.reads;
      assert.equal(r.state.pendingScrollRequest?.acquisitionRange, undefined);
      for (const fn of forced) fn();
      for (let i = 0; i < 4; i++) {
        r.frame();
        await tick();
      }
      assert.equal(p.a.reads, reads);
      assert.equal(r.state.scrollTargetPinnedRange, next);
      return { old: p.o, range: next };
    });
    await test('cleanup rendering failure settles the newly accepted request without leaking it', async () => {
      const r = rig();
      initialize(r);
      const p = pending(r);
      r.state.triggerCalculateItemsInView = () => {
        throw Error('cleanup-render-failed');
      };
      const next = outcome(
        p.h.scrollToItem({
          item: r.state.props.data[20],
          viewPosition: 0.5,
          animated: false,
          getViewOffset: p.a.getViewOffset,
        })
      );
      await tick();
      assert.equal(next.rejected, 1);
      assert.equal(r.state.pendingScrollRequest, undefined);
      assert.equal(r.state.scrollTargetPinnedRange, undefined);
      return { old: p.o, next };
    });
    await test('failed acquisition cleanup cannot throw from a queued frame after settlement', async () => {
      const r = rig();
      initialize(r);
      const p = pending(r);
      r.state.triggerCalculateItemsInView = () => {
        throw Error('cleanup-render-failed');
      };
      await untilDeadline(r);
      assert.equal(p.o.rejected, 1);
      assert.equal(p.o.reason, 'target-offset-unavailable');
      assert.equal(r.state.pendingScrollRequest, undefined);
      assert.equal(r.state.scrollTargetPinnedRange, undefined);
      return p.o;
    });
    return {
      results,
      extractedFunctions: names,
      extractedSha256: sha256(
        bodies + '\n' + assignment + JSON.stringify(renderFragments)
      ),
      registryPath,
      registrySha256: sha256(registrySource),
      scope:
        'Actual installed public readiness/target/pin/native-event bodies and actual app registry; mounted row acquisition and native delivery modeled; no UIKit evidence',
    };
  }
);
