import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assessNativeEvidence } from '../../../scripts/scroll-stability-native-evidence.mjs';
import {
  adaptNativeScrollGeometry,
  nativeThinkingGestureExtentIsMeasured,
} from './scrollNativeGeometry';
import { assessScrollTrace } from './scrollStabilityTrace';
import {
  nativeCenterCommand,
  nativeOffscreenCommand,
} from './scrollNativeTargetCommand';
// Existing healthy importer fixture functions copied unchanged, not a copied oracle.
const passedTrace = () => {
  const samples = Array.from({ length: 57 }, (_, index) => ({
    time: index * 50,
    scroll: 900,
    contentLength: 1000,
    viewportHeight: 100,
    viewportTop: 10,
    viewportBottom: 110,
    keyboardHeight: 0,
    nearEnd: true,
    rows: [{ key: 'scroll-fixture-119', y: 70, height: 40 }],
    scrollBounds: { min: 0, max: 900 },
    measurement: { valid: true, durationMs: 1 },
  }));
  return {
    scenario: 'entry-latest',
    fixtureVersion: 2,
    platform: 'ios',
    assertion: 'bottom',
    assertionSchemaVersion: 1,
    followingOffsetThroughout: false,
    emptyEndThroughout: false,
    baselinePreconditions: {
      requireHistory: false,
      requireInitialEnd: false,
      requireReadingAnchor: false,
      excludedAnchorKeys: [],
      allowEmptyEnd: false,
    },
    baseline: samples[0],
    samples,
    events: [
      { time: 0, name: 'reset', values: { mode: 'latest' } },
      { time: 1, name: 'list-attached' },
      { time: 10, name: 'row-commit', values: { key: 'scroll-fixture-119' } },
      { time: 50, name: 'entry-state', values: { ready: true, count: 90 } },
    ],
    committedDataKeys: Array.from(
      { length: 90 },
      (_, index) => `scroll-fixture-${index + 30}`
    ),
    expectations: {
      action: {
        name: 'entry-latest',
        startedAt: 0,
        completedAt: 100,
        observed: true,
      },
      coverage: { startTime: 0, endTime: 2800 },
      requireMeasurementMetadata: true,
      bottom: { startTime: 200, tailKey: 'scroll-fixture-119' },
    },
    result: {
      verdict: 'PASS',
      passed: true,
      evidenceLevel: 'sampled-geometry',
      nativeFrames: 'INCOMPLETE',
      issues: [],
      metrics: {
        samples: samples.length,
        maxSampleGapMs: 50,
        maxAnchorDriftPt: 0,
        maxBottomDistancePt: 0,
        maxLandingErrorPt: 0,
        blankSamples: 0,
      },
    },
  };
};

const withCoherentNativeAcquisition = () => {
  const trace = passedTrace();
  trace.nativeGeometrySchemaVersion = 1;
  const view = (identity, y, height, descendantOfScroll) => ({
    identity,
    windowIdentity: 'native-window',
    frame: { x: 0, y, width: 400, height },
    clipFrame: { x: 0, y, width: 400, height },
    attached: true,
    effectiveAlpha: 1,
    hidden: false,
    translationOnly: true,
    descendantOfScroll,
  });
  trace.samples = trace.samples.map((sample, index) => {
    const request = {
      requestId: `capture-${index}`,
      rootId: 'fixture-root-1',
      scrollViewId: 'conversation-native',
      composerId: 'composer-native',
      rows: sample.rows.map((row) => ({ key: row.key, id: `row-${row.key}` })),
    };
    const capture = {
      version: 1,
      requestId: request.requestId,
      rootId: request.rootId,
      scrollViewId: request.scrollViewId,
      composerId: request.composerId,
      rowIds: request.rows.map((row) => row.id),
      clock: 'CACurrentMediaTime milliseconds',
      coordinateSpace: 'window-model-points',
      startedAt: 100000 + sample.time - 1,
      finishedAt: 100000 + sample.time,
      status: 'ok',
      issues: [],
      visitedViews: 100,
      root: view('root', 0, 800, false),
      composer: view('composer', sample.viewportBottom, 60, false),
      scroll: {
        view: view('scroll', sample.viewportTop, sample.viewportHeight, true),
        hostIdentity: 'scroll-host',
        offset: { x: 0, y: sample.scroll },
        contentSize: { width: 400, height: sample.contentLength },
        bounds: {
          x: 0,
          y: sample.scroll,
          width: 400,
          height: sample.viewportHeight,
        },
        contentInset: { top: 0, right: 0, bottom: 0, left: 0 },
        adjustedContentInset: { top: 0, right: 0, bottom: 0, left: 0 },
        zoomScale: 1,
        tracking: false,
        dragging: false,
        decelerating: false,
      },
      rows: sample.rows.map((row) => ({
        id: `row-${row.key}`,
        matches: 1,
        view: view(`native-row-${row.key}`, row.y, row.height, true),
      })),
    };
    return adaptNativeScrollGeometry(capture, request, {
      requestedAt: sample.time - 1,
      receivedAt: sample.time,
      requiredKeys: [],
      populated: true,
    }).snapshot;
  });
  trace.baseline = trace.samples[0];
  trace.result = assessScrollTrace(trace.samples, trace.expectations);
  return trace;
};

