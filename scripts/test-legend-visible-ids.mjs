/**
 * Run with Node 22+: node scripts/test-legend-visible-ids.mjs [--report FILE].
 * By default both installed native bundles are read; no native runtime is started.
 * --source-dir DIR reads an explicit archived base for a preserved red run.
 *
 * Acceptance and modeled boundaries are fixed in the adjacent geometry fixture.
 * These controls execute the dependency's actual parsed function bodies. They do
 * not recreate those functions or treat modeled dispatch as simulator proof.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(
  new URL('../packages/app/package.json', import.meta.url)
);
const { parse } = require('acorn');
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  assert.ok(
    ['--source-dir', '--report'].includes(key),
    `Unknown option: ${key}`
  );
  assert.ok(
    process.argv[i + 1] && !process.argv[i + 1].startsWith('--'),
    `Missing value: ${key}`
  );
  assert.ok(!(key in options), `Repeated option: ${key}`);
  options[key] = path.resolve(process.argv[i + 1]);
}
const sourceDirectory =
  options['--source-dir'] ??
  path.dirname(require.resolve('@legendapp/list/react-native'));
const fixturePath = fileURLToPath(
  new URL('./fixtures/legend-visible-ids.geometry.json', import.meta.url)
);
const fixtureBytes = fs.readFileSync(fixturePath);
const fixture = JSON.parse(fixtureBytes);
assert.equal(fixture.schemaVersion, 1);
const evidence = fixture.scenarios;
const names = [
  'trackVisibleRange',
  'getIdsInVisibleRange',
  'getId',
  'prepareMVCP',
  'requestAdjust',
  'resolveAnchorLock',
  'updateAnchorLock',
  'shouldQueueNativeMVCPAdjust',
  'getPredictedNativeClamp',
  'maybeApplyPredictedNativeMVCPAdjust',
  'updateViewabilityForCachedRange',
  'maybeEmitFirstVisibleItemChanged',
  'findFirstVisibleIndexInCachedRange',
  'calculateItemsInView',
];
function runVariant(variant) {
  const file = path.join(sourceDirectory, variant);
  const source = fs.readFileSync(file, 'utf8');
  const tree = parse(source, {
    ecmaVersion: 'latest',
    sourceType: variant.endsWith('.mjs') ? 'module' : 'script',
  });
  const variantNames = [...names];
  if (
    tree.body.some(
      (node) =>
        node.type === 'FunctionDeclaration' &&
        node.id.name === 'retainOwnedNativeViewport'
    )
  ) {
    variantNames.push('retainOwnedNativeViewport');
  }
  if (
    tree.body.some(
      (node) =>
        node.type === 'FunctionDeclaration' &&
        node.id.name === 'routesNativeReadAdjustment'
    )
  )
    variantNames.push('routesNativeReadAdjustment');
  for (const name of [
    'captureNativeReadPreparation',
    'ownsNativeReadPreparation',
    'acknowledgeNativeReadAdjustment',
    'getNativeAcquisitionPositions',
    'getNativeAcquisitionPosition',
  ])
    if (
      tree.body.some(
        (node) => node.type === 'FunctionDeclaration' && node.id.name === name
      )
    )
      variantNames.push(name);
  const declarations = tree.body.filter(
    (n) => n.type === 'FunctionDeclaration' && variantNames.includes(n.id.name)
  );
  assert.deepEqual(
    declarations.map((n) => n.id.name).sort(),
    [...variantNames].sort(),
    'Required installed functions missing or duplicated'
  );
  const extracted = declarations
    .map((n) => source.slice(n.start, n.end))
    .join('\n');
  function rig(name = 'history-grow') {
    const raw = evidence[name];
    const ordered = Object.keys(raw.baseline).sort(
      (a, b) => Number(a.split('-').at(-1)) - Number(b.split('-').at(-1))
    );
    const viewport = raw.first.scroll.view.frame;
    const offset = raw.first.scroll.offset.y;
    const positions = ordered.map(
      (id) => raw.baseline[id].y + offset - viewport.y
    );
    const sizes = new Map(ordered.map((id) => [id, raw.baseline[id].height]));
    const writes = [],
      calls = [];
    const state = {
      props: {
        data: ordered.map((id) => ({ id })),
        keyExtractor: (p) => p.id,
        horizontal: false,
        maintainVisibleContentPosition: { data: true, size: true },
      },
      idCache: ordered.slice(),
      positions,
      indexByKey: new Map(ordered.map((id, i) => [id, i])),
      sizes,
      sizesKnown: new Map(sizes),
      idsInView: [],
      scroll: offset,
      scrollPending: offset,
      scrollLength: viewport.height,
      didContainersLayout: true,
      didFinishInitialScroll: true,
      columns: [],
      containerItemKeys: new Map(),
      startBuffered: 0,
      endBuffered: ordered.length - 1,
      enableScrollForNextCalculateItemsInView: true,
      scrollForNextCalculateItemsInView: { top: null, bottom: offset + 5000 },
      scrollHistory: [],
    };
    const values = new Map([
      ['numContainers', 10],
      ['numColumns', 1],
      ['stylePaddingTop', 0],
      ['alignItemsAtEndPadding', 0],
      ['headerSize', 0],
      ['readyToRender', true],
      ['activeStickyIndex', -1],
      ['isWithinMaintainScrollAtEndThreshold', false],
    ]);
    const ctx = { state, values };
    state.scrollAdjustHandler = {
      requestAdjust: (n) => writes.push(n),
      getAdjust: () => 0,
    };
    const env = {
      console,
      Platform: { OS: 'ios' },
      IsNewArchitecture: true,
      MVCP_POSITION_EPSILON: 0.1,
      MVCP_ANCHOR_LOCK_TTL_MS: 300,
      MVCP_ANCHOR_LOCK_QUIET_PASSES_TO_RELEASE: 2,
      Date: { now: () => 1000 },
      setTimeout: () => 1,
      clearTimeout: () => {},
      requestAnimationFrame: () => {
        throw Error('Unexpected delayed native write');
      },
      peek$: (ctx, k) => ctx.values.get(k),
      set$: (ctx, k, v) => ctx.values.set(k, v),
      batchedUpdates: (fn) => fn(),
      getContentSize: () => raw.first.scroll.contentSize.height + 98,
      getItemSize: (ctx, id) => ctx.state.sizesKnown.get(id),
      getEffectiveDrawDistance: () => 100,
      getScrollVelocity: () => 0,
      hasActiveInitialScroll: () => false,
      getProjectedBufferAdjustment: () => 0,
      updateViewableItems: (_state, _ctx, pairs) => {
        if (pairs.length) calls.push('viewability-delivery');
      },
      resetLayoutCachesForDataChange: () => calls.push('reset-layout-cache'),
      updateItemPositions: () => {
        calls.push('full-calculation');
        throw Error('EXPECTED_FULL_CALCULATION_BOUNDARY');
      },
    };
    vm.createContext(env);
    vm.runInContext(extracted, env);
    function refresh() {
      const range = {
        startNoBuffer: null,
        endNoBuffer: null,
        firstFullyOnScreenIndex: undefined,
      };
      for (let i = 0; i < ordered.length; i++)
        env.trackVisibleRange(
          range,
          i,
          positions[i],
          sizes.get(ordered[i]),
          Math.round(offset),
          Math.round(offset) + viewport.height
        );
      return { range, ids: Array.from(env.getIdsInVisibleRange(state, range)) };
    }
    return { ctx, state, env, writes, calls, raw, refresh };
  }
  const id = (n) => 'scroll-fixture-' + n;
  function grow(r, { anchor = 'fresh', target, viewPosition = 0 } = {}) {
    r.state.idsInView = anchor === 'fresh' ? r.refresh().ids : anchor.map(id);
    if (target !== undefined)
      r.state.scrollingTo = {
        index: r.state.indexByKey.get(id(target)),
        viewPosition,
        itemSize: r.state.sizesKnown.get(id(target)),
      };
    const original = r.state.scroll;
    const apply = r.env.prepareMVCP(r.ctx, false);
    assert.equal(typeof apply, 'function');
    const amount =
      r.raw.terminal[id(109)].height - r.raw.baseline[id(109)].height;
    const mutationIndex = r.state.indexByKey.get(id(109));
    for (let i = mutationIndex + 1; i < r.state.positions.length; i++)
      r.state.positions[i] += amount;
    r.state.sizesKnown.set(id(109), r.state.sizesKnown.get(id(109)) + amount);
    apply();
    return {
      delta: r.state.scroll - original,
      writes: r.writes,
      amount,
      anchor: r.state.idsInView,
    };
  }

  const results = [];
  function test(name, fn) {
    try {
      const detail = fn();
      results.push({ name, status: 'PASS', detail });
    } catch (e) {
      results.push({ name, status: 'FAIL', message: e.message });
    }
  }
  function configure(r, config) {
    if (['viewability', 'both'].includes(config))
      r.state.viewabilityConfigCallbackPairs = [
        { viewabilityConfig: { id: 'actual-callback-boundary' } },
      ];
    if (['first', 'both'].includes(config))
      r.state.props.onFirstVisibleItemChanged = (e) =>
        r.calls.push('first:' + e.key);
    r.state.idsInView = [id(110), id(111)];
  }
  function mutateKeepingCurrentIds(r) {
    return grow(r, {
      anchor: r.state.idsInView.map((s) => Number(s.split('-').at(-1))),
    });
  }
  for (const config of ['none', 'first', 'viewability', 'both']) {
    test(
      config +
        ': cached viewport refresh removes stale110 anchor and below-reader growth emits0',
      () => {
        const r = rig();
        configure(r, config);
        r.env.calculateItemsInView(r.ctx);
        const actualIds = Array.from(r.state.idsInView);
        const x = mutateKeepingCurrentIds(r);
        assert.deepEqual(actualIds, [id(109), id(110)]);
        assert.equal(x.delta, 0);
        assert.equal(
          r.calls.filter((x) => x.startsWith('first:')).length,
          ['first', 'both'].includes(config) ? 1 : 0
        );
        assert.equal(
          r.calls.filter((x) => x === 'viewability-delivery').length,
          ['viewability', 'both'].includes(config) ? 1 : 0
        );
        return { ids: actualIds, delta: x.delta, calls: r.calls };
      }
    );
    test(
      config + ': repeated cached pass keeps first callback deduplicated',
      () => {
        const r = rig();
        configure(r, config);
        r.env.calculateItemsInView(r.ctx);
        r.env.calculateItemsInView(r.ctx);
        assert.equal(
          r.calls.filter((x) => x.startsWith('first:')).length,
          ['first', 'both'].includes(config) ? 1 : 0
        );
        assert.equal(
          r.calls.filter((x) => x === 'viewability-delivery').length,
          ['viewability', 'both'].includes(config) ? 2 : 0
        );
        return { calls: r.calls };
      }
    );
    test(
      config + ': valid cached range with no intersecting rows clears old IDs',
      () => {
        const r = rig();
        configure(r, config);
        r.state.positions = r.state.positions.map((x) => x - 20000);
        r.env.calculateItemsInView(r.ctx);
        assert.deepEqual(Array.from(r.state.idsInView), []);
        assert.equal(r.state.startNoBuffer, null);
        assert.equal(r.state.endNoBuffer, null);
        assert.equal(r.calls.length, 0);
        return { ids: Array.from(r.state.idsInView) };
      }
    );
  }
  for (const invalid of ['missing-start', 'missing-end', 'reversed-range'])
    test(invalid + ': invalid cache reaches existing full calculation', () => {
      const r = rig();
      configure(r, 'none');
      if (invalid === 'missing-start') r.state.startBuffered = null;
      else if (invalid === 'missing-end') r.state.endBuffered = null;
      else r.state.startBuffered = r.state.endBuffered + 1;
      assert.throws(
        () => r.env.calculateItemsInView(r.ctx),
        /EXPECTED_FULL_CALCULATION_BOUNDARY/
      );
      assert.deepEqual(r.calls, ['full-calculation']);
      assert.equal(r.writes.length, 0);
      return { calls: r.calls };
    });
  for (const bypass of [
    'bootstrap',
    'data-change',
    'force-full',
    'disabled-cache',
    'out-of-cache',
    'null-cache-marker',
  ])
    test(bypass + ': full-layout ownership is preserved', () => {
      const r = rig();
      configure(r, 'none');
      let params = {};
      if (bypass === 'bootstrap')
        r.state.initialScrollSession = {
          kind: 'bootstrap',
          bootstrap: { scroll: r.state.scroll },
        };
      if (bypass === 'data-change')
        params = { dataChanged: true, doMVCP: true };
      if (bypass === 'force-full') params = { forceFullItemPositions: true };
      if (bypass === 'disabled-cache')
        r.state.enableScrollForNextCalculateItemsInView = false;
      if (bypass === 'out-of-cache')
        r.state.scrollForNextCalculateItemsInView = {
          top: r.state.scroll + 10000,
          bottom: r.state.scroll + 20000,
        };
      if (bypass === 'null-cache-marker')
        r.state.scrollForNextCalculateItemsInView = { top: null, bottom: null };
      const bootstrap = r.state.initialScrollSession;
      assert.throws(
        () => r.env.calculateItemsInView(r.ctx, params),
        /EXPECTED_FULL_CALCULATION_BOUNDARY/
      );
      assert.ok(r.calls.includes('full-calculation'));
      assert.equal(r.state.initialScrollSession, bootstrap);
      assert.equal(r.writes.length, 0);
      return { calls: r.calls };
    });
  test('explicit later indexed target remains current and retains its MVCP correction', () => {
    const r = rig();
    configure(r, 'none');
    const target = {
      index: r.state.indexByKey.get(id(110)),
      viewPosition: 0.5,
      itemSize: r.state.sizesKnown.get(id(110)),
    };
    r.state.scrollingTo = target;
    r.env.calculateItemsInView(r.ctx);
    assert.equal(r.state.scrollingTo, target);
    assert.equal(r.writes.length, 0);
    const x = mutateKeepingCurrentIds(r);
    assert.equal(x.delta, 1392);
    assert.equal(r.state.scrollingTo, target);
    return { delta: x.delta, target };
  });
  for (const empty of ['unavailable-data', 'zero-viewport', 'zero-containers'])
    test(
      empty + ': initial guard does not invoke callbacks or dispatch',
      () => {
        const r = rig();
        configure(r, 'both');
        if (empty === 'unavailable-data') r.state.props.data = undefined;
        if (empty === 'zero-viewport') r.state.scrollLength = 0;
        if (empty === 'zero-containers') r.ctx.values.set('numContainers', 0);
        r.env.calculateItemsInView(r.ctx);
        assert.equal(r.calls.length, 0);
        assert.equal(r.writes.length, 0);
        return { calls: r.calls };
      }
    );
  for (const config of ['none', 'first', 'viewability', 'both'])
    test(
      config + ': empty data array clears cached visible IDs without callbacks',
      () => {
        const r = rig();
        configure(r, config);
        r.state.props.data = [];
        r.env.calculateItemsInView(r.ctx);
        assert.deepEqual(Array.from(r.state.idsInView), []);
        assert.equal(r.calls.length, 0);
        assert.equal(r.writes.length, 0);
        return { ids: Array.from(r.state.idsInView) };
      }
    );
  test('original direct stale-ID+1392 diagnostic mechanism is retained', () => {
    const r = rig(),
      x = grow(r, { anchor: [110, 111] });
    assert.equal(x.delta, 1392);
    return { delta: x.delta };
  });
  test('first-visible preference remains109, not a newly invented center anchor108', () => {
    const r = rig(),
      v = r.refresh();
    assert.equal(v.ids[0], id(109));
    assert.equal(r.state.props.data[v.range.startNoBuffer].id, id(108));
    return v;
  });
  test('removal still uses110 policy; this patch does not claim to solve reader111 regrouping', () => {
    const r = rig('history-remove');
    configure(r, 'none');
    r.env.calculateItemsInView(r.ctx);
    assert.equal(r.state.idsInView[0], id(110));
    return {
      ids: Array.from(r.state.idsInView),
      remainingRecordedReaderDriftPt: -38,
    };
  });

  return {
    variant,
    source: {
      file,
      sha256: sha(source),
      extractedSha256: sha(extracted),
      functions: names,
    },
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length,
    results,
  };
}
const variants = ['react-native.js', 'react-native.mjs'].map(runVariant);
const report = {
  schemaVersion: 1,
  sourceKind: options['--source-dir']
    ? 'explicit-archived-source'
    : 'installed-dependency',
  harnessSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  fixtureSha256: sha(fixtureBytes),
  algorithmBaseline: fixture.algorithmBaseline,
  rawProvenance: Object.fromEntries(
    Object.entries(evidence).map(([name, value]) => [name, value.provenance])
  ),
  boundary: fixture.boundary,
  passed: variants.reduce((n, v) => n + v.passed, 0),
  failed: variants.reduce((n, v) => n + v.failed, 0),
  variants,
};
if (options['--report'])
  fs.writeFileSync(options['--report'], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.failed ? 1 : 0;
