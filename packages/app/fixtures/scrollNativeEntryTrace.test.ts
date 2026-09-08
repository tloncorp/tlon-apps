import { describe, expect, it } from 'vitest';
import { replayNativeEntry } from '../../../scripts/scroll-stability-native-entry-evidence.mjs';
import {
  adaptBufferedNativeScrollGeometry,
  adaptNativeEntryRuler,
  type NativeGeometryView,
} from './scrollNativeGeometry';
import {
  assessNativeRecording,
  type NativeRecording,
  type NativeRecordingContract,
} from './scrollNativeRecording';
import { assessClampedScrollLanding } from './scrollStabilityTrace';
import {
  assessNativeEntryTrace,
  expectedNativeEntryPosts,
  type NativeEntryContract,
} from './scrollNativeEntryTrace';

function evidence(mode: NativeEntryContract['mode'] = 'latest') {
  const id = `run:entry-${mode}:1`;
  const oldTag = 'tlon-conversation-scroll-edge-content-old';
  const newTag = 'tlon-conversation-scroll-edge-content-new';
  const recordingContract: NativeRecordingContract = {
    recordingId: id,
    scope: 'channel::7',
    requiredKeys: [],
    populated: true,
    visibility: 'observe-entry-concealment',
    minimumDurationMs: 2675,
    request: {
      rootId: 'scroll-stability-native-root',
      scrollViewId: oldTag,
      composerId: 'scroll-stability-composer',
      rowPrefix: 'scroll-row-',
      durationMs: 4300,
      maximumFrames: 900,
    },
    itinerary: {
      version: 1,
      owners: [
        {
          rootId: 'scroll-stability-native-root',
          scope: 'channel::7',
          scrollViewId: oldTag,
        },
        {
          rootId: 'scroll-stability-native-root',
          scope: 'channel::8',
          scrollViewPrefix: 'tlon-conversation-scroll-edge-content-',
        },
      ],
    },
  };
  const contract: NativeEntryContract = {
    version: 1,
    recordingId: id,
    requestId: `${id}:entry`,
    mode,
    destinationScope: 'channel::8',
    expectedPosts: expectedNativeEntryPosts(),
    resetMarker: `${id}:entry:reset`,
    dataMarker: `${id}:entry:data`,
    readyDeadlineMs: 2800,
    quietTailMs: 1000,
  };
  const view = (
    identity: string,
    y: number,
    height: number,
    descendantOfScroll = false
  ): NativeGeometryView => ({
    identity,
    windowIdentity: 'window',
    frame: { x: 0, y, width: 400, height },
    clipFrame: { x: 0, y, width: 400, height },
    attached: true,
    hidden: false,
    effectiveAlpha: 1,
    translationOnly: true,
    descendantOfScroll,
  });
  const firstContent = mode === 'delayed' ? 75 : 15;
  const targetKey =
    mode === 'selected' ? 'scroll-fixture-65' : 'scroll-fixture-119';
  const raw: NativeRecording = {
    version: 1,
    recordingId: id,
    request: structuredClone(recordingContract.request),
    itinerary: structuredClone(recordingContract.itinerary),
    clock: 'CACurrentMediaTime milliseconds',
    coordinateSpace: 'window-model-points',
    nativePresentation: 'INCOMPLETE',
    startedAt: 10000,
    stoppedAt: 13995,
    stopReason: 'requested',
    markers: [
      { sequence: 0, name: 'action-start', time: 10090 },
      { sequence: 1, name: contract.resetMarker, time: 10110 },
      {
        sequence: 2,
        name: contract.dataMarker,
        time: mode === 'delayed' ? 11010 : 10120,
      },
    ],
    frames: Array.from({ length: 250 }, (_, sequence) => {
      const owner = sequence < 10 ? 0 : 1;
      const scope = owner === 0 ? 'channel::7' : 'channel::8';
      const tag = owner === 0 ? oldTag : newTag;
      const pending = mode === 'delayed' && sequence >= 10 && sequence < 70;
      const row = view(
        `row-${owner}`,
        mode === 'selected' ? 300 : 500,
        100,
        true
      );
      row.semanticValue = JSON.stringify({
        version: 1,
        scope,
        key: targetKey,
        signature: contract.expectedPosts.find(
          (post) => post.key === targetKey
        )!.signature,
      });
      const scroll = view(`scroll-${owner}`, 100, 600, true);
      if (owner === 1 && sequence < firstContent)
        row.effectiveAlpha = scroll.effectiveAlpha = 0;
      const root = view('root', 0, 800);
      root.semanticValue = JSON.stringify({
        version: 1,
        scope,
        requestedKeys: pending
          ? []
          : contract.expectedPosts.map((post) => post.key),
      });
      return {
        sequence,
        trigger: sequence ? 'display-link' : 'start',
        ...(sequence
          ? {
              displayLinkTimestamp: 10000 + sequence * 16 - 1,
              displayLinkTargetTimestamp: 10000 + sequence * 16 + 15,
            }
          : {}),
        owner: {
          index: owner,
          scope,
          rootId: recordingContract.request.rootId,
          scrollViewId: tag,
        },
        geometry: {
          version: 1,
          requestId: `${id}:${sequence}`,
          rootId: recordingContract.request.rootId,
          scrollViewId: tag,
          composerId: recordingContract.request.composerId,
          rowIds: pending ? [] : [`scroll-row-${targetKey}`],
          ownerHosts: [{ id: tag, identity: `host-${owner}` }],
          clock: 'CACurrentMediaTime milliseconds',
          coordinateSpace: 'window-model-points',
          startedAt: 10000 + sequence * 16,
          finishedAt: 10001 + sequence * 16,
          status: 'ok',
          issues: [],
          visitedViews: 100,
          root,
          composer: view('composer', 600, 80),
          rows: pending
            ? []
            : [{ id: `scroll-row-${targetKey}`, matches: 1, view: row }],
          scroll: {
            view: scroll,
            hostIdentity: `host-${owner}`,
            offset: { x: 0, y: mode === 'selected' ? 900 : 1500 },
            contentSize: { width: 400, height: 2000 },
            bounds: {
              x: 0,
              y: mode === 'selected' ? 900 : 1500,
              width: 400,
              height: 600,
            },
            contentInset: { top: 0, right: 0, bottom: 100, left: 0 },
            adjustedContentInset: { top: 0, right: 0, bottom: 100, left: 0 },
            zoomScale: 1,
            tracking: false,
            dragging: false,
            decelerating: false,
          },
        },
      };
    }),
  };
  const trace = {
    fixtureVersion: 2,
    platform: 'ios',
    productCoverage: 'local-component-fixture',
    runId: 'run',
    scenario: `entry-${mode}`,
    originalDataKeys: contract.expectedPosts.map((post) => post.key),
    nativeRecordingContract: recordingContract,
    nativeEntryContract: contract,
    nativeRecording: raw,
    nativeEntryMarkerTransfers: [
      {
        name: contract.resetMarker,
        requestedAt: 1100,
        receivedAt: 1110,
        clock: 'performance.now milliseconds',
      },
      {
        name: contract.dataMarker,
        requestedAt: mode === 'delayed' ? 2010 : 1120,
        receivedAt: mode === 'delayed' ? 2020 : 1130,
        clock: 'performance.now milliseconds',
      },
    ],
    nativeRecordingTransfer: {
      startAcknowledgedAt: 1000,
      earliestStopAt: 4910,
      requestedAt: 4930,
      receivedAt: 4960,
      clock: 'performance.now milliseconds',
    },
    events: [
      { name: 'reset', time: 1140, values: { mode } },
      { name: 'list-attached', time: 1150, values: { channelId: 'channel' } },
    ],
  };
  return { raw, contract, recordingContract, trace, firstContent };
}
const assess = (d: ReturnType<typeof evidence>) =>
  assessNativeEntryTrace(
    d.raw,
    d.recordingContract,
    d.contract,
    (raw, contract) =>
      assessNativeRecording(raw, contract, adaptBufferedNativeScrollGeometry),
    assessClampedScrollLanding,
    adaptNativeEntryRuler
  );