const make = (obstruction = false) => {
  const trace = withCoherentNativeAcquisition();
  // Legacy version is deliberate noise: it cannot authorize missing new owner contract.
  trace.nativeSampledRulerVersion = 'indexed-cell-and-surfaces-v2';
  trace.nativeSampledRulerContract = {
    version: 'indexed-cell-and-surfaces-v2',
    scope: 'native-import-scope',
    rootId: 'fixture-root-1',
    scrollViewId: 'conversation-native',
    composerId: 'composer-native',
  };
  trace.samples = trace.samples.map((sample, index) => {
    const e = sample.acquisition.nativeGeometry;
    e.request.rows = e.request.rows.map((row) => ({
      ...row,
      id: `scroll-row-${row.key}`,
    }));
    e.capture.rowIds = e.request.rows.map((row) => row.id);
    e.capture.rows = e.capture.rows.map((row, i) => ({
      ...row,
      id: e.request.rows[i].id,
    }));
    const scope = 'native-import-scope';
    const cells = e.capture.rows.map((row, i) => {
      const semanticValue = JSON.stringify({
        version: 1,
        scope,
        key: e.request.rows[i].key,
        signature: {
          content: 'exact importer row',
          reactions: '[]',
          replies: 0,
        },
      });
      const id = `cell-${i}`;
      row.view = { ...row.view, containingCellIdentity: id, semanticValue };
      return {
        id: `scroll-cell-${e.request.rows[i].key}`,
        matches: 1,
        view: { ...row.view, identity: id },
      };
    });
    const surfaces = [
      {
        id: 'scroll-surface-body',
        matches: 1,
        view: { ...structuredClone(e.capture.composer), identity: 'body' },
      },
    ];
    const rect = {
      x: 150,
      y: obstruction && index === 4 ? 80 : 200,
      width: 48,
      height: 30,
    };
    surfaces.push({
      id: 'scroll-surface-latest',
      matches: 1,
      view: {
        ...structuredClone(e.capture.composer),
        identity: 'latest',
        frame: rect,
        clipFrame: rect,
      },
    });
    e.capture.ruler = {
      version: 1,
      cells,
      surfaces,
      manifest: {
        id: 'scroll-surface-manifest',
        matches: 1,
        view: {
          ...structuredClone(e.capture.composer),
          identity: 'manifest',
          semanticValue: JSON.stringify({
            version: 1,
            scope,
            surfaceIds: surfaces.map((s) => s.id),
          }),
        },
      },
    };
    e.bracket.ruler = { version: 'indexed-cell-and-surfaces-v2', scope };
    return adaptNativeScrollGeometry(e.capture, e.request, e.bracket).snapshot;
  });
  trace.baseline = trace.samples[0];
  trace.result = assessScrollTrace(trace.samples, trace.expectations);
  return trace;
};
describe('v2 derived evidence is independently reproduced from native raw capture', () => {
  it('keeps a historical default native trace passing', () => {
    expect(assessNativeEvidence(withCoherentNativeAcquisition()).status).toBe(
      'recorded-sampled-pass'
    );
  });
  it('replays healthy v2 after a JSON serialization round trip', () => {
    expect(
      assessNativeEvidence(JSON.parse(JSON.stringify(make()))).status
    ).toBe('recorded-sampled-pass');
  });
  it('retains a genuine, coherent partial-surface obstruction failure', () => {
    const r = assessNativeEvidence(make(true));
    expect(r.status).toBe('fail');
    expect(r.issues).toContain('tail-obscured');
  });
  it.each([
    [
      'deleted derived ruler',
      (t) => {
        delete t.samples[4].acquisition.nativeGeometry.ruler;
      },
    ],
    [
      'erased measured obstruction',
      (t) => {
        t.samples[4].acquisition.nativeGeometry.ruler.obscuredKeys = [];
      },
    ],
    [
      'forged latest visibility',
      (t) => {
        t.samples[4].acquisition.nativeGeometry.ruler.latestControlVisible = false;
      },
    ],
    [
      'forged indexed cell height',
      (t) => {
        t.samples[4].acquisition.nativeGeometry.ruler.cells[0].frame.height = 123;
      },
    ],
    [
      'deleted actual surface',
      (t) => {
        t.samples[4].acquisition.nativeGeometry.ruler.surfaces = [];
      },
    ],
    [
      'moved derived surface',
      (t) => {
        t.samples[4].acquisition.nativeGeometry.ruler.surfaces[1].frame.y = 200;
      },
    ],
    [
      'changed derived scope',
      (t) => {
        t.samples[4].acquisition.nativeGeometry.ruler.scope = 'other';
      },
    ],
    [
      'missing trace version',
      (t) => {
        delete t.nativeSampledRulerContract;
      },
    ],
    [
      'one downgraded sample',
      (t) => {
        delete t.samples[4].acquisition.nativeGeometry.bracket.ruler;
        delete t.samples[4].acquisition.nativeGeometry.ruler;
      },
    ],
    [
      'unsupported trace version',
      (t) => {
        t.nativeSampledRulerContract.version = 'unknown';
      },
    ],
  ])('rejects %s before trusting product conclusions', (label, mutate) => {
    const t = JSON.parse(JSON.stringify(make(true)));
    mutate(t);
    expect(assessNativeEvidence(t).status).toBe('incomplete');
  });
});

