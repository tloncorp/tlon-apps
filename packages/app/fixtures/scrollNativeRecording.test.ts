import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  adaptBufferedNativeScrollGeometry,
  adaptNativeScrollGeometry,
  type NativeGeometryView,
} from './scrollNativeGeometry';
import {
  assessNativeRecording,
  type NativeRecording,
  type NativeRecordingContract,
} from './scrollNativeRecording';

import {
  replayNativeRecording,
  // @ts-expect-error The existing JavaScript CLI export has no declaration.
  replayNativeBottomContinuity,
} from '../../../scripts/scroll-stability-native-recording-evidence.mjs';
// @ts-expect-error This deliberately tests the untyped JavaScript CLI boundary.
import { assessNativeEvidence } from '../../../scripts/scroll-stability-native-evidence.mjs';
// @ts-expect-error This deliberately tests the untyped JavaScript report boundary.
import * as reporter from '../../../scripts/scroll-stability-report.mjs';
const { classifyEvidence, qualifyEvidence } = reporter;

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

// Synthetic native-walk controls. The real R15/R17 recordings are separate
// replay evidence and are not required by this durable test.
function bottomEvidence() {
  const { raw, contract } = evidence();
  const scenario = 'thinking-show-hide-end';
  const recordingId = `bottom-run:${scenario}:1`;
  raw.recordingId = contract.recordingId = recordingId;
  raw.request.durationMs = contract.request.durationMs = 3900;
  contract.minimumDurationMs = 2275;
  contract.requiredKeys = [];
  const template = raw.frames[1];
  raw.frames = Array.from({ length: 151 }, (_, sequence) => {
    const frame = structuredClone(template);
    frame.sequence = sequence;
    frame.trigger = sequence ? 'display-link' : 'start';
    frame.geometry.requestId = `${recordingId}:${sequence}`;
    frame.geometry.startedAt = 10000 + sequence * 16;
    frame.geometry.finishedAt = frame.geometry.startedAt + 1;
    frame.displayLinkTimestamp = frame.geometry.startedAt - 1;
    frame.displayLinkTargetTimestamp = frame.geometry.startedAt + 15;
    const g = frame.geometry;
    g.scroll!.offset.y = g.scroll!.bounds.y = 1500;
    for (const view of [g.root!, g.scroll!.view, g.composer!]) {
      view.lifetimeIdentity = `lifetime:${view.identity}`;
    }
    g.nativeReading = {
      committedMembership: {
        version: 1,
        status: 'ok',
        scopeIdentity: 'scope-lifetime',
        scope: 'channel',
        visit: 'visit-7',
        dataRevision: '1',
        rows: [
          { key: 'reading', revision: '1' },
          { key: 'newer', revision: '2' },
        ],
      },
    };
    return frame;
  });
  raw.stoppedAt = 12410;
  return {
    fixtureVersion: 2,
    platform: 'ios',
    productCoverage: 'local-component-fixture',
    runId: 'bottom-run',
    scenario,
    assertion: 'bottom',
    originalDataKeys: ['reading', 'newer'],
    expectations: { bottom: { tailKey: 'newer', tolerancePt: 1 } },
    nativeRecording: raw,
    nativeRecordingContract: contract,
    emptyEndThroughout: false,
  };
}