const changeY = (
  d: ReturnType<typeof evidence>,
  frame: number,
  delta: number
) => {
  const row = d.raw.frames[frame].geometry.rows![0].view!;
  row.frame.y += delta;
  row.clipFrame.y += delta;
};
const stale = (d: ReturnType<typeof evidence>, frame: number) => {
  const row = d.raw.frames[frame].geometry.rows![0].view!;
  const metadata = JSON.parse(row.semanticValue!);
  metadata.signature.content = 'old content';
  row.semanticValue = JSON.stringify(metadata);
};
const gap = (d: ReturnType<typeof evidence>, from: number) => {
  for (const frame of d.raw.frames.slice(from)) {
    frame.geometry.startedAt += 140;
    frame.geometry.finishedAt += 140;
    frame.displayLinkTimestamp! += 140;
    frame.displayLinkTargetTimestamp! += 140;
  }
  d.raw.stoppedAt += 140;
};

describe('native entry row-model product evidence', () => {
  it.each(['transfer', 'event-timeline', 'actual-reset'] as const)(
    'preserves incomplete acquisition when %s evidence also fails',
    (kind) => {
      const d = evidence();
      gap(d, 190);
      if (kind === 'transfer')
        d.trace.nativeEntryMarkerTransfers[1].name = 'wrong-marker';
      if (kind === 'event-timeline')
        d.trace.events[1].time = d.trace.events[0].time - 1;
      if (kind === 'actual-reset') d.trace.events[0].values.mode = 'selected';
      expect(replayNativeEntry(d.trace)).toMatchObject({
        verdict: 'INCOMPLETE',
        acquisition: 'INCOMPLETE',
      });
    }
  );
  it.each(['latest', 'selected', 'delayed'] as const)(
    'qualifies %s without claiming native presentation or usable-layout latency',
    (mode) => {
      const d = evidence(mode);
      const result = assess(d);
      expect(result.issues).toEqual([]);
      expect(result).toMatchObject({
        verdict: 'PASS',
        acquisition: 'COMPLETE',
        nativePresentation: 'INCOMPLETE',
        inputToUsableLandingLatency: 'INCOMPLETE',
        metrics: {
          firstContentFrame: d.firstContent,
          maxLandingErrorPt: 0,
          deadline: 12910,
          tailEnd: 13910,
        },
      });
      expect(result.metrics.checkedTailFrames).toBeGreaterThan(50);
      expect(replayNativeEntry(d.trace).verdict).toBe('PASS');
    }
  );
  it('applies the accepted selected-target legal clamp', () => {
    const d = evidence('selected');
    for (const frame of d.raw.frames.slice(10)) {
      frame.geometry.scroll!.offset.y = frame.geometry.scroll!.bounds.y = 0;
      frame.geometry.rows![0].view!.frame.y =
        frame.geometry.rows![0].view!.clipFrame.y = 150;
    }
    expect(assess(d).verdict).toBe('PASS');
  });
  it.each(['latest', 'selected'] as const)(
    'retains the wrong first %s landing after later correction',
    (mode) => {
      const d = evidence(mode);
      changeY(d, d.firstContent, -20);
      expect(assess(d)).toMatchObject({
        verdict: 'FAIL',
        metrics: { maxLandingErrorPt: 20 },
      });
      expect(assess(d).issues).toContainEqual({
        code: 'native-entry-wrong-landing',
        kind: 'failure',
        frame: d.firstContent,
      });
    }
  );
  it.each([
    'content',
    'scope',
    'target',
    'concealment',
    'input-revert',
  ] as const)('does not accept terminal %s reversion', (fault) => {
    const d = evidence();
    const frame = d.raw.frames[220];
    if (fault === 'content') stale(d, 220);
    if (fault === 'scope') frame.owner!.scope = 'other::8';
    if (fault === 'target') {
      frame.geometry.rowIds = [];
      frame.geometry.rows = [];
    }
    if (fault === 'concealment')
      frame.geometry.scroll!.view.effectiveAlpha =
        frame.geometry.rows![0].view!.effectiveAlpha = 0;
    if (fault === 'input-revert') {
      const root = JSON.parse(frame.geometry.root!.semanticValue!);
      root.requestedKeys = [];
      frame.geometry.root!.semanticValue = JSON.stringify(root);
    }
    expect(assess(d).verdict).toBe(fault === 'scope' ? 'INCOMPLETE' : 'FAIL');
  });
  it('does not label an unfinished hidden entry a missed deadline', () => {
    const d = evidence();
    d.raw.frames = d.raw.frames.slice(0, 167);
    d.raw.stoppedAt = 12675;
    for (const frame of d.raw.frames.slice(10))
      frame.geometry.scroll!.view.effectiveAlpha =
        frame.geometry.rows![0].view!.effectiveAlpha = 0;
    const result = assess(d);
    expect(result.verdict).toBe('INCOMPLETE');
    expect(result.issues.every((issue) => issue.kind === 'incomplete')).toBe(
      true
    );
  });
  it('fails a continuously measured entry that stays hidden through its deadline', () => {
    const d = evidence();
    for (const frame of d.raw.frames.slice(10))
      frame.geometry.scroll!.view.effectiveAlpha =
        frame.geometry.rows![0].view!.effectiveAlpha = 0;
    expect(
      assess(d).issues.some(
        (issue) =>
          issue.code === 'native-entry-missed-reveal-deadline' &&
          issue.kind === 'failure'
      )
    ).toBe(true);
  });
  it('preserves a valid first wrong landing across a later acquisition gap', () => {
    const d = evidence('selected');
    changeY(d, d.firstContent, -20);
    gap(d, 190);
    expect(assess(d)).toMatchObject({
      verdict: 'FAIL',
      acquisition: 'INCOMPLETE',
      metrics: { maxLandingErrorPt: 20 },
    });
    expect(replayNativeEntry(d.trace).verdict).toBe('FAIL');
  });
  it('cannot certify a healthy prefix or a first landing only observed after a gap', () => {
    const healthy = evidence();
    gap(healthy, 190);
    expect(assess(healthy).verdict).toBe('INCOMPLETE');
    const late = evidence('selected');
    gap(late, 12);
    changeY(late, late.firstContent, -20);
    expect(assess(late).verdict).toBe('INCOMPLETE');
  });
  it('keeps wrong-scope and invalid-clock geometry diagnostic', () => {
    const d = evidence('selected');
    changeY(d, d.firstContent, -20);
    d.raw.frames[220].owner!.scope = 'third::9';
    expect(assess(d).verdict).toBe('INCOMPLETE');
    const time = evidence('selected');
    changeY(time, time.firstContent, -20);
    time.raw.frames[220].geometry.finishedAt = -1;
    expect(assess(time).verdict).toBe('INCOMPLETE');
  });
  it('requires the independently fixed tail rather than last observed success', () => {
    const d = evidence();
    d.raw.frames = d.raw.frames.slice(0, 200);
    d.raw.stoppedAt = 13200;
    expect(
      assess(d).issues.some(
        (issue) => issue.code === 'native-entry-terminal-tail-missing'
      )
    ).toBe(true);
    expect(assess(d).verdict).toBe('INCOMPLETE');
  });
  it('rejects missing, reordered, duplicate, or in-operation action markers', () => {
    for (const kind of [
      'missing',
      'reordered',
      'duplicate',
      'overlap',
    ] as const) {
      const d = evidence();
      if (kind === 'missing') d.raw.markers.pop();
      if (kind === 'reordered') d.raw.markers[2].time = 10100;
      if (kind === 'duplicate')
        d.raw.markers.push({ ...d.raw.markers[2], sequence: 3 });
      if (kind === 'overlap') d.raw.markers[2].time = 10128.5;
      expect(assess(d).verdict).toBe('INCOMPLETE');
    }
  });
  it('rejects a skipped delayed-data stage', () => {
    const d = evidence('delayed');
    for (const frame of d.raw.frames.slice(10, 70)) {
      const root = JSON.parse(frame.geometry.root!.semanticValue!);
      root.requestedKeys = d.contract.expectedPosts.map((post) => post.key);
      frame.geometry.root!.semanticValue = JSON.stringify(root);
    }
    expect(
      assess(d).issues.some(
        (issue) => issue.code === 'native-entry-pending-phase-unwitnessed'
      )
    ).toBe(true);
  });
  it('rejects weakened timing and jointly forged expected/raw content', () => {
    const weakened = evidence();
    (weakened.contract as { quietTailMs: number }).quietTailMs = 100;
    expect(assess(weakened).verdict).toBe('INCOMPLETE');
    const changed = evidence();
    changed.contract.expectedPosts[89].signature.content = 'old content';
    for (let index = 10; index < changed.raw.frames.length; index++)
      stale(changed, index);
    expect(assess(changed).issues[0].code).toBe(
      'invalid-native-entry-contract'
    );
  });
  it('ignores a declared producer PASS and binds JS marker receipts without mixing clock domains', () => {
    const d = evidence();
    stale(d, 220);
    expect(
      replayNativeEntry({
        ...d.trace,
        nativeEntryAssessment: { verdict: 'PASS' },
      }).verdict
    ).toBe('FAIL');
    const changed = evidence();
    changed.trace.nativeEntryMarkerTransfers[1].name = 'unrelated';
    expect(replayNativeEntry(changed.trace).verdict).toBe('INCOMPLETE');
    const source = evidence();
    source.trace.runId = 'reused-run';
    expect(replayNativeEntry(source.trace).verdict).toBe('INCOMPLETE');
    expect(
      replayNativeEntry({ ...evidence().trace, nativeEntryContract: undefined })
        .verdict
    ).toBe('INCOMPLETE');
    expect(
      replayNativeEntry({ ...evidence().trace, scenario: 'append-end' }).verdict
    ).toBe('INCOMPLETE');
  });
});

