import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = mkdtempSync(join(tmpdir(), 'native-mutation-controls-'));
const proposal = root;
const { assessNativeMutationEvidence: assess } = await import(
  pathToFileURL(
    `${proposal}/scripts/scroll-stability-native-mutation-evidence.mjs`
  )
);
const { rowMutationContractFingerprint: fingerprint } = await import(
  pathToFileURL(`${root}/packages/app/fixtures/scrollStabilityMutation.ts`)
);
const { assessNativeEvidence: assessPublic } = await import(
  pathToFileURL(`${proposal}/scripts/scroll-stability-native-evidence.mjs`)
);
const { classifyEvidence, qualifyEvidence, createCoverageReport } =
  await import(
    pathToFileURL(`${proposal}/scripts/scroll-stability-report.mjs`)
  );
function coverageFor(trace) {
  return createCoverageReport({
    matrixMarkdown: '| REG-01 | Removal |',
    historyMarkdown: '| OLD-001 | Retained failure |',
    registry: [
      {
        scenario: trace.scenario,
        matrix: ['REG-01'],
        history: ['OLD-001'],
        scope: 'Synthetic reporter composition only',
      },
    ],
    evidence: [{ source: 'synthetic-native.json', value: trace }],
  });
}
// Small synthetic model fixture. No product trace, captured result or local path is required.
const scope = 'fixture-channel::1',
  keys = [
    'scroll-fixture-109',
    'scroll-fixture-110',
    'scroll-fixture-111',
    'scroll-fixture-112',
  ];
const view = (identity, y, height, descendantOfScroll) => ({
  identity,
  windowIdentity: 'window',
  frame: { x: 0, y, width: 400, height },
  clipFrame: { x: 0, y, width: 400, height },
  attached: true,
  effectiveAlpha: 1,
  hidden: false,
  translationOnly: true,
  descendantOfScroll,
});
const inset = { top: 0, right: 0, bottom: 0, left: 0 };
const request = {
  rootId: 'fixture-root',
  scrollViewId: 'fixture-scroll',
  composerId: 'fixture-composer',
  rowPrefix: 'scroll-row-',
  durationMs: 3300,
  maximumFrames: 900,
};
const rows = keys.map((key, i) => ({
  id: `scroll-row-${key}`,
  matches: 1,
  view: {
    ...view(`row-pointer:${key}`, 150 + i * 100, 80, true),
    containingCellIdentity: `cell-pointer:${key}`,
    semanticValue: JSON.stringify({
      version: 1,
      scope,
      key,
      signature: { content: 'unchanged', reactions: '[]', replies: 0 },
    }),
  },
}));
const baseGeometry = {
  version: 1,
  requestId: 'base:0',
  ...request,
  rowIds: rows.map((r) => r.id),
  clock: 'CACurrentMediaTime milliseconds',
  coordinateSpace: 'window-model-points',
  startedAt: 0,
  finishedAt: 1,
  status: 'ok',
  issues: [],
  visitedViews: 20,
  root: {
    ...view('root', 0, 800, false),
    semanticValue: JSON.stringify({ version: 1, scope, requestedKeys: keys }),
  },
  composer: view('composer', 700, 100, false),
  scroll: {
    view: view('scroll', 100, 600, true),
    hostIdentity: 'scroll-host',
    offset: { x: 0, y: 900 },
    contentSize: { width: 400, height: 2000 },
    bounds: { x: 0, y: 900, width: 400, height: 600 },
    contentInset: inset,
    adjustedContentInset: inset,
    zoomScale: 1,
    tracking: false,
    dragging: false,
    decelerating: false,
  },
  rows,
  ruler: {
    version: 1,
    cells: rows.map((r, i) => ({
      id: `scroll-cell-${keys[i]}`,
      matches: 1,
      view: { ...r.view, identity: `cell-pointer:${keys[i]}` },
    })),
    manifest: {
      id: 'scroll-surface-manifest',
      matches: 1,
      view: {
        ...view('manifest', 790, 1, false),
        semanticValue: JSON.stringify({
          version: 1,
          scope,
          surfaceIds: ['scroll-surface-body'],
        }),
      },
    },
    surfaces: [
      {
        id: 'scroll-surface-body',
        matches: 1,
        view: view('body', 700, 100, false),
      },
    ],
  },
};
const original = {
  fixtureVersion: 2,
  platform: 'ios',
  productCoverage: 'local-component-fixture',
  mutationScope: scope,
  mutationEvidence: {},
  expectations: { anchor: { key: keys[2] } },
  samples: [{ measurement: { valid: true, durationMs: 1 } }],
  nativeRecordingContract: {
    recordingId: 'base',
    scope,
    request,
    requiredKeys: [keys[2]],
    populated: true,
    visibility: 'require-visible',
    minimumDurationMs: 1675,
  },
  nativeRecording: {
    version: 1,
    clock: 'CACurrentMediaTime milliseconds',
    coordinateSpace: 'window-model-points',
    nativePresentation: 'INCOMPLETE',
    frames: [{ geometry: baseGeometry }],
  },
};
const clone = (x) => structuredClone(x),
  signature = (content) => ({ content, reactions: '[]', replies: 0 });