function replaceNativeMetadata(e, update) {
  for (const row of [
    ...e.capture.rows,
    ...e.capture.ruler.cells,
    e.capture.ruler.manifest,
  ]) {
    if (row.view?.semanticValue) {
      const m = JSON.parse(row.view.semanticValue);
      update(m);
      row.view.semanticValue = JSON.stringify(m);
    }
  }
}
function regenerate(t, index) {
  const e = t.samples[index].acquisition.nativeGeometry;
  t.samples[index] = adaptNativeScrollGeometry(
    e.capture,
    e.request,
    e.bracket
  ).snapshot;
  t.baseline = t.samples[0];
  t.result = assessScrollTrace(t.samples, t.expectations);
}

function centerCommandTrace(spec = nativeCenterCommand) {
  const trace = make();
  const scope = trace.nativeSampledRulerContract.scope;
  const keys = Array.from(
    { length: 90 },
    (_, index) => `scroll-fixture-${index + 30}`
  );
  trace.scenario = spec.scenario;
  trace.assertion = 'target';
  trace.nativeCenterCommandContract = { version: 1, scope, startedAt: 0 };
  trace.originalDataKeys = [...keys];
  trace.committedDataKeys = [...keys];
  trace.baselinePreconditions.requireInitialEnd = true;
  trace.baselinePreconditions.initialTailKey = keys.at(-1);
  trace.expectations = {
    action: {
      name: trace.scenario,
      startedAt: 0,
      completedAt: 10,
      observed: true,
    },
    coverage: { startTime: 0, endTime: 2800 },
    requireMeasurementMetadata: true,
    requireVisibleContent: true,
    landing: {
      key: spec.key,
      alignment: 'center',
      settleStartTime: 1800,
    },
  };
  trace.events = [
    {
      time: 5,
      name: 'center-command-request',
      values: {
        scope,
        key: spec.key,
        viewPosition: 0.5,
        animated: false,
        source: 'PostList.scrollToPost',
      },
    },
  ];
  trace.samples = trace.samples.map((sample, index) => {
    const e = sample.acquisition.nativeGeometry;
    if (index > 0) {
      e.request.rows[0] = {
        key: spec.key,
        id: `scroll-row-${spec.key}`,
      };
      e.capture.rowIds = [e.request.rows[0].id];
      e.capture.rows[0].id = e.request.rows[0].id;
      e.capture.ruler.cells[0].id = `scroll-cell-${spec.key}`;
      replaceNativeMetadata(e, (m) => {
        if ('key' in m) m.key = spec.key;
      });
      for (const row of [...e.capture.rows, ...e.capture.ruler.cells]) {
        row.view.frame.y = 40;
        row.view.clipFrame.y = 40;
      }
      e.capture.scroll.offset.y = 500;
      e.capture.scroll.bounds.y = 500;
    }
    const adapted = adaptNativeScrollGeometry(
      e.capture,
      e.request,
      e.bracket
    ).snapshot;
    adapted.acquisition.jsCoherence = {
      before: { scope, keys: [...keys] },
      after: { scope, keys: [...keys] },
    };
    return adapted;
  });
  trace.baseline = trace.samples[0];
  trace.result = assessScrollTrace(trace.samples, trace.expectations);
  return trace;
}