function rulerEvidence() {
  const d = evidence('selected');
  d.contract.ruler = 'indexed-cell-and-surfaces-v1';
  for (const f of d.raw.frames) {
    const g = f.geometry;
    const inner = g.rows![0].view!;
    // Real indexed cell is100pt; independently measured message is92pt.
    const cell = structuredClone(inner);
    cell.identity = `cell-${f.owner!.index}`;
    cell.containingCellIdentity = inner.containingCellIdentity = cell.identity;
    inner.frame.height = inner.clipFrame.height = 92;
    const surface = structuredClone(g.composer!);
    surface.frame.y = surface.clipFrame.y = 608;
    surface.frame.height = surface.clipFrame.height = 48;
    surface.identity = 'body';
    const manifest = structuredClone(g.composer!);
    manifest.identity = 'manifest';
    manifest.semanticValue = JSON.stringify({
      version: 1,
      scope: f.owner!.scope,
      surfaceIds: ['scroll-surface-body'],
    });
    g.ruler = {
      version: 1,
      cells: [{ id: 'scroll-cell-scroll-fixture-65', matches: 1, view: cell }],
      manifest: { id: 'scroll-surface-manifest', matches: 1, view: manifest },
      surfaces: [{ id: 'scroll-surface-body', matches: 1, view: surface }],
    };
    // Transparent wrapper includes a56pt floating-control reservation.
    g.composer!.frame.y = g.composer!.clipFrame.y = 544;
    g.composer!.frame.height = g.composer!.clipFrame.height = 136;
  }
  return d;
}

