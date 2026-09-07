import { describe, expect, it } from 'vitest';
import { replayNativeRecording } from '../../../scripts/scroll-stability-native-recording-evidence.mjs';
import {
  adaptBufferedNativeScrollGeometry,
  type NativeGeometryView,
} from './scrollNativeGeometry';
import {
  assessNativeRecording,
  type NativeRecording,
  type NativeRecordingContract,
} from './scrollNativeRecording';

function evidence() {
  const contract: NativeRecordingContract = {
    recordingId: 'recording-1',
    scope: 'channel::7',
    requiredKeys: ['reading'],
    populated: true,
    visibility: 'require-visible',
    minimumDurationMs: 900,
    request: {
      rootId: 'root-7',
      scrollViewId: 'list',
      composerId: 'composer',
      rowPrefix: 'scroll-row-',
      durationMs: 2000,
      maximumFrames: 900,
    },
  };
  const view = (
    identity: string,
    y: number,
    height: number,
    descendantOfScroll: boolean
  ): NativeGeometryView => ({
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
  const raw: NativeRecording = {
    version: 1,
    recordingId: contract.recordingId,
    request: { ...contract.request },
    clock: 'CACurrentMediaTime milliseconds',
    coordinateSpace: 'window-model-points',
    startedAt: 10_000,
    stoppedAt: 10_970,
    stopReason: 'requested',
    nativePresentation: 'INCOMPLETE',
    markers: [{ sequence: 0, name: 'action-start', time: 10_100 }],
    frames: Array.from({ length: 61 }, (_, sequence) => ({
      sequence,
      trigger: sequence === 0 ? 'start' : 'display-link',
      ...(sequence > 0
        ? {
            displayLinkTimestamp: 10_000 + sequence * 16 - 1,
            displayLinkTargetTimestamp: 10_000 + sequence * 16 + 15,
          }
        : {}),
      geometry: {
        version: 1,
        requestId: `${contract.recordingId}:${sequence}`,
        rootId: contract.request.rootId,
        scrollViewId: 'list',
        composerId: 'composer',
        rowIds: ['scroll-row-reading'],
        clock: 'CACurrentMediaTime milliseconds',
        coordinateSpace: 'window-model-points',
        startedAt: 10_000 + sequence * 16,
        finishedAt: 10_001 + sequence * 16,
        status: 'ok',
        issues: [],
        visitedViews: 250,
        root: {
          ...view('root-view', 0, 800, false),
          semanticValue: JSON.stringify({
            version: 1,
            scope: contract.scope,
            requestedKeys: ['reading', 'newer'],
          }),
        },
        composer: view('composer-view', 600, 80, false),
        scroll: {
          view: view('scroll-view', 100, 600, true),
          hostIdentity: 'host',
          offset: { x: 0, y: 1000 },
          contentSize: { width: 400, height: 2000 },
          bounds: { x: 0, y: 1000, width: 400, height: 600 },
          contentInset: { top: 0, right: 0, bottom: 100, left: 0 },
          adjustedContentInset: { top: 0, right: 0, bottom: 100, left: 0 },
          zoomScale: 1,
          tracking: false,
          dragging: false,
          decelerating: false,
        },
        rows: [
          {
            id: 'scroll-row-reading',
            matches: 1,
            view: {
              ...view('reading-view', 220, 120, true),
              semanticValue: JSON.stringify({
                version: 1,
                scope: contract.scope,
                key: 'reading',
                signature: {
                  content: 'actual post',
                  reactions: '[]',
                  replies: 0,
                },
              }),
            },
          },
        ],
      },
    })),
  };
  return { raw, contract };
}
const assess = ({ raw, contract }: ReturnType<typeof evidence>) =>
  assessNativeRecording(raw, contract, adaptBufferedNativeScrollGeometry);

describe('native buffered acquisition', () => {
  it('independently binds the recording to the declared native scenario and duration', () => {
    const { raw, contract } = evidence();
    const recordingId = 'run:append-history:1';
    raw.recordingId = contract.recordingId = recordingId;
    raw.request.durationMs = contract.request.durationMs = 3300;
    contract.minimumDurationMs = 1675;
    const template = raw.frames[1];
    raw.frames = Array.from({ length: 111 }, (_, sequence) => {
      const frame = structuredClone(template);
      frame.sequence = sequence;
      frame.trigger = sequence === 0 ? 'start' : 'display-link';
      frame.geometry.requestId = `${recordingId}:${sequence}`;
      frame.geometry.startedAt = 10_000 + sequence * 16;
      frame.geometry.finishedAt = frame.geometry.startedAt + 1;
      frame.displayLinkTimestamp = frame.geometry.startedAt - 1;
      frame.displayLinkTargetTimestamp = frame.geometry.startedAt + 15;
      return frame;
    });
    raw.stoppedAt = 11_770;
    const trace = {
      fixtureVersion: 2,
      platform: 'ios',
      productCoverage: 'local-component-fixture',
      runId: 'run',
      scenario: 'append-history',
      originalDataKeys: ['reading', 'newer'],
      nativeRecording: raw,
      nativeRecordingContract: contract,
      nativeRecordingAcquisition: { verdict: 'PASS' },
    };
    expect(replayNativeRecording(trace)).toMatchObject({
      verdict: 'COMPLETE',
      productVerdict: 'UNASSESSED',
    });
    contract.minimumDurationMs = 100;
    expect(replayNativeRecording(trace).issues[0].code).toBe(
      'native-recording-duration-contract-changed'
    );
    contract.minimumDurationMs = 1675;
    trace.runId = 'other-run';
    expect(replayNativeRecording(trace).verdict).toBe('INCOMPLETE');
    trace.runId = 'run';
    raw.frames[20].geometry.finishedAt += 40;
    expect(replayNativeRecording(trace).verdict).toBe('INCOMPLETE');
  });
  it('replays synchronous native samples without inventing a JS bracket or product pass', () => {
    const result = assess(evidence());
    expect(result.verdict).toBe('COMPLETE');
    expect(result.issues).toEqual([]);
    expect(result.samples).toHaveLength(61);
    expect(result.samples[0].time).toBe(10_001);
    expect(result.samples[0].measurement).toEqual({
      valid: true,
      durationMs: 1,
    });
    expect(result.samples[0].acquisition?.nativeGeometry).toMatchObject({
      source: 'ios-buffered-main-thread-model-v1',
      nativePresentation: 'INCOMPLETE',
    });
    expect(result.samples[0].acquisition?.nativeGeometry).not.toHaveProperty(
      'bracket'
    );
    expect(result.semanticSamples[0].rows[0].signature.content).toBe(
      'actual post'
    );
    expect(result.semanticSamples[0].requestedKeys).toEqual([
      'reading',
      'newer',
    ]);
  });
  it('retains actual row movement for a separate position oracle', () => {
    const input = evidence();
    input.raw.frames[20].geometry.rows![0].view!.frame.y += 10;
    input.raw.frames[20].geometry.rows![0].view!.clipFrame.y += 10;
    const result = assess(input);
    expect(result.verdict).toBe('COMPLETE');
    expect(result.samples[20].rows[0].y - result.samples[0].rows[0].y).toBe(10);
  });
  it('records declared entry concealment separately from structural acquisition', () => {
    const input = evidence();
    input.contract.visibility = 'observe-entry-concealment';
    const frame = input.raw.frames[20].geometry;
    frame.scroll!.view.effectiveAlpha = 0;
    frame.rows![0].view!.effectiveAlpha = 0;
    const result = assess(input);
    expect(result.verdict).toBe('COMPLETE');
    expect(result.exposureSamples[20]).toMatchObject({
      viewportVisible: false,
      visibleRequiredKeys: [],
    });
    expect(result.samples[20].rows[0].y).toBe(220);
    input.contract.visibility = 'require-visible';
    expect(assess(input).verdict).toBe('INCOMPLETE');
  });
  it.each<[string, (input: ReturnType<typeof evidence>) => void]>([
    [
      'wrong recording owner',
      ({ raw }) => {
        raw.recordingId = 'old';
      },
    ],
    [
      'wrong native clock',
      ({ raw }) => {
        raw.clock = 'performance.now milliseconds' as never;
      },
    ],
    [
      'wrong request',
      ({ raw }) => {
        raw.request.scrollViewId = 'other';
      },
    ],
    [
      'short lifetime',
      ({ raw }) => {
        raw.stoppedAt = 10_500;
      },
    ],
    [
      'capacity stop',
      ({ raw }) => {
        raw.stopReason = 'capacity';
      },
    ],
    [
      'missing first frame',
      ({ raw }) => {
        raw.frames.shift();
      },
    ],
    [
      'missing tail',
      ({ raw }) => {
        raw.frames.splice(40);
      },
    ],
    [
      'sequence changed',
      ({ raw }) => {
        raw.frames[20].sequence++;
      },
    ],
    [
      'duplicate native time',
      ({ raw }) => {
        raw.frames[20].geometry.startedAt = raw.frames[19].geometry.startedAt;
      },
    ],
    [
      'main-thread gap',
      ({ raw }) => {
        raw.frames[20].geometry.startedAt += 200;
        raw.frames[20].geometry.finishedAt += 200;
      },
    ],
    [
      'slow operation',
      ({ raw }) => {
        raw.frames[20].geometry.finishedAt += 40;
      },
    ],
    [
      'missing display callback',
      ({ raw }) => {
        delete raw.frames[20].displayLinkTimestamp;
      },
    ],
    [
      'invalid display callback',
      ({ raw }) => {
        raw.frames[20].displayLinkTargetTimestamp = 0;
      },
    ],
    [
      'wrong frame request',
      ({ raw }) => {
        raw.frames[20].geometry.requestId = 'other';
      },
    ],
    [
      'hidden reading viewport',
      ({ raw }) => {
        raw.frames[20].geometry.scroll!.view.effectiveAlpha = 0;
      },
    ],
    [
      'missing required row',
      ({ raw }) => {
        raw.frames[20].geometry.rows = [];
        raw.frames[20].geometry.rowIds = [];
      },
    ],
    [
      'duplicate row',
      ({ raw }) => {
        raw.frames[20].geometry.rowIds.push('scroll-row-reading');
      },
    ],
    [
      'wrong row prefix',
      ({ raw }) => {
        raw.frames[20].geometry.rowIds[0] = 'unscoped';
      },
    ],
    [
      'view replacement',
      ({ raw }) => {
        raw.frames[20].geometry.rows![0].view!.identity = 'replacement';
      },
    ],
    [
      'scroll replacement',
      ({ raw }) => {
        raw.frames[20].geometry.scroll!.view.identity = 'replacement';
      },
    ],
    [
      'stale row scope',
      ({ raw }) => {
        const view = raw.frames[20].geometry.rows![0].view!;
        const revision = JSON.parse(view.semanticValue!);
        revision.scope = 'channel::6';
        view.semanticValue = JSON.stringify(revision);
      },
    ],
    [
      'missing row revision',
      ({ raw }) => {
        delete raw.frames[20].geometry.rows![0].view!.semanticValue;
      },
    ],
    [
      'malformed root revision',
      ({ raw }) => {
        raw.frames[20].geometry.root!.semanticValue = '{';
      },
    ],
    [
      'wrong root scope',
      ({ raw }) => {
        raw.frames[20].geometry.root!.semanticValue = JSON.stringify({
          version: 1,
          scope: 'other',
          requestedKeys: ['reading'],
        });
      },
    ],
    [
      'marker before start',
      ({ raw }) => {
        raw.markers[0].time = 100;
      },
    ],
    [
      'marker sequence',
      ({ raw }) => {
        raw.markers[0].sequence = 2;
      },
    ],
  ])('rejects %s', (_name, corrupt) => {
    const input = evidence();
    corrupt(input);
    expect(assess(input).verdict).toBe('INCOMPLETE');
  });
  it('rejects unavailable and malformed raw buffers without claiming a pass', () => {
    const { contract } = evidence();
    for (const raw of [
      null,
      {},
      { status: 'unavailable' },
      { frames: [null] },
    ]) {
      expect(
        assessNativeRecording(raw, contract, adaptBufferedNativeScrollGeometry)
          .verdict
      ).toBe('INCOMPLETE');
    }
  });
});

describe('native operation cadence and usable exposure boundaries', () => {
  it('rejects148ms emitted sample gaps even with124ms idle intervals and24ms scans', () => {
    const d = evidence();
    d.raw.request.durationMs = d.contract.request.durationMs = 10000;
    for (const [index, frame] of d.raw.frames.entries()) {
      frame.geometry.startedAt = 10000 + index * 148;
      frame.geometry.finishedAt = frame.geometry.startedAt + 24;
      if (index) {
        frame.displayLinkTimestamp = frame.geometry.startedAt - 1;
        frame.displayLinkTargetTimestamp = frame.geometry.startedAt + 15;
      }
    }
    d.raw.stoppedAt = d.raw.frames.at(-1)!.geometry.finishedAt + 10;
    const result = assess(d);
    expect(result.verdict).toBe('INCOMPLETE');
    expect(
      result.issues.some((i) => i.code === 'native-recording-coverage-gap')
    ).toBe(true);
    expect(
      result.issues.some((i) => i.code === 'invalid-buffered-native-interval')
    ).toBe(false);
  });
  it('rejects overlapping synchronous operations even with increasing sample timestamps', () => {
    const d = evidence();
    for (const frame of d.raw.frames)
      frame.geometry.finishedAt = frame.geometry.startedAt + 24;
    d.raw.stoppedAt = d.raw.frames.at(-1)!.geometry.finishedAt + 10;
    const result = assess(d);
    expect(result.verdict).toBe('INCOMPLETE');
    expect(
      result.issues.some(
        (i) => i.code === 'overlapping-native-recording-operations'
      )
    ).toBe(true);
    expect(
      result.issues.some((i) => i.code === 'invalid-buffered-native-interval')
    ).toBe(false);
  });
  it('bounds initial coverage by the first actual sample time', () => {
    const d = evidence();
    for (const frame of d.raw.frames) {
      frame.geometry.startedAt += 124;
      frame.geometry.finishedAt += 124;
      if (frame.displayLinkTimestamp !== undefined)
        frame.displayLinkTimestamp += 124;
      if (frame.displayLinkTargetTimestamp !== undefined)
        frame.displayLinkTargetTimestamp += 124;
    }
    d.raw.frames[0].geometry.finishedAt += 1;
    d.raw.stoppedAt += 124;
    expect(
      assess(d).issues.some(
        (i) => i.code === 'native-recording-coverage-gap' && i.frame === 0
      )
    ).toBe(true);
  });
  it.each([
    { y: 620, composerX: 0, visible: false },
    { y: 580, composerX: 0, visible: true },
    { y: 620, composerX: 500, visible: true },
  ])(
    'intersects required-row exposure with usable viewport %j',
    ({ y, composerX, visible }) => {
      const d = evidence();
      for (const frame of d.raw.frames) {
        const row = frame.geometry.rows![0].view!;
        row.frame = { ...row.frame, y, height: 40 };
        row.clipFrame = { ...row.clipFrame, y, height: 40 };
        const composer = frame.geometry.composer!;
        composer.frame.x = composer.clipFrame.x = composerX;
      }
      const result = assess(d);
      expect(result.verdict).toBe('COMPLETE');
      expect(
        result.exposureSamples.every(
          (s) => s.visibleRequiredKeys.includes('reading') === visible
        )
      ).toBe(true);
    }
  );
});

function entryEvidence() {
  const d = evidence();
  const oldTag = 'tlon-conversation-scroll-edge-content-old';
  const newTag = 'tlon-conversation-scroll-edge-content-new';
  d.contract.visibility = 'observe-entry-concealment';
  d.contract.requiredKeys = [];
  d.raw.request.rootId = d.contract.request.rootId =
    'scroll-stability-native-root';
  d.raw.request.scrollViewId = d.contract.request.scrollViewId = oldTag;
  d.raw.request.composerId = d.contract.request.composerId =
    'scroll-stability-composer';
  d.contract.itinerary = {
    version: 1,
    owners: [
      {
        rootId: d.contract.request.rootId,
        scope: d.contract.scope,
        scrollViewId: oldTag,
      },
      {
        rootId: d.contract.request.rootId,
        scope: 'channel::8',
        scrollViewPrefix: 'tlon-conversation-scroll-edge-content-',
      },
    ],
  };
  d.raw.itinerary = structuredClone(d.contract.itinerary);
  for (const [index, frame] of d.raw.frames.entries()) {
    const owner = index < 30 ? 0 : 1;
    const scope = d.contract.itinerary.owners[owner].scope;
    const tag = owner === 0 ? oldTag : newTag;
    frame.owner = {
      index: owner,
      rootId: d.contract.request.rootId,
      scope,
      scrollViewId: tag,
    };
    frame.geometry.rootId = d.contract.request.rootId;
    frame.geometry.composerId = d.contract.request.composerId;
    frame.geometry.scrollViewId = tag;
    frame.geometry.scroll!.view.identity = `scroll-view-${owner}`;
    frame.geometry.scroll!.hostIdentity = `host-${owner}`;
    frame.geometry.ownerHosts = [{ id: tag, identity: `host-${owner}` }];
    frame.geometry.root!.semanticValue = JSON.stringify({
      version: 1,
      scope,
      requestedKeys: ['reading', 'newer'],
    });
    const row = frame.geometry.rows![0].view!;
    row.identity = `reading-view-${owner}`;
    row.semanticValue = JSON.stringify({
      ...JSON.parse(row.semanticValue!),
      scope,
    });
    if (index >= 30 && index < 33)
      frame.geometry.scroll!.view.effectiveAlpha = 0;
    if (index >= 30 && index < 35) row.effectiveAlpha = 0;
    if (index === 30) {
      frame.geometry.rows = [];
      frame.geometry.rowIds = [];
    }
  }
  return d;
}

describe('predeclared native entry ownership', () => {
  it('retains hidden and empty destination acquisition, then separately marks viewport and readable content exposure', () => {
    const result = assess(entryEvidence());
    expect(result.issues).toEqual([]);
    expect(result.verdict).toBe('COMPLETE');
    expect(result.samples).toHaveLength(61);
    expect(result.ownerSamples[30]).toMatchObject({
      index: 1,
      scope: 'channel::8',
      viewportVisible: false,
    });
    expect(result.firstExposedDestinationFrame).toBe(33);
    expect(result.firstContentDestinationFrame).toBe(35);
    expect(result.semanticSamples[30].rows).toEqual([]);
    expect(result.samples[30].measurement?.valid).toBe(true);
  });
  it('does not invent readable content for a visible but empty destination', () => {
    const d = entryEvidence();
    for (const frame of d.raw.frames.slice(30)) {
      frame.geometry.rowIds = [];
      frame.geometry.rows = [];
    }
    const result = assess(d);
    expect(result.verdict).toBe('COMPLETE');
    expect(result.firstExposedDestinationFrame).toBe(33);
    expect(result.firstContentDestinationFrame).toBeNull();
  });
  it.each([
    [
      'third scope',
      (d: ReturnType<typeof entryEvidence>) => {
        d.raw.frames[40].owner!.scope = 'channel::9';
      },
    ],
    [
      'reverse scope',
      (d: ReturnType<typeof entryEvidence>) => {
        const previous = structuredClone(d.raw.frames[20]);
        const frame = d.raw.frames[40];
        frame.owner = previous.owner;
        frame.geometry = {
          ...previous.geometry,
          requestId: frame.geometry.requestId,
          startedAt: frame.geometry.startedAt,
          finishedAt: frame.geometry.finishedAt,
        };
      },
    ],
    [
      'missing outgoing owner',
      (d: ReturnType<typeof entryEvidence>) => {
        d.raw.frames[0].owner = structuredClone(d.raw.frames[40].owner);
      },
    ],
    [
      'missing destination owner',
      (d: ReturnType<typeof entryEvidence>) => {
        d.raw.frames.splice(30);
        d.raw.stoppedAt = d.raw.frames.at(-1)!.geometry.finishedAt + 10;
        d.contract.minimumDurationMs = 400;
      },
    ],
    [
      'changed raw declaration',
      (d: ReturnType<typeof entryEvidence>) => {
        d.raw.itinerary!.owners[1].scope = 'channel::9';
      },
    ],
    [
      'undeclared itinerary',
      (d: ReturnType<typeof entryEvidence>) => {
        delete d.contract.itinerary;
      },
    ],
    [
      'ordinary visibility permission',
      (d: ReturnType<typeof entryEvidence>) => {
        d.contract.visibility = 'require-visible';
      },
    ],
    [
      'mixed row scope',
      (d: ReturnType<typeof entryEvidence>) => {
        d.raw.frames[40].geometry.rows![0].view!.semanticValue =
          d.raw.frames[20].geometry.rows![0].view!.semanticValue;
      },
    ],
    [
      'mixed root scope',
      (d: ReturnType<typeof entryEvidence>) => {
        d.raw.frames[40].geometry.root!.semanticValue =
          d.raw.frames[20].geometry.root!.semanticValue;
      },
    ],
    [
      'same-scope native replacement',
      (d: ReturnType<typeof entryEvidence>) => {
        d.raw.frames[40].geometry.scroll!.view.identity = 'replaced';
      },
    ],
    [
      'physical root replacement',
      (d: ReturnType<typeof entryEvidence>) => {
        d.raw.frames[40].geometry.root!.identity = 'replacement-root';
      },
    ],
    [
      'missing host inventory',
      (d: ReturnType<typeof entryEvidence>) => {
        delete d.raw.frames[40].geometry.ownerHosts;
      },
    ],
    [
      'duplicate hidden host even with forged ok status',
      (d: ReturnType<typeof entryEvidence>) => {
        d.raw.frames[40].geometry.ownerHosts!.push({
          id: 'tlon-conversation-scroll-edge-content-hidden',
          identity: 'hidden-host',
        });
      },
    ],
    [
      'host inventory identity mismatch',
      (d: ReturnType<typeof entryEvidence>) => {
        d.raw.frames[40].geometry.ownerHosts![0].identity = 'unrelated-host';
      },
    ],
    [
      'missing destination geometry',
      (d: ReturnType<typeof entryEvidence>) => {
        delete d.raw.frames[32].geometry.scroll;
      },
    ],
  ] as const)(
    'rejects %s independently of producer status',
    (_name, corrupt) => {
      const d = entryEvidence();
      expect(assess(d).verdict).toBe('COMPLETE');
      corrupt(d);
      expect(assess(d).verdict).toBe('INCOMPLETE');
    }
  );
  it('does not call a composer-covered row readable content', () => {
    const d = entryEvidence();
    for (const frame of d.raw.frames.slice(30)) {
      for (const row of frame.geometry.rows ?? []) {
        row.view!.frame = { ...row.view!.frame, y: 620, height: 40 };
        row.view!.clipFrame = { ...row.view!.clipFrame, y: 620, height: 40 };
      }
    }
    const result = assess(d);
    expect(result.verdict).toBe('COMPLETE');
    expect(result.firstExposedDestinationFrame).toBe(33);
    expect(result.firstContentDestinationFrame).toBeNull();
  });
  it('rejects same-scope host replacement even when its inventory and native scroll still agree', () => {
    const d = entryEvidence();
    const frame = d.raw.frames[40];
    frame.geometry.scroll!.hostIdentity = 'new-host';
    frame.geometry.ownerHosts![0].identity = 'new-host';
    expect(assess(d).issues).toContainEqual({
      code: 'same-scope-native-owner-replaced',
      frame: 40,
    });
  });
  it('replays the exact entry generation while withholding legacy and ordinary-scenario itinerary permission', () => {
    const d = entryEvidence();
    const id = 'run:entry-latest:1';
    d.raw.recordingId = d.contract.recordingId = id;
    d.raw.request.durationMs = d.contract.request.durationMs = 4300;
    d.contract.minimumDurationMs = 2675;
    const last = d.raw.frames.at(-1)!;
    while (d.raw.frames.length < 181) d.raw.frames.push(structuredClone(last));
    for (const [sequence, frame] of d.raw.frames.entries()) {
      frame.sequence = sequence;
      frame.geometry.requestId = `${id}:${sequence}`;
      frame.geometry.startedAt = 10_000 + sequence * 16;
      frame.geometry.finishedAt = frame.geometry.startedAt + 1;
      if (sequence) {
        frame.displayLinkTimestamp = frame.geometry.startedAt - 1;
        frame.displayLinkTargetTimestamp = frame.geometry.startedAt + 15;
      }
    }
    d.raw.stoppedAt = d.raw.frames.at(-1)!.geometry.finishedAt + 10;
    const trace = {
      fixtureVersion: 2,
      platform: 'ios',
      productCoverage: 'local-component-fixture',
      runId: 'run',
      scenario: 'entry-latest',
      originalDataKeys: ['reading', 'newer'],
      nativeRecording: d.raw,
      nativeRecordingContract: d.contract,
    };
    expect(replayNativeRecording(trace).verdict).toBe('COMPLETE');
    const legacy = structuredClone(trace);
    delete legacy.nativeRecordingContract.itinerary;
    delete legacy.nativeRecording.itinerary;
    expect(replayNativeRecording(legacy).issues[0].code).toBe(
      'missing-or-changed-native-entry-itinerary'
    );
    const changed = structuredClone(trace);
    changed.nativeRecordingContract.itinerary!.owners[1].scope = 'channel::9';
    changed.nativeRecording.itinerary!.owners[1].scope = 'channel::9';
    expect(replayNativeRecording(changed).issues[0].code).toBe(
      'missing-or-changed-native-entry-itinerary'
    );
    trace.scenario = 'append-history';
    d.raw.recordingId = d.contract.recordingId = 'run:append-history:1';
    d.contract.visibility = 'require-visible';
    expect(replayNativeRecording(trace).issues[0].code).toBe(
      'unexpected-native-scenario-itinerary'
    );
  });
});