describe('a public native center command has a fixed target and settling window', () => {
  it('qualifies a measured end baseline followed by the requested centered message', () => {
    const trace = JSON.parse(JSON.stringify(centerCommandTrace()));
    expect(assessNativeEvidence(trace).status).toBe('recorded-sampled-pass');
  });
  it('fails a successfully issued command that never moves from the legal end', () => {
    const trace = centerCommandTrace();
    const stationary = make();
    trace.samples = stationary.samples.map((sample, index) => {
      sample.acquisition.jsCoherence =
        trace.samples[index].acquisition.jsCoherence;
      return sample;
    });
    trace.baseline = trace.samples[0];
    trace.result = assessScrollTrace(trace.samples, trace.expectations);
    const result = assessNativeEvidence(trace);
    expect(result.status, JSON.stringify(result)).toBe('fail');
    expect(result.issues).toContain('target-missing');
  });
  it.each([
    [
      'missing command',
      (t) => {
        t.events = [];
      },
    ],
    [
      'repeated command',
      (t) => {
        t.events.push(structuredClone(t.events[0]));
      },
    ],
    [
      'late command',
      (t) => {
        t.events[0].time = 251;
      },
    ],
    [
      'command before recording',
      (t) => {
        t.events[0].time = -1;
      },
    ],
    [
      'wrong requested message',
      (t) => {
        t.events[0].values.key = 'scroll-fixture-110';
      },
    ],
    [
      'wrong request scope',
      (t) => {
        t.events[0].values.scope = 'other';
      },
    ],
    [
      'wrong alignment argument',
      (t) => {
        t.events[0].values.viewPosition = 1;
      },
    ],
    [
      'animated argument',
      (t) => {
        t.events[0].values.animated = true;
      },
    ],
    [
      'private positioning',
      (t) => {
        t.events[0].values.source = 'LegendList.scrollToIndex';
      },
    ],
    [
      'substituted target oracle',
      (t) => {
        t.expectations.landing.key = 'scroll-fixture-110';
      },
    ],
    [
      'shortened quiet interval',
      (t) => {
        t.expectations.landing.settleStartTime = 2500;
      },
    ],
    [
      'restarted deadline',
      (t) => {
        t.expectations.coverage.endTime = 3000;
      },
    ],
    [
      'missing end precondition',
      (t) => {
        t.baselinePreconditions.requireInitialEnd = false;
      },
    ],
    [
      'missing declared command contract',
      (t) => {
        delete t.nativeCenterCommandContract;
      },
    ],
    [
      'changed final data',
      (t) => {
        t.committedDataKeys.pop();
      },
    ],
    [
      'transient data change',
      (t) => {
        t.samples[20].acquisition.jsCoherence.before.keys.pop();
      },
    ],
    [
      'missing sampled membership',
      (t) => {
        delete t.samples[20].acquisition.jsCoherence;
      },
    ],
  ])('does not qualify %s', (_, mutate) => {
    const trace = centerCommandTrace();
    mutate(trace);
    expect(assessNativeEvidence(trace).status).toBe('incomplete');
  });
  it.each([
    ['wrong final landing', [54, 55, 56]],
    ['a transient relapse during the fixed quiet interval', [38]],
    [
      'a landing that is late even though the final second ends correctly',
      [36, 37],
    ],
  ])('fails %s from actual native row geometry', (_, indices) => {
    const trace = centerCommandTrace();
    for (const index of indices) {
      const e = trace.samples[index].acquisition.nativeGeometry;
      const membership = trace.samples[index].acquisition.jsCoherence;
      for (const row of [...e.capture.rows, ...e.capture.ruler.cells]) {
        row.view.frame.y = 50;
        row.view.clipFrame.y = 50;
      }
      regenerate(trace, index);
      trace.samples[index].acquisition.jsCoherence = membership;
    }
    const result = assessNativeEvidence(trace);
    expect(result.status, JSON.stringify(result)).toBe('fail');
    expect(result.issues).toContain('wrong-landing');
  });
});
describe('v2 pins the declared scope and actual mounted native owner', () => {
  it('rejects a middle scope swap even when raw, bracket and derived semantics all agree and final scope returns', () => {
    const t = make();
    const e = t.samples[4].acquisition.nativeGeometry;
    e.bracket.ruler.scope = 'other-scope';
    replaceNativeMetadata(e, (m) => {
      m.scope = 'other-scope';
    });
    regenerate(t, 4);
    expect(assessNativeEvidence(t).status).toBe('incomplete');
  });
  it.each(['rootId', 'scrollViewId', 'composerId'])(
    'rejects a middle requested %s replacement even when raw and request agree',
    (field) => {
      const t = make();
      const e = t.samples[4].acquisition.nativeGeometry;
      e.request[field] = 'replacement';
      e.capture[field] = 'replacement';
      regenerate(t, 4);
      expect(assessNativeEvidence(t).status).toBe('incomplete');
    }
  );
  it.each(['root', 'composer', 'scroll', 'host', 'window'])(
    'rejects a middle actual native %s replacement with unchanged declared IDs',
    (field) => {
      const t = make();
      const e = t.samples[4].acquisition.nativeGeometry;
      if (field === 'host') e.capture.scroll.hostIdentity = 'replacement';
      else if (field === 'scroll')
        e.capture.scroll.view.identity = 'replacement';
      else if (field === 'window')
        for (const view of [
          e.capture.root,
          e.capture.composer,
          e.capture.scroll.view,
          ...e.capture.rows.map((r) => r.view),
          ...e.capture.ruler.cells.map((r) => r.view),
          ...e.capture.ruler.surfaces.map((r) => r.view),
          e.capture.ruler.manifest.view,
        ])
          view.windowIdentity = 'replacement';
      else e.capture[field].identity = 'replacement';
      regenerate(t, 4);
      expect(assessNativeEvidence(t).status).toBe('incomplete');
    }
  );
  it.each(['scope', 'rootId', 'scrollViewId', 'composerId'])(
    'rejects an empty predeclared %s',
    (field) => {
      const t = make();
      t.nativeSampledRulerContract[field] = '';
      expect(assessNativeEvidence(t).status).toBe('incomplete');
    }
  );
  it.each([
    {},
    { content: 'row', reactions: '[]' },
    { content: 7, reactions: '[]', replies: 0 },
    { content: 'row', reactions: [], replies: 0 },
    { content: 'row', reactions: '[]', replies: '0' },
    { content: 'row', reactions: '[]', replies: -1 },
    { content: 'row', reactions: '[]', replies: 0.5 },
    { content: 'row', reactions: '[]', replies: NaN },
  ])('rejects matching but invalid native signatures %j', (signature) => {
    const t = make();
    const e = t.samples[4].acquisition.nativeGeometry;
    replaceNativeMetadata(e, (m) => {
      if (m.key) m.signature = signature;
    });
    regenerate(t, 4);
    expect(assessNativeEvidence(t).status).toBe('incomplete');
  });
});

it('the new predeclared owner contract needs no legacy unscoped version flag', () => {
  const t = make();
  delete t.nativeSampledRulerVersion;
  expect(assessNativeEvidence(t).status).toBe('recorded-sampled-pass');
});

it('accepts coherent row and indexed-cell object replacement within the unchanged owner', () => {
  const t = make();
  const e = t.samples[4].acquisition.nativeGeometry;
  for (let i = 0; i < e.capture.rows.length; i++) {
    const cellIdentity = `replacement-cell-${i}`;
    e.capture.rows[i].view.identity = `replacement-inner-${i}`;
    e.capture.rows[i].view.containingCellIdentity = cellIdentity;
    e.capture.ruler.cells[i].view.identity = cellIdentity;
    e.capture.ruler.cells[i].view.containingCellIdentity = cellIdentity;
  }
  regenerate(t, 4);
  expect(assessNativeEvidence(t).status).toBe('recorded-sampled-pass');
});