function fixture(kind = 'cache', position = 'history') {
  const t = clone(original),
    scope = t.mutationScope,
    key = 'scroll-fixture-109',
    anchor = 'scroll-fixture-111';
  t.runId = 'native-controls';
  t.scenario = `${position}-${kind}`;
  const rid = `${t.runId}:${t.scenario}:1`,
    requestId = `${t.runId}:${t.scenario}:mutation`;
  const baseline = { presence: 'present', signature: signature('before') },
    expected =
      kind === 'remove'
        ? { presence: 'absent' }
        : { presence: 'present', signature: signature('after') };
  const p = {
    version: 1,
    scope,
    key,
    kind,
    declaredAt: 100,
    baseline: {
      requestId: `${requestId}:baseline`,
      revision: 'baseline-render',
      state: baseline,
    },
    coverage: {
      startTime: 100,
      endTime: 2100,
      maxGapMs: 125,
      maxMeasurementDurationMs: 32,
    },
    deferredUntil: 700,
    phases: [
      {
        id: 'mutation-ready',
        requestId,
        revision: 'expected-render',
        state: expected,
        requestWindow: { startTime: 300, endTime: 500 },
        observationWindow: { startTime: 700, endTime: 2100 },
        effect:
          kind === 'remove'
            ? 'remove'
            : kind === 'reference'
              ? 'commit'
              : 'resize',
      },
    ],
  };
  const c = {
    version: 1,
    recordingId: rid,
    requestId,
    requestMarker: `${requestId}:native-request`,
    declaredAt: 101,
    scope,
    key,
    kind,
    baseline,
    expected,
    anchorKey: anchor,
    readyDeadlineMs: 400,
    quietTailMs: 1000,
    minimumDurationMs: 1800,
  };
  t.nativeMutationContract = c;
  t.mutationEvidence.contract = p;
  t.expectations.anchor.key = anchor;
  t.nativeRecordingContract = {
    ...t.nativeRecordingContract,
    recordingId: rid,
  };
  t.nativeRecordingTransfer = {
    startAcknowledgedAt: 110,
    earliestStopAt: 1910,
    requestedAt: 2110,
    receivedAt: 2111,
    clock: 'performance.now milliseconds',
  };
  t.nativeMutationMarkerTransfer = {
    name: c.requestMarker,
    requestedAt: 399,
    receivedAt: 400,
    clock: 'performance.now milliseconds',
  };
  t.events = [
    {
      time: p.declaredAt,
      name: 'row-mutation-plan',
      values: { contract: fingerprint(p) },
    },
    {
      time: c.declaredAt,
      name: 'native-mutation-plan',
      values: { contract: JSON.stringify(c) },
    },
    { time: 111, name: 'scenario-start', values: { scenario: t.scenario } },
    {
      time: 401,
      name: 'row-mutation-request',
      values: {
        key,
        kind,
        scope,
        phaseId: p.phases[0].id,
        requestId,
        revision: p.phases[0].revision,
      },
    },
  ];
  const base = clone(original.nativeRecording.frames[0].geometry);
  const keys = JSON.parse(base.root.semanticValue).requestedKeys;
  function viewUUIDs(g) {
    const visit = (v) => {
      if (v) v.lifetimeIdentity = `lifetime:${v.identity}`;
    };
    visit(g.root);
    visit(g.composer);
    visit(g.scroll.view);
    for (const r of g.rows) visit(r.view);
    for (const r of g.ruler.cells) visit(r.view);
  }
  const frames = [];
  for (let i = 0; i <= 100; i++) {
    const g = clone(base),
      time = 10000 + i * 20;
    g.startedAt = time;
    g.finishedAt = time + 1;
    g.requestId = `${rid}:${i}`;
    const remove = kind === 'remove' && i >= 20;
    if (remove) {
      g.rows = g.rows.filter((r) => r.id !== `scroll-row-${key}`);
      g.rowIds = g.rowIds.filter((id) => id !== `scroll-row-${key}`);
      g.ruler.cells = g.ruler.cells.filter(
        (r) => r.id !== `scroll-cell-${key}`
      );
    }
    for (const list of [g.rows, g.ruler.cells])
      for (const row of list) {
        const meta = JSON.parse(row.view.semanticValue);
        if (meta.key === key)
          meta.signature = i >= 20 ? expected.signature : baseline.signature;
        row.view.semanticValue = JSON.stringify(meta);
      }
    viewUUIDs(g);
    const members = keys
      .filter((k) => !remove || k !== key)
      .map((k) => ({ key: k, revision: `incarnation:${k}` }));
    const m = {
      version: 1,
      status: 'ok',
      scopeIdentity: 'scope-registration/physical-host',
      scope: 'chat/~nibset-napwyn/intros',
      visit: 'actual-visit',
      dataRevision: remove ? 'membership-2' : 'membership-1',
      rows: members,
    };
    g.nativeReading = {
      committedMembership: m,
      rowBindings: {
        version: 1,
        status: 'ok',
        scopeIdentity: m.scopeIdentity,
        scope: m.scope,
        visit: m.visit,
        dataRevision: m.dataRevision,
        rows: g.rows.map((row) => {
          const k = row.id.slice(11),
            cell = g.ruler.cells.find((c) => c.id === `scroll-cell-${k}`);
          return {
            status: 'ok',
            rowId: row.id,
            cellId: cell.id,
            key: k,
            revision: `incarnation:${k}`,
            fixtureScope: scope,
            rowViewIdentity: row.view.lifetimeIdentity,
            cellViewIdentity: cell.view.lifetimeIdentity,
            registrationIdentity: `registration:${k}`,
            hostIdentity: `host:${k}`,
          };
        }),
      },
    };
    frames.push({
      sequence: i,
      trigger: i ? 'display-link' : 'start',
      ...(i
        ? {
            displayLinkTimestamp: time - 1,
            displayLinkTargetTimestamp: time + 15,
          }
        : {}),
      geometry: g,
    });
  }
  t.nativeRecording = {
    ...t.nativeRecording,
    recordingId: rid,
    request: t.nativeRecordingContract.request,
    startedAt: 10000,
    stoppedAt: 12001,
    stopReason: 'requested',
    frames,
    markers: [
      { sequence: 0, name: 'action-start', time: 10010 },
      { sequence: 1, name: c.requestMarker, time: 10390 },
    ],
  };
  return t;
}
const cases = [];
function test(name, fn) {
  try {
    fn();
    cases.push({ name, status: 'PASS' });
  } catch (e) {
    cases.push({ name, status: 'FAIL', error: String(e) });
  }
}
function check(name, mutate, verdict = 'INCOMPLETE', code) {
  test(name, () => {
    const t = fixture();
    mutate(t);
    const r = assess(t);
    assert.equal(r.verdict, verdict, JSON.stringify(r));
    if (code)
      assert(
        r.issues.some((i) => i.code === code),
        JSON.stringify(r)
      );
  });
}
for (const kind of ['cache', 'grow', 'remove'])
  test(`${kind} native authority positive`, () =>
    assert.equal(
      assess(fixture(kind)).verdict,
      'PASS',
      JSON.stringify(assess(fixture(kind)))
    ));