describe('native selected entry measured cell and surface ruler', () => {
  it('centers the actual cell, retains the independent inner message, and ignores transparent reservation', () => {
    const d = rulerEvidence();
    const result = assess(d);
    expect(result.verdict).toBe('PASS');
    expect(result.metrics.maxLandingErrorPt).toBe(0);
  });
  it.each([0.99, 1.01])(
    'keeps the declared1pt boundary at a measured cell shift of%s',
    (shift) => {
      const d = rulerEvidence();
      for (const f of d.raw.frames) {
        for (const v of [
          f.geometry.ruler!.cells[0].view!,
          f.geometry.rows![0].view!,
        ]) {
          v.frame.y += shift;
          v.clipFrame.y += shift;
        }
      }
      expect(assess(d).verdict).toBe(shift <= 1 ? 'PASS' : 'FAIL');
    }
  );
  it('requires the new ruler instead of inferring cell bounds from the inner message', () => {
    const d = rulerEvidence();
    for (const f of d.raw.frames) delete f.geometry.ruler;
    expect(assess(d).verdict).toBe('INCOMPLETE');
  });
  it('rejects actually covered message despite a correct cell center', () => {
    const d = rulerEvidence();
    const f = d.raw.frames[40];
    f.geometry.ruler!.surfaces[0].view!.frame.y = 340;
    f.geometry.ruler!.surfaces[0].view!.clipFrame.y = 340;
    expect(
      assess(d).issues.some((i) => i.code === 'native-entry-message-obscured')
    ).toBe(true);
    expect(assess(d).verdict).toBe('FAIL');
  });
  it.each(['missing', 'duplicate', 'unlisted', 'wrong-scope'])(
    'rejects %s surface inventory',
    (fault) => {
      const d = rulerEvidence();
      const r = d.raw.frames[40].geometry.ruler!;
      if (fault === 'missing') r.surfaces = [];
      if (fault === 'duplicate') r.surfaces[0].matches = 2;
      if (fault === 'unlisted')
        r.surfaces.push({ ...r.surfaces[0], id: 'scroll-surface-foreign' });
      if (fault === 'wrong-scope')
        r.manifest.view!.semanticValue = JSON.stringify({
          version: 1,
          scope: 'channel::7',
          surfaceIds: ['scroll-surface-body'],
        });
      expect(assess(d).verdict).toBe('INCOMPLETE');
    }
  );
  it('rejects a cell with a different semantic revision or an inner message outside its cell', () => {
    const d = rulerEvidence();
    const cell = d.raw.frames[40].geometry.ruler!.cells[0].view!;
    const metadata = JSON.parse(cell.semanticValue!);
    metadata.signature.content = 'different';
    cell.semanticValue = JSON.stringify(metadata);
    expect(assess(d).verdict).toBe('INCOMPLETE');
    const outside = rulerEvidence();
    outside.raw.frames[40].geometry.ruler!.cells[0].view!.frame.height = 50;
    outside.raw.frames[40].geometry.ruler!.cells[0].view!.clipFrame.height = 50;
    expect(assess(outside).verdict).toBe('INCOMPLETE');
  });
  it('uses actual increased composer inset exactly once', () => {
    const d = rulerEvidence();
    for (const f of d.raw.frames) {
      f.geometry.scroll!.adjustedContentInset.bottom =
        f.geometry.scroll!.contentInset.bottom = 140;
      for (const v of [
        f.geometry.ruler!.cells[0].view!,
        f.geometry.rows![0].view!,
      ]) {
        v.frame.y -= 20;
        v.clipFrame.y -= 20;
      }
    }
    expect(assess(d).verdict).toBe('PASS');
  });
  it('preserves an independently valid cell displacement before later incomplete role evidence', () => {
    const d = rulerEvidence();
    for (const v of [
      d.raw.frames[40].geometry.ruler!.cells[0].view!,
      d.raw.frames[40].geometry.rows![0].view!,
    ]) {
      v.frame.y += 10;
      v.clipFrame.y += 10;
    }
    delete d.raw.frames[80].geometry.ruler;
    expect(assess(d).verdict).toBe('FAIL');
    expect(assess(d).issues.some((i) => i.kind === 'incomplete')).toBe(true);
  });
});