function offscreenCommandTrace() {
  const trace = centerCommandTrace(nativeOffscreenCommand);
  trace.nativeOffscreenCommandContract = trace.nativeCenterCommandContract;
  delete trace.nativeCenterCommandContract;
  trace.events[0].name = 'offscreen-command-request';
  trace.events[0].values.mountedKeys = JSON.stringify(['scroll-fixture-119']);
  return trace;
}

describe('offscreen public command evidence is bound at independent replay', () => {
  it.each(['center-command-request', 'positioned'])(
    'rejects additional %s during offscreen capture',
    (name) => {
      const trace = offscreenCommandTrace();
      trace.events.push({ time: 6, name, values: {} });
      expect(assessNativeEvidence(trace).status).toBe('incomplete');
    }
  );
  it('accepts an unmounted data key acquired and centered under one native owner', () => {
    const result = assessNativeEvidence(offscreenCommandTrace());
    expect(result.status, JSON.stringify(result)).toBe('recorded-sampled-pass');
  });
  it.each([
    [
      'request target already mounted',
      (t) => {
        t.events[0].values.mountedKeys = JSON.stringify([
          'scroll-fixture-119',
          nativeOffscreenCommand.key,
        ]);
      },
    ],
    [
      'missing request mount witness',
      (t) => {
        delete t.events[0].values.mountedKeys;
      },
    ],
    [
      'empty request mount witness',
      (t) => {
        t.events[0].values.mountedKeys = '[]';
      },
    ],
    [
      'duplicate mounted identity',
      (t) => {
        t.events[0].values.mountedKeys = JSON.stringify([
          'scroll-fixture-119',
          'scroll-fixture-119',
        ]);
      },
    ],
    [
      'undeclared mounted message',
      (t) => {
        t.events[0].values.mountedKeys = JSON.stringify(['other-channel']);
      },
    ],
    [
      'missing command contract',
      (t) => {
        delete t.nativeOffscreenCommandContract;
      },
    ],
    [
      'legacy contract substituted',
      (t) => {
        t.nativeCenterCommandContract = t.nativeOffscreenCommandContract;
        delete t.nativeOffscreenCommandContract;
      },
    ],
    [
      'wrong target',
      (t) => {
        t.events[0].values.key = 'scroll-fixture-111';
      },
    ],
    [
      'wrong scope',
      (t) => {
        t.events[0].values.scope = 'other';
      },
    ],
    [
      'private command',
      (t) => {
        t.events[0].values.source = 'LegendList.scrollToIndex';
      },
    ],
    [
      'second command',
      (t) => {
        t.events.push(structuredClone(t.events[0]));
      },
    ],
    [
      'late command',
      (t) => {
        t.events[0].time = 251;
      },
    ],
    [
      'late landing deadline',
      (t) => {
        t.expectations.landing.settleStartTime = 2500;
      },
    ],
    [
      'changed membership',
      (t) => {
        t.committedDataKeys.pop();
      },
    ],
    [
      'lost raw baseline geometry',
      (t) => {
        delete t.samples[0].acquisition.nativeGeometry;
      },
    ],
    [
      'incomplete baseline registry',
      (t) => {
        t.samples[0].acquisition.registeredRowCount += 1;
      },
    ],
    [
      'target omitted from registry but present in raw native cells',
      (t) => {
        const e = t.samples[0].acquisition.nativeGeometry;
        const extra = structuredClone(e.capture.ruler.cells[0]);
        extra.id = `scroll-cell-${nativeOffscreenCommand.key}`;
        extra.view.identity = 'offscreen-physical-cell';
        const semantic = JSON.parse(extra.view.semanticValue);
        semantic.key = nativeOffscreenCommand.key;
        extra.view.semanticValue = JSON.stringify(semantic);
        e.capture.ruler.cells.push(extra);
      },
    ],
  ])('rejects %s instead of claiming offscreen coverage', (_name, mutate) => {
    const trace = offscreenCommandTrace();
    mutate(trace);
    expect(assessNativeEvidence(trace).status).toBe('incomplete');
  });
  it('fails complete evidence with a requested key that never becomes visible', () => {
    const trace = offscreenCommandTrace();
    const stationary = make();
    trace.samples = stationary.samples.map((sample, index) => {
      sample.acquisition.jsCoherence =
        trace.samples[index].acquisition.jsCoherence;
      return sample;
    });
    trace.baseline = trace.samples[0];
    trace.result = assessScrollTrace(trace.samples, trace.expectations);
    const result = assessNativeEvidence(trace);
    expect(result.status, JSON.stringify(result)).toBe('fail');
    expect(result.issues).toContain('target-missing');
  });
});