check('missing native contract', (t) => delete t.nativeMutationContract);
check(
  'forged declaration serialization',
  (t) => (t.events[1].values.contract = '{}')
);
check('declaration after recorder ack', (t) => {
  t.nativeMutationContract.declaredAt = 120;
  t.events[1].time = 120;
  t.events[1].values.contract = JSON.stringify(t.nativeMutationContract);
});
check(
  'wrong prior mutation plan',
  (t) => (t.mutationEvidence.contract.phases[0].requestId = 'other')
);
check('duplicate native marker', (t) =>
  t.nativeRecording.markers.push({
    ...t.nativeRecording.markers[1],
    sequence: 2,
  })
);
check('missing native marker', (t) => t.nativeRecording.markers.pop());
check(
  'marker crosses capture',
  (t) => (t.nativeRecording.markers[1].time = 10400.5)
);
check(
  'ack after action request',
  (t) => (t.nativeMutationMarkerTransfer.receivedAt = 402)
);
check(
  'wrong marker transfer name',
  (t) => (t.nativeMutationMarkerTransfer.name = 'other')
);
check('duplicate request event', (t) => t.events.push(clone(t.events.at(-1))));
check(
  'early stop transfer',
  (t) => (t.nativeRecordingTransfer.requestedAt = 1000)
);
check('short1800 native window', (t) => {
  t.nativeRecording.frames = t.nativeRecording.frames.slice(0, 86);
  t.nativeRecording.stoppedAt = 11701;
});
check(
  'overlong operation33ms',
  (t) => (t.nativeRecording.frames[10].geometry.startedAt -= 33)
);
check('coverage gap', (t) => {
  t.nativeRecording.frames.splice(10, 7);
  t.nativeRecording.frames.forEach((f, i) => {
    f.sequence = i;
    f.geometry.requestId = `${t.nativeRecording.recordingId}:${i}`;
  });
});
check(
  'missing committed membership',
  (t) =>
    delete t.nativeRecording.frames[20].geometry.nativeReading
      .committedMembership
);
check('duplicate membership key', (t) => {
  const m =
    t.nativeRecording.frames[20].geometry.nativeReading.committedMembership;
  m.rows.push(clone(m.rows[0]));
});
check('native scope swap entire middle frame', (t) => {
  const d = t.nativeRecording.frames[20].geometry.nativeReading;
  d.committedMembership.scope = 'other';
  d.rowBindings.scope = 'other';
});
check('scope lifetime ABA', (t) => {
  const d = t.nativeRecording.frames[20].geometry.nativeReading;
  d.committedMembership.scopeIdentity = 'replacement';
  d.rowBindings.scopeIdentity = 'replacement';
});
check(
  'window ABA',
  (t) =>
    (t.nativeRecording.frames[20].geometry.root.windowIdentity = 'replacement')
);
check('malformed identical signatures', (t) => {
  const g = t.nativeRecording.frames[20].geometry;
  for (const a of [g.rows, g.ruler.cells]) {
    const row = a.find((r) => r.id.endsWith('109'));
    const m = JSON.parse(row.view.semanticValue);
    m.signature = {};
    row.view.semanticValue = JSON.stringify(m);
  }
});
check('missing physical binding', (t) =>
  t.nativeRecording.frames[20].geometry.nativeReading.rowBindings.rows.pop()
);
check(
  'binding UUID mismatch',
  (t) =>
    (t.nativeRecording.frames[20].geometry.nativeReading.rowBindings.rows[0].rowViewIdentity =
      'wrong')
);
check('same key new incarnation', (t) => {
  const g = t.nativeRecording.frames[20].geometry;
  g.nativeReading.committedMembership.rows.find((r) =>
    r.key.endsWith('109')
  ).revision = 'new';
  g.nativeReading.rowBindings.rows.find((r) => r.key.endsWith('109')).revision =
    'new';
});
check('virtualized current member cannot prove mutation', (t) => {
  for (const f of t.nativeRecording.frames.slice(20)) {
    const g = f.geometry;
    g.rows = g.rows.filter((r) => !r.id.endsWith('109'));
    g.rowIds = g.rowIds.filter((r) => !r.endsWith('109'));
    g.ruler.cells = g.ruler.cells.filter((r) => !r.id.endsWith('109'));
    g.nativeReading.rowBindings.rows = g.nativeReading.rowBindings.rows.filter(
      (r) => !r.rowId.endsWith('109')
    );
  }
});
check('member absent but stale physical row', (t) => {
  const g = t.nativeRecording.frames[20].geometry;
  g.nativeReading.committedMembership.rows =
    g.nativeReading.committedMembership.rows.filter(
      (r) => !r.key.endsWith('109')
    );
  g.nativeReading.committedMembership.dataRevision = '2';
  g.nativeReading.rowBindings.dataRevision = '2';
});
check('recycled critical row', (t) => {
  const g = t.nativeRecording.frames[20].geometry;
  g.nativeReading.rowBindings.rows.find((r) =>
    r.key.endsWith('109')
  ).registrationIdentity = 'new-object';
});
check(
  'transient38pt anchor drift preserved',
  (t) => {
    const g = t.nativeRecording.frames[30].geometry;
    const r = g.rows.find((r) => r.id.endsWith('111')).view;
    r.frame.y -= 38;
    r.clipFrame.y -= 38;
  },
  'FAIL',
  'native-anchor-drift'
);
check(
  'expected never arrives',
  (t) => {
    for (const f of t.nativeRecording.frames)
      for (const a of [f.geometry.rows, f.geometry.ruler.cells]) {
        const r = a.find((r) => r.id.endsWith('109')),
          m = JSON.parse(r.view.semanticValue);
        m.signature = t.nativeMutationContract.baseline.signature;
        r.view.semanticValue = JSON.stringify(m);
      }
  },
  'FAIL',
  'native-mutation-ready-deadline'
);
check(
  'late mutation after400ms',
  (t) => {
    for (const f of t.nativeRecording.frames.slice(20, 45))
      for (const a of [f.geometry.rows, f.geometry.ruler.cells]) {
        const r = a.find((r) => r.id.endsWith('109')),
          m = JSON.parse(r.view.semanticValue);
        m.signature = t.nativeMutationContract.baseline.signature;
        r.view.semanticValue = JSON.stringify(m);
      }
  },
  'FAIL'
);
check(
  'tail revert',
  (t) => {
    const g = t.nativeRecording.frames[90].geometry;
    for (const a of [g.rows, g.ruler.cells]) {
      const r = a.find((r) => r.id.endsWith('109')),
        m = JSON.parse(r.view.semanticValue);
      m.signature = t.nativeMutationContract.baseline.signature;
      r.view.semanticValue = JSON.stringify(m);
    }
  },
  'FAIL',
  'native-mutation-reverted'
);
check(
  'partial-width obstruction retained',
  (t) => {
    const g = t.nativeRecording.frames[40].geometry,
      anchor = g.rows.find((r) => r.id.endsWith('111')).view,
      s = g.ruler.surfaces[0].view;
    s.frame = { x: anchor.frame.x, y: anchor.frame.y, width: 1, height: 10 };
    s.clipFrame = clone(s.frame);
  },
  'FAIL',
  'native-anchor-obscured'
);
check(
  'legacy sample invalidity not repurposed',
  (t) => {
    t.samples.forEach(
      (s) => (s.measurement = { valid: false, durationMs: 999 })
    );
    t.result = { pass: true };
  },
  'PASS'
);
check(
  'native noncritical coherent recycling allowed',
  (t) => {
    const g = t.nativeRecording.frames[30].geometry,
      k = g.rows
        .find((r) => !r.id.endsWith('109') && !r.id.endsWith('111'))
        .id.slice(11),
      row = g.rows.find((r) => r.id.endsWith(k)),
      cell = g.ruler.cells.find((r) => r.id.endsWith(k)),
      b = g.nativeReading.rowBindings.rows.find((r) => r.key === k);
    row.view.identity += 'new';
    cell.view.identity += 'new';
    row.view.containingCellIdentity = cell.view.identity;
    cell.view.containingCellIdentity = cell.view.identity;
    row.view.lifetimeIdentity += 'new';
    cell.view.lifetimeIdentity += 'new';
    b.rowViewIdentity = row.view.lifetimeIdentity;
    b.cellViewIdentity = cell.view.lifetimeIdentity;
    b.registrationIdentity += 'new';
    b.hostIdentity += 'new';
  },
  'PASS'
);
test('removed then reinserted critical incarnation is incomplete', () => {
  const t = fixture('remove'),
    base = clone(t.nativeRecording.frames[0].geometry);
  for (const f of t.nativeRecording.frames.slice(60)) {
    const g = f.geometry;
    g.rows = clone(base.rows);
    g.rowIds = clone(base.rowIds);
    g.ruler.cells = clone(base.ruler.cells);
    g.nativeReading = clone(base.nativeReading);
    g.nativeReading.committedMembership.dataRevision = 'membership-3';
    g.nativeReading.rowBindings.dataRevision = 'membership-3';
  }
  assert.equal(assess(t).verdict, 'INCOMPLETE');
});
check(
  'valid38pt violation before later gap remains FAIL',
  (t) => {
    const r = t.nativeRecording.frames[30].geometry.rows.find((r) =>
      r.id.endsWith('111')
    ).view;
    r.frame.y -= 38;
    r.clipFrame.y -= 38;
    t.nativeRecording.frames.splice(60, 7);
    t.nativeRecording.frames.forEach((f, i) => {
      f.sequence = i;
      f.geometry.requestId = `${t.nativeRecording.recordingId}:${i}`;
    });
  },
  'FAIL',
  'native-anchor-drift'
);
check('healthy early gap cannot synthesize readiness failure', (t) => {
  t.nativeRecording.frames.splice(20, 7);
  t.nativeRecording.frames.forEach((f, i) => {
    f.sequence = i;
    f.geometry.requestId = `${t.nativeRecording.recordingId}:${i}`;
  });
});
check('wrong motion after gap cannot become qualified failure', (t) => {
  const r = t.nativeRecording.frames[80].geometry.rows.find((r) =>
    r.id.endsWith('111')
  ).view;
  r.frame.y -= 38;
  r.clipFrame.y -= 38;
  t.nativeRecording.frames.splice(20, 7);
  t.nativeRecording.frames.forEach((f, i) => {
    f.sequence = i;
    f.geometry.requestId = `${t.nativeRecording.recordingId}:${i}`;
  });
});
check(
  'null phase corruption returns incomplete',
  (t) => (t.mutationEvidence.contract.phases = [null])
);
check(
  'nonstring recording id corruption returns incomplete',
  (t) => (t.nativeRecordingContract.recordingId = 5)
);
check('missing requestWindow cannot bypass chronology', (t) => {
  delete t.mutationEvidence.contract.phases[0].requestWindow;
  t.events[0].values.contract = fingerprint(t.mutationEvidence.contract);
});
check(
  'missing scenario-start time cannot bypass chronology',
  (t) => delete t.events[2].time
);
check('row-cell lifetime UUID alias rejected', (t) => {
  for (const f of t.nativeRecording.frames) {
    const g = f.geometry;
    for (const b of g.nativeReading.rowBindings.rows) {
      const row = g.rows.find((r) => r.id === b.rowId),
        cell = g.ruler.cells.find((r) => r.id === b.cellId);
      cell.view.lifetimeIdentity = row.view.lifetimeIdentity;
      b.cellViewIdentity = row.view.lifetimeIdentity;
    }
  }
});
check(
  'stable UUID cannot acquire another native pointer',
  (t) =>
    (t.nativeRecording.frames[30].geometry.rows.find((r) =>
      r.id.endsWith('109')
    ).view.identity = 'replacement-pointer')
);
check('root-row UUID alias rejected', (t) => {
  const g = t.nativeRecording.frames[30].geometry;
  g.root.lifetimeIdentity = g.rows[0].view.lifetimeIdentity;
});
test('unbound same-frame anchor drift never contributes a metric', () => {
  const t = fixture();
  const g = t.nativeRecording.frames[30].geometry;
  const row = g.rows.find((r) => r.id.endsWith('111')).view;
  row.frame.y -= 38;
  row.clipFrame.y -= 38;
  g.nativeReading.rowBindings.rows.find((r) => r.key.endsWith('111')).status =
    'unavailable';
  const result = assess(t);
  assert.equal(result.verdict, 'INCOMPLETE');
  assert.equal(
    result.issues.some(
      (issue) =>
        issue.code === 'native-anchor-drift' && issue.kind === 'failure'
    ),
    false
  );
  assert.equal(result.metrics.maxAnchorDriftPt, 0);
});
// Same existing raw authority fixture, extended through the actual importer.
for (const position of ['near', 'history']) {
  for (const kind of [
    'grow',
    'shrink',
    'reference',
    'media',
    'remove',
    'reaction',
    'reply',
    'cache',
  ]) {
    if (position === 'history' && ['grow', 'remove', 'cache'].includes(kind))
      continue;
    test(`${position}-${kind} exact declared native mutation`, () => {
      const result = assess(fixture(kind, position));
      assert.equal(result.verdict, 'PASS', JSON.stringify(result));
      assert.equal(result.anchorContinuity?.verdict, 'PASS');
    });
  }
}
function moveAnchor(t, frame = 30) {
  const row = t.nativeRecording.frames[frame].geometry.rows.find((r) =>
    r.id.endsWith('111')
  ).view;
  row.frame.y -= 38;
  row.clipFrame.y -= 38;
}
function unbindTarget(t, frame = 30) {
  t.nativeRecording.frames[frame].geometry.nativeReading.rowBindings.rows.find(
    (b) => b.key.endsWith('109')
  ).status = 'unavailable';
}
test('same-frame unbound target cannot hide independently bound anchor drift', () => {
  const t = fixture();
  unbindTarget(t);
  moveAnchor(t);
  const result = assess(t);
  assert.equal(result.verdict, 'INCOMPLETE');
  assert.equal(
    result.anchorContinuity?.verdict,
    'FAIL',
    JSON.stringify(result)
  );
  assert.equal(result.anchorContinuity.metrics.maxAnchorDriftPt, 38);
});
test('earlier target retirement cannot stop later qualified anchor continuity', () => {
  const t = fixture();
  unbindTarget(t, 20);
  moveAnchor(t);
  const result = assess(t);
  assert.equal(result.verdict, 'INCOMPLETE');
  assert.equal(
    result.anchorContinuity?.verdict,
    'FAIL',
    JSON.stringify(result)
  );
  assert.equal(result.anchorContinuity.metrics.qualifiedFrames, 101);
});
test('healthy independent anchor never qualifies unavailable target semantics', () => {
  const t = fixture();
  unbindTarget(t);
  const result = assess(t);
  assert.equal(result.verdict, 'INCOMPLETE');
  assert.equal(
    result.anchorContinuity?.verdict,
    'PASS',
    JSON.stringify(result)
  );
});
function invalidAnchor(name, mutate) {
  test(name, () => {
    const t = fixture();
    mutate(t);
    moveAnchor(t);
    const result = assess(t);
    assert.equal(result.verdict, 'INCOMPLETE', JSON.stringify(result));
    assert.equal(result.anchorContinuity?.verdict, 'INCOMPLETE');
    assert.equal(result.anchorContinuity.metrics.maxAnchorDriftPt, 0);
    assert(
      !result.anchorContinuity.issues.some(
        (i) => i.code === 'native-anchor-drift'
      )
    );
  });
}
invalidAnchor(
  'same-frame unbound anchor cannot contribute continuity drift',
  (t) => {
    t.nativeRecording.frames[30].geometry.nativeReading.rowBindings.rows.find(
      (b) => b.key.endsWith('111')
    ).status = 'unavailable';
  }
);
invalidAnchor('same-frame edited anchor signature retires continuity', (t) => {
  const g = t.nativeRecording.frames[30].geometry;
  for (const rows of [g.rows, g.ruler.cells]) {
    const row = rows.find((r) => r.id.endsWith('111'));
    const meta = JSON.parse(row.view.semanticValue);
    meta.signature.content = 'edited';
    row.view.semanticValue = JSON.stringify(meta);
  }
});
invalidAnchor('same-frame resized inner anchor retires continuity', (t) => {
  const row = t.nativeRecording.frames[30].geometry.rows.find((r) =>
    r.id.endsWith('111')
  ).view;
  row.frame.height += 1;
  row.clipFrame.height += 1;
});
invalidAnchor(
  'same-frame changed outer reserved dimensions retire continuity',
  (t) => {
    const cell = t.nativeRecording.frames[30].geometry.ruler.cells.find((r) =>
      r.id.endsWith('111')
    ).view;
    cell.frame.height += 1;
    cell.clipFrame.height += 1;
  }
);
invalidAnchor(
  'same-frame replacement anchor registration cannot own old point',
  (t) => {
    t.nativeRecording.frames[30].geometry.nativeReading.rowBindings.rows.find(
      (b) => b.key.endsWith('111')
    ).registrationIdentity += ':replacement';
  }
);
invalidAnchor('retired anchor cannot revive after signature ABA', (t) => {
  for (const rows of [
    t.nativeRecording.frames[20].geometry.rows,
    t.nativeRecording.frames[20].geometry.ruler.cells,
  ]) {
    const row = rows.find((r) => r.id.endsWith('111'));
    const meta = JSON.parse(row.view.semanticValue);
    meta.signature.content = 'temporary';
    row.view.semanticValue = JSON.stringify(meta);
  }
});
for (const flag of ['tracking', 'dragging', 'decelerating']) {
  invalidAnchor(
    `actual native ${flag} cannot qualify stationary continuity`,
    (t) => {
      t.nativeRecording.frames[30].geometry.scroll[flag] = true;
    }
  );
}
invalidAnchor('target cannot duplicate anchor registration authority', (t) => {
  const g = t.nativeRecording.frames[30].geometry;
  const target = g.rows.shift();
  g.rows.push(target);
  g.rowIds = g.rows.map((r) => r.id);
  const targetBinding = g.nativeReading.rowBindings.rows.find((b) =>
    b.key.endsWith('109')
  );
  targetBinding.registrationIdentity = g.nativeReading.rowBindings.rows.find(
    (b) => b.key.endsWith('111')
  ).registrationIdentity;
});
test('reference contract requires actual commit effect', () => {
  const t = fixture('reference', 'near');
  t.mutationEvidence.contract.phases[0].effect = 'resize';
  t.events[0].values.contract = fingerprint(t.mutationEvidence.contract);
  assert.equal(assess(t).verdict, 'INCOMPLETE');
});
for (const position of ['unknown', 'command', 'gesture']) {
  test(`${position} cannot borrow the stationary mutation contract`, () => {
    const result = assess(fixture('cache', position));
    assert.equal(result.verdict, 'INCOMPLETE');
    assert.equal(result.anchorContinuity?.verdict, 'INCOMPLETE');
  });
}
test('undeclared viewport reference cannot replace window hold', () => {
  const t = fixture();
  t.expectations.anchor.reference = 'viewport-top';
  assert.equal(assess(t).anchorContinuity?.verdict, 'INCOMPLETE');
});
test('qualified anchor failure before gap remains independent failure', () => {
  const t = fixture('cache', 'near');
  moveAnchor(t);
  t.nativeRecording.frames.splice(60, 7);
  t.nativeRecording.frames.forEach((f, i) => {
    f.sequence = i;
    f.geometry.requestId = `${t.nativeRecording.recordingId}:${i}`;
  });
  const result = assess(t);
  assert.equal(result.anchorContinuity?.verdict, 'FAIL');
  assert.equal(result.anchorContinuity.metrics.maxAnchorDriftPt, 38);
  t.assertion = 'hold';
  t.result = { verdict: 'PASS', passed: true, issues: [] };
  const qualified = qualifyEvidence(t);
  assert.equal(
    qualified.status,
    'fail',
    'Near scope must not erase a qualified early native failure'
  );
  assert(
    qualified.scopeIssues.some((issue) =>
      issue.includes('deliberate user READ')
    )
  );
  const report = coverageFor(t);
  assert.equal(report.scenarios[0].qualifiedStatus, 'fail');
  assert(report.scenarios[0].runs[0].qualificationScopeIssues.length);
  assert.equal(report.fullMatrixVerified, false);
  assert.equal(report.nativePresentation, 'INCOMPLETE');
});
test('target retirement and healthy acquisition gap remain incomplete without invented failure', () => {
  const t = fixture();
  unbindTarget(t, 10);
  t.nativeRecording.frames.splice(20, 7);
  t.nativeRecording.frames.forEach((f, i) => {
    f.sequence = i;
    f.geometry.requestId = `${t.nativeRecording.recordingId}:${i}`;
  });
  const result = assess(t);
  assert.equal(result.verdict, 'INCOMPLETE');
  assert.equal(result.anchorContinuity?.verdict, 'INCOMPLETE');
  assert(!result.issues.some((i) => i.kind === 'failure'));
});
test('public reader retains18pt native anchor failure across target and sampled incompleteness', () => {
  for (const position of ['history', 'near']) {
    const t = fixture('cache', position);
    unbindTarget(t);
    const row = t.nativeRecording.frames[30].geometry.rows.find((r) =>
      r.id.endsWith('111')
    ).view;
    row.frame.y -= 18;
    row.clipFrame.y -= 18;
    const result = assessPublic(t);
    assert.equal(result.status, 'fail', JSON.stringify(result));
    assert.equal(result.sampledGeometry?.status, 'incomplete');
    assert.equal(result.nativeMutation?.verdict, 'INCOMPLETE');
    assert.equal(result.nativeContinuity?.verdict, 'FAIL');
    assert.equal(result.nativeContinuity.metrics.maxAnchorDriftPt, 18);
    assert(result.issues.includes('buffered:native-anchor-drift:30'));
    t.assertion = 'hold';
    t.result = {
      verdict: 'INCOMPLETE',
      passed: false,
      issues: [{ kind: 'incomplete', code: 'baseline-measurement-invalid' }],
    };
    assert.equal(
      classifyEvidence(t),
      'fail',
      `${position}: producer INCOMPLETE must retain independent native FAIL`
    );
    const qualified = qualifyEvidence(t);
    assert.equal(qualified.status, 'fail');
    assert.equal(qualified.scopeIssues.length > 0, position === 'near');
    const report = coverageFor(t);
    const run = report.scenarios[0].runs[0];
    assert.equal(run.reportedVerdict, 'INCOMPLETE');
    assert.equal(run.status, 'fail');
    assert.equal(run.qualifiedStatus, 'fail');
    assert(run.evidenceIssues.includes('baseline-measurement-invalid'));
    assert(run.evidenceIssues.includes('buffered:native-anchor-drift:30'));
    assert(run.qualificationIssues.includes('buffered:native-anchor-drift:30'));
    assert.equal(run.qualificationScopeIssues.length > 0, position === 'near');
    assert.equal(report.counts.qualifiedFailingSlices, 1);
    assert.equal(report.counts.qualifiedRecordedSampledPasses, 0);
  }
});
test('public reader cannot grant PASS from healthy anchor with unavailable mutation semantics', () => {
  for (const position of ['history', 'near']) {
    const t = fixture('cache', position);
    unbindTarget(t);
    const result = assessPublic(t);
    assert.equal(result.status, 'incomplete', JSON.stringify(result));
    assert.equal(result.sampledGeometry?.status, 'incomplete');
    assert.equal(result.nativeMutation?.verdict, 'INCOMPLETE');
    assert.equal(result.nativeContinuity?.verdict, 'PASS');
    t.assertion = 'hold';
    t.result = { verdict: 'INCOMPLETE', passed: false, issues: [] };
    assert.equal(classifyEvidence(t), 'incomplete');
    assert.equal(qualifyEvidence(t).status, 'incomplete');
    if (position === 'near') assert(qualifyEvidence(t).scopeIssues.length);
    // A moved unidentified anchor is not a qualified failure.
    moveAnchor(t);
    t.nativeRecording.frames[30].geometry.nativeReading.rowBindings.rows.find(
      (b) => b.key.endsWith('111')
    ).status = 'unavailable';
    assert.equal(assessPublic(t).status, 'incomplete');
    assert.equal(classifyEvidence(t), 'incomplete');
    assert.equal(qualifyEvidence(t).status, 'incomplete');
    // Missing raw and unsupported fixture identity cannot force geometry FAIL.
    delete t.nativeRecording;
    assert.equal(classifyEvidence(t), 'incomplete');
    assert.equal(qualifyEvidence(t).status, 'incomplete');
    t.fixtureVersion = 1;
    assert.equal(classifyEvidence(t), 'incomplete');
    assert.equal(qualifyEvidence(t).status, 'incomplete');
    // The historical producer failure remains retained, never upgraded.
    t.result.verdict = 'FAIL';
    assert.equal(classifyEvidence(t), 'fail');
    assert.equal(qualifyEvidence(t).status, 'incomplete');
  }
});
// Reuse the same native authority fixture for ordinary, nonmutation HOLD.
const holdScenarios = [
  'append-history',
  'burst-history',
  'prepend-history',
  'stateful-image-load-history',
  'thinking-show-hide-history',
  'thinking-label-history',
  'thinking-handoff-message-first-history',
  'thinking-handoff-same-frame-history',
  'thinking-handoff-hide-first-history',
];
function holdFixture(scenario = 'thinking-show-hide-history') {
  const t = fixture();
  const duration = /^(thinking-|stateful-image)/.test(scenario) ? 2400 : 1800;
  delete t.nativeMutationContract;
  delete t.nativeMutationMarkerTransfer;
  delete t.mutationEvidence;
  delete t.mutationScope;
  t.scenario = scenario;
  t.assertion = 'hold';
  t.originalDataKeys = [...keys];
  t.nativeGeometrySchemaVersion = 1;
  t.nativeSampledRulerContract = {
    version: 'indexed-cell-and-surfaces-v2',
    scope,
    rootId: request.rootId,
    scrollViewId: request.scrollViewId,
    composerId: request.composerId,
  };
  const rid = `${t.runId}:${scenario}:1`;
  t.nativeRecordingContract.recordingId = rid;
  t.nativeRecordingContract.request.durationMs = duration + 1500;
  t.nativeRecordingContract.minimumDurationMs = duration - 125;
  t.nativeRecording.recordingId = rid;
  t.nativeRecording.request = clone(t.nativeRecordingContract.request);
  t.nativeRecording.markers = [t.nativeRecording.markers[0]];
  const spacing = duration / 100;
  t.nativeRecording.frames.forEach((f, i) => {
    const time = 10000 + i * spacing;
    f.geometry.requestId = `${rid}:${i}`;
    f.geometry.startedAt = time;
    f.geometry.finishedAt = time + 1;
    if (i) {
      f.displayLinkTimestamp = time - 1;
      f.displayLinkTargetTimestamp = time + 15;
    }
  });
  t.nativeRecording.stoppedAt = 10001 + duration;
  t.nativeRecordingTransfer = {
    startAcknowledgedAt: 110,
    earliestStopAt: 110 + duration,
    requestedAt: 111 + duration,
    receivedAt: 112 + duration,
    clock: 'performance.now milliseconds',
  };
  t.events = [
    {
      time: 111,
      name: 'scenario-start',
      values: { scenario, assertion: 'hold' },
    },
  ];
  t.result = { verdict: 'INCOMPLETE', passed: false, issues: [] };
  return t;
}
const holdResult = (t) => assessPublic(t).nativeContinuity;
for (const scenario of holdScenarios)
  test(`buffered HOLD ${scenario} reuses bound anchor`, () => {
    const r = holdResult(holdFixture(scenario));
    assert.equal(r.verdict, 'PASS', JSON.stringify(r));
    assert.equal(r.evidenceLevel, 'native-bound-anchor-continuity-v1');
    assert.equal(r.nativePresentation, 'INCOMPLETE');
    assert.equal(r.productActions, 'UNASSESSED');
    assert.equal(r.metrics.qualifiedFrames, 101);
  });