describe('native ruler serialization and association controls', () => {
  it('replays serialized raw through the independent importer', () => {
    const d = rulerEvidence();
    expect(replayNativeEntry(JSON.parse(JSON.stringify(d.trace))).verdict).toBe(
      'PASS'
    );
  });
  it('does not accept undeclared new role evidence as an old-ruler proof', () => {
    const d = rulerEvidence();
    delete d.contract.ruler;
    expect(
      assess(d).issues.some((i) => i.code === 'undeclared-native-entry-ruler')
    ).toBe(true);
    expect(assess(d).verdict).toBe('INCOMPLETE');
  });
  it.each(['cell-parent', 'surface-window', 'cell-duplicate', 'zero-clip'])(
    'rejects corrupted %s evidence after JSON roundtrip',
    (fault) => {
      const d = rulerEvidence();
      const g = d.raw.frames[40].geometry;
      if (fault === 'cell-parent')
        g.rows![0].view!.containingCellIdentity = 'different-cell';
      if (fault === 'surface-window')
        g.ruler!.surfaces[0].view!.windowIdentity = 'foreign-window';
      if (fault === 'cell-duplicate')
        g.ruler!.cells.push(structuredClone(g.ruler!.cells[0]));
      if (fault === 'zero-clip')
        g.ruler!.surfaces[0].view!.clipFrame.height = 0;
      expect(
        replayNativeEntry(JSON.parse(JSON.stringify(d.trace))).verdict
      ).toBe('INCOMPLETE');
    }
  );
  it('counts a partial floating button as its actual rectangle, not the transparent wrapper', () => {
    const d = rulerEvidence();
    for (const f of d.raw.frames) {
      const r = f.geometry.ruler!;
      const button = structuredClone(r.surfaces[0].view!);
      button.identity = 'latest';
      button.frame = { x: 176, y: 548, width: 48, height: 48 };
      button.clipFrame = { ...button.frame };
      r.surfaces.push({
        id: 'scroll-surface-latest',
        matches: 1,
        view: button,
      });
      r.manifest.view!.semanticValue = JSON.stringify({
        version: 1,
        scope: f.owner!.scope,
        surfaceIds: ['scroll-surface-body', 'scroll-surface-latest'],
      });
    }
    expect(assess(d).verdict).toBe('PASS');
    const control = d.raw.frames[40].geometry.ruler!.surfaces[1].view!;
    control.frame.y = control.clipFrame.y = 344;
    expect(
      assess(d).issues.some((i) => i.code === 'native-entry-message-obscured')
    ).toBe(true);
    expect(assess(d).verdict).toBe('FAIL');
  });
});