describe('the real Node native replay entry', () => {
  it('imports and replays both commands without a test-runner module resolver', () => {
    const missingContract = offscreenCommandTrace();
    delete missingContract.nativeOffscreenCommandContract;
    const output = execFileSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--input-type=module',
        '--eval',
        `import { readFileSync } from 'node:fs';
import { assessNativeEvidence } from './scripts/scroll-stability-native-evidence.mjs';
const traces = JSON.parse(readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(traces.map(assessNativeEvidence)));`,
      ],
      {
        cwd: fileURLToPath(new URL('../../../', import.meta.url)),
        env: { ...process.env, NODE_OPTIONS: '' },
        input: JSON.stringify([
          centerCommandTrace(),
          offscreenCommandTrace(),
          missingContract,
        ]),
        encoding: 'utf8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    expect(JSON.parse(output).map((result) => result.status)).toEqual([
      'recorded-sampled-pass',
      'recorded-sampled-pass',
      'incomplete',
    ]);
  });
});

describe('nonanimated first native movement must already land on its current target', () => {
  // Update the real native capture and independently regenerate its snapshot.
  // Never edit only producer coordinates to manufacture coherent evidence.
  const move = (trace, index, y, offset = 500) => {
    const e = trace.samples[index].acquisition.nativeGeometry;
    const membership = trace.samples[index].acquisition.jsCoherence;
    for (const row of [...e.capture.rows, ...e.capture.ruler.cells]) {
      row.view.frame.y = y;
      row.view.clipFrame.y = y;
    }
    e.capture.scroll.offset.y = offset;
    e.capture.scroll.bounds.y = offset;
    regenerate(trace, index);
    trace.samples[index].acquisition.jsCoherence = membership;
  };
  it('accepts a direct centered native landing', () => {
    expect(assessNativeEvidence(offscreenCommandTrace()).status).toBe(
      'recorded-sampled-pass'
    );
  });
  it('accepts the closest legal clamped target on the first movement', () => {
    const trace = offscreenCommandTrace();
    for (let i = 1; i < trace.samples.length; i++) move(trace, i, 10, 0);
    const result = assessNativeEvidence(trace);
    expect(result.status, JSON.stringify(result)).toBe('recorded-sampled-pass');
  });
  it('rejects an intermediate wrong stop before a perfect deadline tail', () => {
    const trace = offscreenCommandTrace();
    move(trace, 1, 50);
    const result = assessNativeEvidence(trace);
    expect(result.status, JSON.stringify(result)).toBe('fail');
    expect(result.issues).toContain('command-trajectory-wrong-landing');
  });
  it('does not promote a wrong stop when its baseline acquisition is invalid', () => {
    const trace = offscreenCommandTrace();
    move(trace, 1, 50);
    trace.samples[0].acquisition.nativeGeometry.issues.push('invalid-baseline');
    expect(assessNativeEvidence(trace).status).toBe('incomplete');
  });
  it('preserves a valid wrong-stop failure alongside a later cadence gap', () => {
    const trace = offscreenCommandTrace();
    move(trace, 1, 50);
    trace.samples.splice(4, 2);
    trace.result = assessScrollTrace(trace.samples, trace.expectations);
    const result = assessNativeEvidence(trace);
    expect(result.status, JSON.stringify(result)).toBe('fail');
    expect(result.issues).toContain('command-trajectory-wrong-landing');
    expect(result.issues).toContain('sample-gap');
  });
  it('permits stationary acquisition before the one correct native movement', () => {
    const trace = offscreenCommandTrace();
    for (let i = 1; i <= 3; i++) move(trace, i, 50, 900);
    const result = assessNativeEvidence(trace);
    expect(result.status, JSON.stringify(result)).toBe('recorded-sampled-pass');
  });
});

// The footer is the measured trailing region after the declared final row,
// combined with its scoped thinking request. No thinking-host frame is inferred.
function thinkingPair() {
  const trace = make();
  const key = 'scroll-fixture-119';
  const keys = [key];
  const scope = 'native-import-scope';
  const pair = trace.samples.slice(1, 3).map((sample, index) => {
    const e = sample.acquisition.nativeGeometry;
    e.bracket.requestedAt = index ? 59 : 40;
    e.bracket.receivedAt = index ? 60 : 50;
    e.capture.startedAt = 100000 + (index ? 59 : 41);
    e.capture.finishedAt = 100000 + (index ? 59.5 : 42);
    e.capture.scroll.contentSize.height = index ? 1052 : 1000;
    const row = e.capture.rows[0].view;
    const cell = e.capture.ruler.cells[0].view;
    const binding = {
      status: 'ok',
      key,
      revision: 'row-revision',
      fixtureScope: scope,
      rowId: `scroll-row-${key}`,
      cellId: `scroll-cell-${key}`,
      rowViewIdentity: 'row-lifetime',
      cellViewIdentity: 'cell-lifetime',
      registrationIdentity: 'registration-lifetime',
      hostIdentity: 'host-lifetime',
    };
    row.lifetimeIdentity = binding.rowViewIdentity;
    cell.lifetimeIdentity = binding.cellViewIdentity;
    e.capture.root.lifetimeIdentity = 'root-lifetime';
    e.capture.composer.lifetimeIdentity = 'composer-lifetime';
    e.capture.scroll.view.lifetimeIdentity = 'scroll-lifetime';
    const membership = {
      version: 1,
      status: 'ok',
      scopeIdentity: 'scope-lifetime',
      scope,
      visit: 'visit',
      dataRevision: '1',
      rows: [{ key, revision: 'row-revision' }],
    };
    e.capture.nativeReading = {
      generation: 7,
      surface: 3,
      committedMembership: membership,
      rowBindings: { ...membership, rows: [binding] },
    };
    const result = adaptNativeScrollGeometry(e.capture, e.request, e.bracket);
    expect(result.issues).toEqual([]);
    result.snapshot.acquisition.jsCoherence = {
      listPresent: true,
      listIdentityStable: true,
      composerIdentityStable: true,
      requiredRowsStable: true,
      membershipStable: true,
      scopeStable: true,
      semanticStable: true,
      coherent: true,
      changedRequiredRows: [],
      semanticTarget: null,
      before: { scope, keys, semanticCommit: null },
      after: { scope, keys, semanticCommit: null },
    };
    return result.snapshot;
  });
  const events = [
    {
      time: 40.5,
      name: 'thinking-request',
      values: { visible: true, label: 'Thinking...', layoutChange: true },
    },
    {
      time: 49.85,
      name: 'thinking-layout',
      values: { conversationId: scope, height: 52 },
    },
    {
      time: 52,
      name: 'thinking-commit',
      values: { conversationId: scope, visible: true, label: 'Thinking...' },
    },
  ];
  return { pair, events, keys };
}
const explainsThinking = ({ pair, events, keys }) =>
  nativeThinkingGestureExtentIsMeasured(pair[0], pair[1], events, keys);