describe('buffered native bottom continuity', () => {
  it('preserves a native failure when the sampled contract is incomplete', () => {
    const trace = bottomEvidence();
    trace.nativeRecording.frames[40].geometry.scroll!.offset.y -= 52;
    trace.nativeRecording.frames[40].geometry.scroll!.bounds.y -= 52;
    expect(assessNativeEvidence(trace)).toMatchObject({
      status: 'fail',
      sampledGeometry: { status: 'incomplete' },
      nativeContinuity: { verdict: 'FAIL' },
    });
  });
  it('does not grant a full pass from native continuity alone', () => {
    expect(assessNativeEvidence(bottomEvidence())).toMatchObject({
      status: 'incomplete',
      sampledGeometry: { status: 'incomplete' },
      nativeContinuity: { verdict: 'PASS', nativePresentation: 'INCOMPLETE' },
    });
  });
  it.each([0, 250, 2000.375])(
    'uses the legal end for content height %s',
    (height) => {
      const trace = bottomEvidence();
      for (const { geometry } of trace.nativeRecording.frames) {
        const scroll = geometry.scroll!;
        scroll.contentSize.height = height;
        scroll.offset.y = scroll.bounds.y = Math.max(0, height - 600 + 100);
      }
      expect(replayNativeBottomContinuity(trace)).toMatchObject({
        verdict: 'PASS',
        metrics: { observedFrames: 151, maxEndDistancePt: 0 },
      });
    }
  );
  it('qualifies the complete stationary native geometry, without claiming actions or presentation', () => {
    expect(replayNativeBottomContinuity(bottomEvidence())).toMatchObject({
      verdict: 'PASS',
      productActions: 'UNASSESSED',
      nativePresentation: 'INCOMPLETE',
      metrics: { observedFrames: 151, maxEndDistancePt: 0 },
    });
  });
  it('catches a single 52pt gap followed by perfect recovery', () => {
    const trace = bottomEvidence();
    trace.nativeRecording.frames[40].geometry.scroll!.contentSize.height += 52;
    expect(replayNativeRecording(trace).verdict).toBe('COMPLETE');
    expect(replayNativeBottomContinuity(trace)).toMatchObject({
      verdict: 'FAIL',
      metrics: { observedFrames: 151, maxEndDistancePt: 52 },
      issues: [{ code: 'native-bottom-gap', frame: 40, kind: 'failure' }],
    });
  });
  it('does not use producer PASS flags or sparse JavaScript samples to erase a native gap', () => {
    const trace = bottomEvidence();
    trace.nativeRecording.frames[40].geometry.scroll!.contentSize.height += 52;
    expect(
      replayNativeBottomContinuity({
        ...trace,
        samples: [
          { time: 0, scroll: 1500 },
          { time: 2000, scroll: 1500 },
        ],
        result: { verdict: 'PASS' },
        nativeContinuity: { verdict: 'PASS' },
        changedData: false,
      }).verdict
    ).toBe('FAIL');
  });
  it('preserves a qualified failure before a later coverage gap', () => {
    const trace = bottomEvidence();
    trace.nativeRecording.frames[40].geometry.scroll!.contentSize.height += 52;
    for (const f of trace.nativeRecording.frames.slice(100)) {
      f.geometry.startedAt += 200;
      f.geometry.finishedAt += 200;
      f.displayLinkTimestamp! += 200;
      f.displayLinkTargetTimestamp! += 200;
    }
    trace.nativeRecording.stoppedAt += 200;
    const result = replayNativeBottomContinuity(trace);
    expect(result.verdict).toBe('FAIL');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'acquisition:native-recording-coverage-gap',
          frame: 100,
        }),
        expect.objectContaining({ code: 'native-bottom-gap', frame: 40 }),
      ])
    );
    expect(result.metrics.observedFrames).toBe(100);
  });
  it('does not interpret an invalid starting position as an action-caused failure', () => {
    const trace = bottomEvidence();
    trace.nativeRecording.frames[0].geometry.scroll!.contentSize.height += 52;
    expect(replayNativeBottomContinuity(trace)).toMatchObject({
      verdict: 'INCOMPLETE',
      metrics: { observedFrames: 0 },
      issues: [
        {
          code: 'native-bottom-baseline-not-at-end',
          frame: 0,
          kind: 'incomplete',
        },
      ],
    });
  });
  it.each(['tracking', 'dragging', 'decelerating'] as const)(
    'retires stationary evidence at native %s',
    (flag) => {
      const trace = bottomEvidence();
      trace.nativeRecording.frames[50].geometry.scroll![flag] = true;
      trace.nativeRecording.frames[51].geometry.scroll!.contentSize.height += 52;
      expect(replayNativeBottomContinuity(trace)).toMatchObject({
        verdict: 'INCOMPLETE',
        metrics: { observedFrames: 50, maxEndDistancePt: 0 },
        issues: [
          { code: 'native-bottom-gesture', frame: 50, kind: 'incomplete' },
        ],
      });
    }
  );
  it('does not revive evidence after a same-value physical-owner return', () => {
    const trace = bottomEvidence();
    trace.nativeRecording.frames[50].geometry.root!.lifetimeIdentity =
      'different-lifetime';
    trace.nativeRecording.frames[51].geometry.scroll!.contentSize.height += 52;
    expect(replayNativeBottomContinuity(trace)).toMatchObject({
      verdict: 'INCOMPLETE',
      metrics: { observedFrames: 50, maxEndDistancePt: 0 },
      issues: [
        { code: 'native-bottom-owner-replaced', frame: 50, kind: 'incomplete' },
      ],
    });
  });
  it('retains a valid earlier failure alongside later lost ownership', () => {
    const trace = bottomEvidence();
    trace.nativeRecording.frames[40].geometry.scroll!.contentSize.height += 52;
    trace.nativeRecording.frames[50].geometry.root!.lifetimeIdentity =
      'different-lifetime';
    expect(replayNativeBottomContinuity(trace)).toMatchObject({
      verdict: 'FAIL',
      metrics: { observedFrames: 50, maxEndDistancePt: 52 },
    });
  });
  it('retains a qualified gap before the acquisition reader sees a later pointer replacement', () => {
    const trace = bottomEvidence();
    trace.nativeRecording.frames[40].geometry.scroll!.contentSize.height += 52;
    trace.nativeRecording.frames[50].geometry.root!.identity =
      'different-pointer';
    expect(replayNativeBottomContinuity(trace)).toMatchObject({
      verdict: 'FAIL',
      metrics: { observedFrames: 50, maxEndDistancePt: 52 },
    });
  });
  it('retains a qualified gap before a later malformed frame, without zipping across the hole', () => {
    const trace = bottomEvidence();
    trace.nativeRecording.frames[40].geometry.scroll!.contentSize.height += 52;
    // The input reader accepts unknown data; simulate a malformed serialized frame.
    Object.assign(trace.nativeRecording.frames[50], { geometry: null });
    expect(replayNativeBottomContinuity(trace)).toMatchObject({
      verdict: 'FAIL',
      metrics: { observedFrames: 50, maxEndDistancePt: 52 },
    });
  });
  it('requires actual native lifetime identity', () => {
    const trace = bottomEvidence();
    delete trace.nativeRecording.frames[0].geometry.composer!.lifetimeIdentity;
    expect(replayNativeBottomContinuity(trace).verdict).toBe('INCOMPLETE');
  });
  it('rejects a changed native scope even when geometry is identical', () => {
    const trace = bottomEvidence();
    trace.nativeRecording.frames[50].geometry.nativeReading = {
      committedMembership: {
        version: 1,
        status: 'ok',
        scopeIdentity: 'scope-lifetime',
        scope: 'channel',
        visit: 'other-visit',
      },
    };
    expect(replayNativeBottomContinuity(trace)).toMatchObject({
      verdict: 'INCOMPLETE',
      metrics: { observedFrames: 50 },
    });
  });
  it('does not treat native dictionary field ordering as a layout change', () => {
    const trace = bottomEvidence();
    const frame = trace.nativeRecording.frames[50].geometry.root!.frame;
    trace.nativeRecording.frames[50].geometry.root!.frame = {
      height: frame.height,
      width: frame.width,
      y: frame.y,
      x: frame.x,
    };
    expect(replayNativeBottomContinuity(trace).verdict).toBe('PASS');
  });
  it('rejects a changed stationary viewport and keeps it out of gap arithmetic', () => {
    const trace = bottomEvidence();
    trace.nativeRecording.frames[50].geometry.scroll!.adjustedContentInset.bottom += 2;
    expect(replayNativeBottomContinuity(trace)).toMatchObject({
      verdict: 'INCOMPLETE',
      metrics: { maxEndDistancePt: 0 },
    });
  });
  it('does not zip a shortened sample list to remaining raw frames', () => {
    const trace = bottomEvidence();
    trace.nativeRecording.frames[50].geometry.rowIds = [];
    expect(replayNativeBottomContinuity(trace).verdict).toBe('INCOMPLETE');
  });
  it('requires acquisition to begin before its native action marker', () => {
    const trace = bottomEvidence();
    trace.nativeRecording.markers[0].time = trace.nativeRecording.startedAt;
    expect(replayNativeBottomContinuity(trace).verdict).toBe('INCOMPLETE');
  });
  it('rejects a weakened position tolerance', () => {
    const trace = bottomEvidence();
    trace.expectations.bottom.tolerancePt = 60;
    expect(replayNativeBottomContinuity(trace).verdict).toBe('INCOMPLETE');
  });
  it.each([
    'entry-latest',
    'command-center',
    'gesture',
    'armed-thinking-gesture',
    'unknown',
  ])('does not claim the %s policy', (scenario) => {
    expect(
      replayNativeBottomContinuity({ ...bottomEvidence(), scenario }).verdict
    ).toBe('UNASSESSED');
  });
});