test('HOLD transient native jump survives perfect recovery and missing bridged proof', () => {
  const t = holdFixture();
  moveAnchor(t);
  const r = assessPublic(t);
  assert.equal(r.nativeContinuity.verdict, 'FAIL', JSON.stringify(r));
  assert.equal(r.nativeContinuity.metrics.maxAnchorDriftPt, 38);
  assert.equal(r.sampledGeometry.status, 'incomplete');
  assert.equal(r.status, 'fail');
  assert.equal(classifyEvidence(t), 'fail');
  assert.equal(qualifyEvidence(t).status, 'fail');
});
test('HOLD legal-range clamp does not excuse a transient anchor jump', () => {
  const t = holdFixture();
  const g = t.nativeRecording.frames[30].geometry;
  g.scroll.contentSize.height = 1482;
  g.scroll.offset.y = g.scroll.bounds.y = 882;
  const row = g.rows.find((r) => r.id.endsWith('111')).view;
  row.frame.y += 18;
  row.clipFrame.y += 18;
  const r = holdResult(t);
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.metrics.maxAnchorDriftPt, 18);
});
function invalidHold(name, change) {
  test(`HOLD rejects ${name} before reading unidentified geometry`, () => {
    const t = holdFixture();
    change(t);
    moveAnchor(t);
    const r = holdResult(t);
    assert.equal(r.verdict, 'INCOMPLETE', JSON.stringify(r));
    assert(!r.issues.some((i) => i.kind === 'failure'), JSON.stringify(r));
    assert.equal(r.metrics?.maxAnchorDriftPt ?? 0, 0);
  });
}
invalidHold('same-frame unbound anchor', (t) => {
  t.nativeRecording.frames[30].geometry.nativeReading.rowBindings.rows[2].status =
    'unavailable';
});
invalidHold('same-frame recycled cell', (t) => {
  t.nativeRecording.frames[30].geometry.ruler.cells[2].view.lifetimeIdentity =
    'new-cell-lifetime';
});
invalidHold('scope change', (t) => {
  t.nativeRecording.frames[30].geometry.nativeReading.committedMembership.visit =
    'new-visit';
});
invalidHold('native registration alias', (t) => {
  const b =
    t.nativeRecording.frames[30].geometry.nativeReading.rowBindings.rows;
  b[2].registrationIdentity = b[1].registrationIdentity;
});
invalidHold('anchor incarnation change', (t) => {
  const g = t.nativeRecording.frames[30].geometry;
  g.nativeReading.committedMembership.rows[2].revision = 'new-incarnation';
  g.nativeReading.committedMembership.dataRevision =
    g.nativeReading.rowBindings.dataRevision = 'new-data';
  g.nativeReading.rowBindings.rows[2].revision = 'new-incarnation';
});
invalidHold('same-height signature change', (t) => {
  const g = t.nativeRecording.frames[30].geometry;
  for (const r of [g.rows[2], g.ruler.cells[2]]) {
    const meta = JSON.parse(r.view.semanticValue);
    meta.signature.content = 'changed anchor';
    r.view.semanticValue = JSON.stringify(meta);
  }
});
invalidHold('anchor dimensions change', (t) => {
  t.nativeRecording.frames[30].geometry.rows[2].view.frame.height += 2;
});
invalidHold('native drag', (t) => {
  t.nativeRecording.frames[30].geometry.scroll.dragging = true;
});
invalidHold('native deceleration', (t) => {
  t.nativeRecording.frames[30].geometry.scroll.decelerating = true;
});
invalidHold('changed stationary viewport', (t) => {
  t.nativeRecording.frames[30].geometry.scroll.bounds.height -= 1;
});
invalidHold('changed composer', (t) => {
  t.nativeRecording.frames[30].geometry.composer.frame.y -= 1;
});
invalidHold('missing native action marker', (t) => {
  t.nativeRecording.markers = [];
});
invalidHold('baseline only after action', (t) => {
  t.nativeRecording.markers[0].time = 10000;
});
invalidHold('action marker inside native operation', (t) => {
  t.nativeRecording.markers[0].time =
    t.nativeRecording.frames[10].geometry.startedAt + 0.5;
});
invalidHold('overlong native operation', (t) => {
  t.nativeRecording.frames[30].geometry.finishedAt += 32;
});
invalidHold('unavailable native membership', (t) => {
  t.nativeRecording.frames[30].geometry.nativeReading.committedMembership.status =
    'unavailable';
});
invalidHold('wrong required anchor key', (t) => {
  t.nativeRecordingContract.requiredKeys = [keys[1]];
});
invalidHold('non-window reference', (t) => {
  t.expectations.anchor.reference = 'viewport-bottom';
});
invalidHold('relaxed tolerance', (t) => {
  t.expectations.anchor.tolerancePt = 2;
});
invalidHold('scope ruler mismatch', (t) => {
  t.nativeSampledRulerContract.scope = 'wrong::1';
});
invalidHold('out-of-order transfer', (t) => {
  t.nativeRecordingTransfer.receivedAt = 1;
});
invalidHold('recording duration change', (t) => {
  t.nativeRecordingContract.request.durationMs = 5000;
});
test('HOLD unrelated row resize and loaded membership change retain healthy anchor', () => {
  const t = holdFixture('prepend-history');
  for (const f of t.nativeRecording.frames.slice(20)) {
    const g = f.geometry;
    // The base row/cell share a frame object. Replace each measured frame once.
    for (const v of [g.rows[0].view, g.ruler.cells[0].view]) {
      v.frame = { ...v.frame, height: v.frame.height + 20 };
      v.clipFrame = { ...v.clipFrame, height: v.clipFrame.height + 20 };
    }
    g.nativeReading.committedMembership.rows.unshift({
      key: 'new-unmounted-key',
      revision: 'new-incarnation',
    });
    g.nativeReading.committedMembership.dataRevision =
      g.nativeReading.rowBindings.dataRevision = 'new-data';
  }
  const result = holdResult(t);
  assert.equal(result.verdict, 'PASS', JSON.stringify(result));
});
test('HOLD qualified early failure survives a later coverage gap', () => {
  const t = holdFixture();
  moveAnchor(t, 20);
  t.nativeRecording.frames.splice(60, 7);
  t.nativeRecording.frames.forEach((f, i) => {
    f.sequence = i;
    f.geometry.requestId = `${t.nativeRecording.recordingId}:${i}`;
  });
  const r = holdResult(t);
  assert.equal(r.verdict, 'FAIL');
  assert(r.issues.some((i) => i.code.includes('coverage-gap')));
});
test('HOLD healthy gap does not fabricate a late geometry failure', () => {
  const t = holdFixture();
  moveAnchor(t, 80);
  t.nativeRecording.frames.splice(60, 7);
  t.nativeRecording.frames.forEach((f, i) => {
    f.sequence = i;
    f.geometry.requestId = `${t.nativeRecording.recordingId}:${i}`;
  });
  const r = holdResult(t);
  assert.equal(r.verdict, 'INCOMPLETE');
  assert.equal(r.metrics.maxAnchorDriftPt, 0);
});
test('healthy HOLD continuity cannot qualify missing action or bridged acquisition', () => {
  const t = holdFixture();
  const r = assessPublic(t);
  assert.equal(r.nativeContinuity.verdict, 'PASS');
  assert.equal(r.status, 'incomplete');
  assert.equal(classifyEvidence(t), 'incomplete');
  assert.equal(qualifyEvidence(t).status, 'incomplete');
  assert.equal(coverageFor(t).fullMatrixVerified, false);
});

test('actual direct Node CLI positive', () => {
  const path = `${out}/synthetic-native-positive.json`;
  writeFileSync(path, JSON.stringify(fixture()));
  const r = spawnSync(
    process.execPath,
    [`${proposal}/scripts/scroll-stability-native-mutation-evidence.mjs`, path],
    { encoding: 'utf8' }
  );
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(JSON.parse(r.stdout)[0].verdict, 'PASS');
});
test('legacy undeclared native capture remains incomplete', () =>
  assert.equal(assess(original).verdict, 'INCOMPLETE'));
const report = {
  scope:
    'actual independent importer with synthetic raw native frames; no UIKit or capture qualification',
  results: cases,
  passed: cases.filter((x) => x.status === 'PASS').length,
  failed: cases.filter((x) => x.status === 'FAIL').length,
};
if (process.env.NATIVE_MUTATION_REPORT)
  writeFileSync(
    process.env.NATIVE_MUTATION_REPORT,
    JSON.stringify(report, null, 2)
  );
rmSync(out, { recursive: true, force: true });
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