describe('thinking request association with measured native trailing geometry', () => {
  it('accepts a callback received during the old acquisition before the new extent is observed', () => {
    expect(explainsThinking(thinkingPair())).toBe(true);
  });
  it('accepts a separately requested disappearance with the same native owner', () => {
    const fixture = thinkingPair();
    for (const [i, sample] of fixture.pair.entries()) {
      sample.contentLength = i ? 1000 : 1052;
      sample.acquisition.nativeGeometry.capture.scroll.contentSize.height =
        sample.contentLength;
    }
    fixture.events[0].values.visible = false;
    fixture.events[0].values.label = '';
    fixture.events[1].values.height = 0;
    fixture.events[2].values.visible = false;
    expect(explainsThinking(fixture)).toBe(true);
  });
  it('uses the final declared logical row, even when that row is outside the visible viewport', () => {
    const fixture = thinkingPair();
    fixture.keys.unshift('reading');
    for (const sample of fixture.pair) {
      const e = sample.acquisition.nativeGeometry;
      // Keep an independently visible row: the logical tail is not the last
      // visible row, and an otherwise blank populated viewport is invalid.
      const visible = structuredClone(e.capture.rows[0]);
      visible.id = 'scroll-row-reading';
      visible.view.identity = 'reading-view';
      visible.view.lifetimeIdentity = 'reading-lifetime';
      visible.view.containingCellIdentity = 'reading-cell';
      const semantic = JSON.parse(visible.view.semanticValue);
      semantic.key = 'reading';
      visible.view.semanticValue = JSON.stringify(semantic);
      e.capture.rows.push(visible);
      e.request.rows.push({ key: 'reading', id: visible.id });
      e.capture.rowIds.push(visible.id);
      e.capture.ruler.cells.push({
        id: 'scroll-cell-reading',
        matches: 1,
        view: {
          ...structuredClone(visible.view),
          identity: 'reading-cell',
          lifetimeIdentity: 'reading-cell-lifetime',
        },
      });
      e.capture.nativeReading.committedMembership.rows.unshift({
        key: 'reading',
        revision: 'reading-revision',
      });
      e.capture.scroll.offset.y -= 200;
      e.capture.scroll.bounds.y -= 200;
      sample.scroll -= 200;
      for (const item of [e.capture.rows[0], e.capture.ruler.cells[0]]) {
        item.view.frame = { ...item.view.frame, y: item.view.frame.y + 200 };
        item.view.clipFrame = { x: 0, y: 0, width: 0, height: 0 };
      }
      expect(
        adaptNativeScrollGeometry(e.capture, e.request, e.bracket).issues
      ).toEqual([]);
    }
    expect(explainsThinking(fixture)).toBe(true);
  });
  const corruptions = [
    [
      'unrelated extra extent despite nearby callback',
      (f) => {
        f.pair[1].contentLength += 17;
        f.pair[1].acquisition.nativeGeometry.capture.scroll.contentSize.height += 17;
        f.events[1].time = 51;
      },
    ],
    [
      'same extent but displaced final cell',
      (f) => {
        f.pair[1].acquisition.nativeGeometry.capture.ruler.cells[0].view.frame.y += 5;
      },
    ],
    [
      'changed cell height',
      (f) => {
        f.pair[1].acquisition.nativeGeometry.capture.ruler.cells[0].view.frame.height += 5;
      },
    ],
    [
      'changed cell width',
      (f) => {
        f.pair[1].acquisition.nativeGeometry.capture.ruler.cells[0].view.frame.width += 5;
      },
    ],
    [
      'different final logical row',
      (f) => {
        f.keys.push('unmeasured-logical-tail');
      },
    ],
    [
      'missing native final-row binding',
      (f) => {
        f.pair[1].acquisition.nativeGeometry.capture.nativeReading.rowBindings.rows =
          [];
      },
    ],
    [
      'duplicate final-row binding',
      (f) => {
        const r =
          f.pair[1].acquisition.nativeGeometry.capture.nativeReading.rowBindings
            .rows;
        r.push(structuredClone(r[0]));
      },
    ],
    [
      'removed/reinserted row revision',
      (f) => {
        f.pair[1].acquisition.nativeGeometry.capture.nativeReading.committedMembership.rows[0].revision =
          'new';
      },
    ],
    [
      'recycled cell lifetime',
      (f) => {
        f.pair[1].acquisition.nativeGeometry.capture.ruler.cells[0].view.lifetimeIdentity =
          'new-cell';
      },
    ],
    [
      'reused registration',
      (f) => {
        f.pair[1].acquisition.nativeGeometry.capture.nativeReading.rowBindings.rows[0].registrationIdentity =
          'new-registration';
      },
    ],
    [
      'new native command generation',
      (f) => {
        f.pair[1].acquisition.nativeGeometry.capture.nativeReading.generation++;
      },
    ],
    [
      'new physical scope',
      (f) => {
        f.pair[1].acquisition.nativeGeometry.capture.nativeReading.committedMembership.scopeIdentity =
          'new-scope';
      },
    ],
    [
      'new visit',
      (f) => {
        f.pair[1].acquisition.nativeGeometry.capture.nativeReading.committedMembership.visit =
          'new-visit';
      },
    ],
    [
      'replaced physical list',
      (f) => {
        f.pair[1].acquisition.nativeGeometry.capture.scroll.view.lifetimeIdentity =
          'new-list';
      },
    ],
    [
      'keyboard inset change',
      (f) => {
        f.pair[1].acquisition.nativeGeometry.capture.scroll.adjustedContentInset.bottom = 20;
      },
    ],
    [
      'composer resize',
      (f) => {
        const v = f.pair[1].acquisition.nativeGeometry.capture.composer;
        v.frame.height += 10;
        v.clipFrame.height += 10;
      },
    ],
    [
      'Latest surface moves',
      (f) => {
        const v =
          f.pair[1].acquisition.nativeGeometry.capture.ruler.surfaces[1].view;
        v.frame.y += 10;
        v.clipFrame.y += 10;
      },
    ],
    [
      'retired native drag ownership',
      (f) => {
        f.pair[1].acquisition.nativeGeometry.capture.scroll.dragging = true;
      },
    ],
    [
      'changed data before/after bridge',
      (f) => {
        f.pair[1].acquisition.jsCoherence.membershipStable = false;
      },
    ],
    [
      'JS acquisition exceeds32ms',
      (f) => {
        f.pair[0].measurement.durationMs = 33;
      },
    ],
    [
      'sample gap exceeds125ms',
      (f) => {
        f.pair[1].time = 180;
      },
    ],
    [
      'unknown measured extent',
      (f) => {
        f.pair[1].acquisition.nativeGeometry.capture.scroll.contentSize.height =
          NaN;
      },
    ],
    [
      'missing semantic request',
      (f) => {
        f.events.shift();
      },
    ],
    [
      'request has no layout change',
      (f) => {
        f.events[0].values.layoutChange = false;
      },
    ],
    [
      'stale request before previous acquisition',
      (f) => {
        f.events[0].time = 39;
      },
    ],
    [
      'late callback after observation',
      (f) => {
        f.events[1].time = 61;
        f.events.sort((a, b) => a.time - b.time);
      },
    ],
    [
      'stale wrong callback height',
      (f) => {
        f.events[1].values.height = 0;
      },
    ],
    [
      'foreign callback conversation',
      (f) => {
        f.events[1].values.conversationId = 'other';
      },
    ],
    [
      'foreign commit conversation',
      (f) => {
        f.events[2].values.conversationId = 'other';
      },
    ],
    [
      'commit label belongs to another request',
      (f) => {
        f.events[2].values.label = 'Other';
      },
    ],
    [
      'missing semantic commit',
      (f) => {
        f.events.pop();
      },
    ],
    [
      'superseded request',
      (f) => {
        f.events.splice(1, 0, {
          time: 41,
          name: 'thinking-request',
          values: { visible: false, layoutChange: true },
        });
      },
    ],
    [
      'ambiguous repeated layout callback',
      (f) => {
        f.events.splice(2, 0, structuredClone(f.events[1]));
      },
    ],
    [
      'missing loaded key declaration',
      (f) => {
        f.keys = undefined;
      },
    ],
    [
      'missing native surface',
      (f) => {
        delete f.pair[1].acquisition.nativeGeometry.capture.nativeReading
          .surface;
      },
    ],
    [
      'inconsistent coherence flags',
      (f) => {
        f.pair[1].acquisition.jsCoherence.listIdentityStable = false;
      },
    ],
    [
      'native acquisition order reversed',
      (f) => {
        const g = f.pair[1].acquisition.nativeGeometry.capture;
        g.startedAt = 99999;
        g.finishedAt = 99999.5;
      },
    ],
    [
      'new accepted target pending native delivery',
      (f) => {
        f.events.splice(2, 0, { time: 51, name: 'center-command-request' });
      },
    ],
    [
      'new route/reset intent',
      (f) => {
        f.events.splice(2, 0, { time: 51, name: 'reset' });
      },
    ],
    [
      'native gesture completion inside attribution',
      (f) => {
        f.events.splice(2, 0, { time: 51, name: 'drag-end' });
      },
    ],
  ];
  it.each(corruptions)('rejects %s', (_, corrupt) => {
    const fixture = thinkingPair();
    corrupt(fixture);
    expect(explainsThinking(fixture)).toBe(false);
  });
});