describe('native buffered acquisition', () => {
  it.each([
    ['append-history', 1800],
    ['command-center', 2800],
    ['command-offscreen', 2800],
  ] as const)(
    'independently binds %s to its declared native duration',
    (scenario, duration) => {
      const { raw, contract } = evidence();
      const recordingId = `run:${scenario}:1`;
      raw.recordingId = contract.recordingId = recordingId;
      raw.request.durationMs = contract.request.durationMs = duration + 1500;
      contract.minimumDurationMs = duration - 125;
      const template = raw.frames[1];
      raw.frames = Array.from(
        { length: Math.ceil((duration - 40) / 16) + 1 },
        (_, sequence) => {
          const frame = structuredClone(template);
          frame.sequence = sequence;
          frame.trigger = sequence === 0 ? 'start' : 'display-link';
          frame.geometry.requestId = `${recordingId}:${sequence}`;
          frame.geometry.startedAt = 10_000 + sequence * 16;
          frame.geometry.finishedAt = frame.geometry.startedAt + 1;
          frame.displayLinkTimestamp = frame.geometry.startedAt - 1;
          frame.displayLinkTargetTimestamp = frame.geometry.startedAt + 15;
          return frame;
        }
      );
      raw.stoppedAt = 10_000 + duration - 30;
      const trace = {
        fixtureVersion: 2,
        platform: 'ios',
        productCoverage: 'local-component-fixture',
        runId: 'run',
        scenario,
        originalDataKeys: ['reading', 'newer'],
        nativeRecording: raw,
        nativeRecordingContract: contract,
        nativeRecordingAcquisition: { verdict: 'PASS' },
      };
      if (scenario === 'command-offscreen') {
        const changedMinimum = structuredClone(trace);
        changedMinimum.nativeRecordingContract.minimumDurationMs = 100;
        const changedCapacity = structuredClone(trace);
        changedCapacity.nativeRecordingContract.request.durationMs = 3300;
        const cwd = [process.cwd(), resolve(process.cwd(), '../..')].find(
          (path) =>
            existsSync(
              resolve(
                path,
                'scripts/scroll-stability-native-recording-evidence.mjs'
              )
            )
        );
        if (!cwd) throw new Error('Native replay repository root unavailable');
        const output = execFileSync(
          process.execPath,
          [
            '--experimental-strip-types',
            '--input-type=module',
            '--eval',
            `import { readFileSync } from 'node:fs';
import { replayNativeRecording } from './scripts/scroll-stability-native-recording-evidence.mjs';
process.stdout.write(JSON.stringify(JSON.parse(readFileSync(0, 'utf8')).map(replayNativeRecording)));`,
          ],
          {
            cwd,
            env: { ...process.env, NODE_OPTIONS: '' },
            input: JSON.stringify([trace, changedMinimum, changedCapacity]),
            encoding: 'utf8',
            timeout: 10000,
            stdio: ['pipe', 'pipe', 'pipe'],
          }
        );
        const [healthy, minimum, capacity] = JSON.parse(output);
        expect(healthy).toMatchObject({
          verdict: 'COMPLETE',
          productVerdict: 'UNASSESSED',
        });
        for (const rejected of [minimum, capacity]) {
          expect(rejected).toMatchObject({
            verdict: 'INCOMPLETE',
            issues: [{ code: 'native-recording-duration-contract-changed' }],
          });
        }
      }
      expect(replayNativeRecording(trace)).toMatchObject({
        verdict: 'COMPLETE',
        productVerdict: 'UNASSESSED',
      });
      contract.minimumDurationMs = 100;
      expect(replayNativeRecording(trace).issues[0].code).toBe(
        'native-recording-duration-contract-changed'
      );
      contract.minimumDurationMs = duration - 125;
      trace.runId = 'other-run';
      expect(replayNativeRecording(trace).verdict).toBe('INCOMPLETE');
      trace.runId = 'run';
      raw.frames[20].geometry.finishedAt += 40;
      expect(replayNativeRecording(trace).verdict).toBe('INCOMPLETE');
    }
  );
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

// Exact new native tail source contract, using the existing synthetic native
// capture builder. No local recording file or device is needed by these tests.
function postGestureEvidence(outcome: 'end' | 'away' = 'end'): any {
  const { raw, contract } = evidence();
  const scenario = `armed-post-gesture-thinking-${outcome}`,
    runId = 'gesture-tail-controls';
  const rid = `${runId}:${scenario}:1`,
    scope = contract.scope;
  contract.recordingId = raw.recordingId = rid;
  contract.minimumDurationMs = 4375;
  contract.requiredKeys = [];
  contract.request.durationMs = raw.request.durationMs = 6000;
  const c = {
    version: 1,
    recordingId: rid,
    scope,
    outcome,
    declaredAt: 0,
    probeId: `${rid}:post-gesture`,
    quietTailMs: 1000,
    tolerancePt: 1,
  };
  const template = structuredClone(raw.frames[1]);
  raw.frames = Array.from({ length: 282 }, (_, sequence) => {
    const f = structuredClone(template),
      g = f.geometry as any;
    f.sequence = sequence;
    f.trigger = sequence ? 'display-link' : 'start';
    f.displayLinkTimestamp = 10000 + sequence * 16 - 1;
    f.displayLinkTargetTimestamp = 10000 + sequence * 16 + 15;
    g.requestId = `${rid}:${sequence}`;
    g.startedAt = 10000 + sequence * 16;
    g.finishedAt = g.startedAt + 1;
    const extent = sequence >= 60 && sequence <= 75 ? 52 : 0;
    const moving = sequence >= 10 && sequence <= 50;
    const endpoint = outcome === 'end' ? 1500 : 1450;
    const offset = moving
      ? outcome === 'end'
        ? 1500 + (sequence - 10) / 4
        : 1500 - (sequence - 10) * 1.25
      : sequence < 10
        ? 1500
        : endpoint;
    g.scroll.offset.y = g.scroll.bounds.y =
      offset + (outcome === 'end' ? extent : 0);
    g.scroll.contentSize.height = 2000 + extent;
    g.scroll.tracking = g.scroll.dragging = moving;
    g.scroll.decelerating = false;
    const row = g.rows[0].view;
    row.frame.y = row.clipFrame.y =
      300 + endpoint - offset - (outcome === 'end' ? extent : 0);
    const cell = structuredClone(row);
    cell.identity = 'reading-cell';
    cell.containingCellIdentity = cell.identity;
    row.containingCellIdentity = cell.identity;
    const body = structuredClone(g.composer);
    body.identity = 'body';
    const manifest = structuredClone(g.root);
    manifest.identity = 'manifest';
    manifest.frame = manifest.clipFrame = { x: 0, y: 0, width: 0, height: 0 };
    manifest.semanticValue = JSON.stringify({
      version: 1,
      scope,
      surfaceIds: ['scroll-surface-body'],
    });
    for (const v of [g.root, g.composer, g.scroll.view, row, cell])
      v.lifetimeIdentity = `lifetime:${v.identity}`;
    g.ruler = {
      version: 1,
      cells: [{ id: 'scroll-cell-reading', matches: 1, view: cell }],
      surfaces: [{ id: 'scroll-surface-body', matches: 1, view: body }],
      manifest: { id: 'scroll-surface-manifest', matches: 1, view: manifest },
    };
    const m = {
      version: 1,
      status: 'ok',
      scopeIdentity: 'scope-lifetime',
      scope: 'channel',
      visit: 'visit-7',
      dataRevision: '1',
      rows: [
        { key: 'reading', revision: '1' },
        { key: 'newer', revision: '2' },
      ],
    };
    g.nativeReading = {
      generation: 1,
      committedMembership: m,
      rowBindings: {
        ...m,
        rows: [
          {
            status: 'ok',
            rowId: 'scroll-row-reading',
            cellId: 'scroll-cell-reading',
            key: 'reading',
            revision: '1',
            fixtureScope: scope,
            rowViewIdentity: row.lifetimeIdentity,
            cellViewIdentity: cell.lifetimeIdentity,
            registrationIdentity: 'registration',
            hostIdentity: 'row-host',
          },
        ],
      },
    };
    return f;
  });
  raw.stoppedAt = 14506;
  raw.markers = [
    { sequence: 0, name: 'action-start', time: 10030 },
    { sequence: 1, name: `c`, time: 10920 },
    { sequence: 2, name: `c`, time: 11220 },
  ];
  raw.markers[1].name = `${c.probeId}:start`;
  raw.markers[2].name = `${c.probeId}:hidden`;
  const base: any = structuredClone(raw.frames[56].geometry);
  base.requestId = 'baseline';
  base.startedAt = 10905;
  base.finishedAt = 10906;
  const request = {
    requestId: base.requestId,
    rootId: contract.request.rootId,
    scrollViewId: contract.request.scrollViewId,
    composerId: contract.request.composerId,
    rows: [{ key: 'reading', id: 'scroll-row-reading' }],
  };
  const bracket = {
    requestedAt: 906,
    receivedAt: 909,
    requiredKeys: [],
    populated: true,
    ruler: { version: 'indexed-cell-and-surfaces-v2' as const, scope },
  };
  const adapted = adaptNativeScrollGeometry(base, request, bracket);
  const baseline = adapted.snapshot as any;
  baseline.measurement.durationMs = 3;
  baseline.acquisition.jsCoherence = { coherent: true };
  const completion = { name: 'drag-end', time: 900 };
  return {
    fixtureVersion: 2,
    platform: 'ios',
    productCoverage: 'local-component-fixture',
    runId,
    scenario,
    assertion: 'observe',
    expectations: null,
    result: null,
    originalDataKeys: ['reading', 'newer'],
    nativeRecording: raw,
    nativeRecordingContract: contract,
    nativeRecordingTransfer: { startAcknowledgedAt: 10 },
    events: [
      {
        name: 'native-post-gesture-plan',
        time: 0,
        values: { contract: JSON.stringify(c) },
      },
      {
        name: 'scenario-start',
        time: 11,
        values: { scenario, assertion: 'observe' },
      },
      {
        name: 'native-post-gesture-armed',
        time: 12,
        values: { probeId: c.probeId },
      },
      { name: 'drag-begin', time: 100 },
      completion,
      {
        name: 'thinking-request',
        time: 931,
        values: { visible: true, label: 'Thinking...', layoutChange: true },
      },
      {
        name: 'thinking-commit',
        time: 960,
        values: { visible: true, label: 'Thinking...' },
      },
      { name: 'thinking-layout', time: 970, values: { height: 52 } },
      {
        name: 'thinking-request',
        time: 1190,
        values: { visible: false, label: '', layoutChange: true },
      },
      {
        name: 'thinking-commit',
        time: 1218,
        values: { visible: false, label: '' },
      },
      { name: 'thinking-layout', time: 1219, values: { height: 0 } },
    ],
    nativePostGestureProbe: {
      contract: c,
      armedAt: 12,
      completion,
      baseline,
      ...(outcome === 'away' ? { anchorKey: 'reading' } : {}),
      markerTransfers: [
        {
          name: `${c.probeId}:start`,
          requestedAt: 910,
          receivedAt: 930,
          clock: 'performance.now milliseconds',
        },
        {
          name: `${c.probeId}:hidden`,
          requestedAt: 1220,
          receivedAt: 1230,
          clock: 'performance.now milliseconds',
        },
      ],
    },
  };
}
describe('two canonical native post-gesture tail assertions', () => {
  it.each(['end', 'away'] as const)(
    'asserts %s via public importer and canonical reporter instead of manual observe',
    (outcome) => {
      const t = postGestureEvidence(outcome),
        r = assessNativeEvidence(t);
      expect(r).toMatchObject({
        status: 'recorded-sampled-pass',
        geometryEvidenceLevel: 'native-buffered-post-gesture-tail-v1',
        nativePostGestureTail: {
          verdict: 'PASS',
          nativePresentation: 'INCOMPLETE',
        },
      });
      expect(classifyEvidence(t)).toBe('recorded-sampled-pass');
      expect(qualifyEvidence(t).status).toBe('recorded-sampled-pass');
    }
  );
  it.each(['end', 'away'] as const)(
    'accepts %s baseline bounds after the actual JSON roundtrip',
    (outcome) => {
      const source = postGestureEvidence(outcome);
      expect(
        Object.is(source.nativePostGestureProbe.baseline.scrollBounds.min, -0)
      ).toBe(true);
      const trace = JSON.parse(JSON.stringify(source));
      expect(
        Object.is(trace.nativePostGestureProbe.baseline.scrollBounds.min, -0)
      ).toBe(false);
      expect(assessNativeEvidence(trace).nativePostGestureTail.verdict).toBe(
        'PASS'
      );
      expect(qualifyEvidence(trace).status).toBe('recorded-sampled-pass');
    }
  );
  it.each(['min', 'max'] as const)(
    'rejects a different serialized baseline bound %s',
    (bound) => {
      const trace = JSON.parse(JSON.stringify(postGestureEvidence()));
      trace.nativePostGestureProbe.baseline.scrollBounds[bound] += 1;
      expect(assessNativeEvidence(trace)).toMatchObject({
        status: 'incomplete',
        nativePostGestureTail: {
          verdict: 'INCOMPLETE',
          issues: [{ code: 'native-post-gesture-baseline-unqualified' }],
          metrics: { qualifiedFrames: 0, maxErrorPt: 0 },
        },
      });
    }
  );
  it.each(['end', 'away'] as const)(
    'reports actual 18pt %s geometry through canonical importer',
    (outcome) => {
      const t = postGestureEvidence(outcome),
        g = t.nativeRecording.frames[100].geometry;
      if (outcome === 'end') g.scroll.offset.y = g.scroll.bounds.y -= 18;
      else {
        g.rows[0].view.frame.y += 18;
        g.rows[0].view.clipFrame.y += 18;
        g.ruler.cells[0].view.frame.y += 18;
        g.ruler.cells[0].view.clipFrame.y += 18;
      }
      expect(assessNativeEvidence(t)).toMatchObject({
        status: 'fail',
        nativePostGestureTail: { verdict: 'FAIL', metrics: { maxErrorPt: 18 } },
      });
      expect(classifyEvidence(t)).toBe('fail');
    }
  );
  const corruptions: [string, (t: any) => void][] = [
    [
      'missing declared contract',
      (t) => delete t.nativePostGestureProbe.contract,
    ],
    [
      'command after completion before snapshot',
      (t) => {
        t.events.push({ name: 'center-command-request', time: 903 });
        t.events.sort((a: any, b: any) => a.time - b.time);
      },
    ],
    [
      'missing real completion',
      (t) => (t.events = t.events.filter((e: any) => e.name !== 'drag-end')),
    ],
    [
      'snapshot requested before completion',
      (t) =>
        (t.nativePostGestureProbe.baseline.acquisition.nativeGeometry.bracket.requestedAt = 899),
    ],
    [
      'native baseline still decelerating',
      (t) =>
        (t.nativePostGestureProbe.baseline.acquisition.nativeGeometry.capture.scroll.decelerating = true),
    ],
    [
      'native baseline owner unbound',
      (t) =>
        (t.nativePostGestureProbe.baseline.acquisition.nativeGeometry.capture.nativeReading.rowBindings.status =
          'unavailable'),
    ],
    [
      'baseline wrong endpoint',
      (t) => {
        const p = t.nativePostGestureProbe;
        p.baseline.scroll -= 50;
        p.baseline.acquisition.nativeGeometry.capture.scroll.offset.y -= 50;
        p.baseline.acquisition.nativeGeometry.capture.scroll.bounds.y -= 50;
      },
    ],
    [
      'thinking begins before probe marker ACK',
      (t) =>
        (t.events.find((e: any) => e.name === 'thinking-request').time = 929),
    ],
    [
      'missing actual shown layout',
      (t) =>
        (t.events = t.events.filter(
          (e: any) => !(e.name === 'thinking-layout' && e.values.height === 52)
        )),
    ],
    [
      'no native drag displacement',
      (t) => {
        for (const { geometry: g } of t.nativeRecording.frames)
          if (g.scroll.dragging) g.scroll.offset.y = g.scroll.bounds.y = 1500;
      },
    ],
    [
      'later native motion',
      (t) => (t.nativeRecording.frames[100].geometry.scroll.tracking = true),
    ],
    [
      'native owner generation changed',
      (t) => t.nativeRecording.frames[100].geometry.nativeReading.generation++,
    ],
    [
      'short native tail',
      (t) => {
        t.nativeRecording.markers[2].time = 14000;
      },
    ],
    [
      'unknown scenario',
      (t) => (t.scenario = 'armed-post-gesture-thinking-foreign'),
    ],
  ];
  it.each(corruptions)('retains incomplete %s', (_name, change) => {
    const t = postGestureEvidence();
    change(t);
    expect(assessNativeEvidence(t).status).toBe('incomplete');
  });
  it('cannot measure an unbound anchor drift', () => {
    const t = postGestureEvidence('away'),
      g = t.nativeRecording.frames[100].geometry;
    g.rows[0].view.frame.y += 18;
    g.rows[0].view.clipFrame.y += 18;
    g.nativeReading.rowBindings.rows[0].status = 'unavailable';
    expect(assessNativeEvidence(t)).toMatchObject({
      status: 'incomplete',
      nativePostGestureTail: { metrics: { maxErrorPt: 0 } },
    });
  });
  it('preserves an observed bad end before a later coverage gap', () => {
    const t = postGestureEvidence();
    t.nativeRecording.frames[100].geometry.scroll.offset.y =
      t.nativeRecording.frames[100].geometry.scroll.bounds.y -= 18;
    for (let i = 180; i < t.nativeRecording.frames.length; i++) {
      const f = t.nativeRecording.frames[i];
      f.geometry.startedAt += 150;
      f.geometry.finishedAt += 150;
      f.displayLinkTimestamp += 150;
      f.displayLinkTargetTimestamp += 150;
    }
    t.nativeRecording.stoppedAt += 150;
    expect(assessNativeEvidence(t)).toMatchObject({
      status: 'fail',
      nativePostGestureTail: { verdict: 'FAIL', metrics: { maxErrorPt: 18 } },
    });
  });
  it('keeps a healthy gap incomplete without a fabricated deadline failure', () => {
    const t = postGestureEvidence();
    for (let i = 180; i < t.nativeRecording.frames.length; i++) {
      const f = t.nativeRecording.frames[i];
      f.geometry.startedAt += 150;
      f.geometry.finishedAt += 150;
      f.displayLinkTimestamp += 150;
      f.displayLinkTargetTimestamp += 150;
    }
    t.nativeRecording.stoppedAt += 150;
    expect(assessNativeEvidence(t)).toMatchObject({
      status: 'incomplete',
      nativePostGestureTail: {
        verdict: 'INCOMPLETE',
        metrics: { maxErrorPt: 0 },
      },
    });
  });
});
