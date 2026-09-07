import { describe, expect, it } from 'vitest';
import {
  assessChromiumPresentationEvidence,
  supportedChromiumPresentationBuild,
} from '../../../scripts/scroll-stability-presentation-evidence.mjs';

// Detector controls reproducing the observed raw Chromium schema. These are
// not product workloads, display measurements or simulated scroller passes.
const pid = 56969;
const tid = 32224676;
const layerTreeId = 1;
const frameId = 'page-frame-id';
const navigationId = 'navigation-id';
const reporter = (state = 'STATE_PRESENTED_ALL', overrides = {}) => ({
  state,
  layer_tree_host_id: layerTreeId,
  frame_source: 4294967296,
  frame_sequence: 259,
  affects_smoothness: false,
  has_missing_content: false,
  checkerboarded_needs_raster: false,
  checkerboarded_needs_record: false,
  has_high_latency: false,
  ...overrides,
});
const mark = (name, ts) => ({
  name: `scroller-presentation-${name}`,
  cat: 'blink.user_timing',
  ph: 'I',
  pid,
  tid,
  ts,
  args: { data: { navigationId, startTime: ts / 1000 } },
});
const pair = (
  data = reporter(),
  id = '0x123',
  begin = 1_010_000,
  end = 1_026_000
) => [
  {
    name: 'PipelineReporter',
    cat: 'cc,benchmark,disabled-by-default-devtools.timeline.frame',
    ph: 'b',
    pid,
    tid: tid + 1,
    ts: begin,
    id2: { local: id },
    args: { chrome_frame_reporter: data },
  },
  {
    name: 'PipelineReporter',
    cat: 'cc,benchmark,disabled-by-default-devtools.timeline.frame',
    ph: 'e',
    pid,
    tid: tid + 1,
    ts: end,
    id2: { local: id },
    args: {},
  },
];
const feedback = (overrides = {}) => ({
  name: 'AnimationFrame::Presentation',
  cat: 'devtools.timeline',
  ph: 'n',
  pid,
  tid,
  ts: 1_026_000,
  id2: { local: '0x5d' },
  args: {
    id: 'd5032c05557360d1',
    begin_frame_id: { source_id: 4294967296, sequence_number: 259 },
  },
  ...overrides,
});
const input = (data = reporter()) => ({
  trace: {
    traceEvents: [
      {
        name: 'process_name',
        ph: 'M',
        pid,
        tid: 0,
        ts: 0,
        args: { name: 'Renderer' },
      },
      {
        name: 'thread_name',
        ph: 'M',
        pid,
        tid,
        ts: 0,
        args: { name: 'CrRendererMain' },
      },
      {
        name: 'SetLayerTreeId',
        cat: 'disabled-by-default-devtools.timeline',
        ph: 'I',
        pid,
        tid,
        ts: 900_000,
        args: { data: { frame: frameId, layerTreeId } },
      },
      mark('start', 1_000_000),
      mark('end', 2_000_000),
      mark('tail', 3_000_000),
      ...pair(data),
      feedback(),
    ],
  },
  receipt: {
    version: {
      ...supportedChromiumPresentationBuild,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
    },
    command: { arguments: ['/test/Chromium', '--enable-automation'] },
    target: {
      targetInfo: {
        targetId: frameId,
        type: 'page',
        url: 'data:text/html,synthetic',
      },
    },
    frame: {
      frameTree: {
        frame: {
          id: frameId,
          loaderId: navigationId,
          url: 'data:text/html,synthetic',
        },
      },
    },
    complete: { dataLossOccurred: false },
    // A caller-controlled label and even perfect heartbeat cannot upgrade raw
    // pipeline evidence into independently observed display presentation.
    source: 'native-presentation',
    heartbeat: Array.from({ length: 181 }, (_, index) => index * (1000 / 60)),
  },
});
const assess = ({ trace, receipt }) =>
  assessChromiumPresentationEvidence(trace, receipt);
const codes = (result) => result.issues.map((issue) => issue.code);
const mutateEvent = (sample, name, mutate) =>
  mutate(sample.trace.traceEvents.find((event) => event.name === name));

describe('raw Chromium presentation evidence importer', () => {
  it('retains original source timestamps and explicitly withholds a physical pass', () => {
    const result = assess(input());
    expect(result).toMatchObject({
      verdict: 'INCOMPLETE',
      passed: false,
      presentationVerdict: 'INCOMPLETE',
      pipelineVerdict: 'NO_FAILURE_OBSERVED',
      attribution: {
        targetId: frameId,
        rendererPid: pid,
        mainThreadId: tid,
        layerTreeId,
      },
      window: {
        startUs: 1_000_000,
        actionEndUs: 2_000_000,
        observationEndUs: 3_000_000,
        unit: 'trace-monotonic-microseconds',
      },
      counts: { records: 1, feedbackEstimates: 1 },
    });
    expect(result.records[0]).toMatchObject({
      begin: { index: 6, timestampUs: 1_010_000, localTrackId: '0x123' },
      end: { index: 7, timestampUs: 1_026_000 },
      frameSource: 4294967296,
      frameSequence: 259,
    });
    expect(result.feedbackEstimates[0]).toMatchObject({
      source: 'chromium-macos-estimated-presentation-feedback',
      physicalPresentationProven: false,
      event: { index: 8, timestampUs: 1_026_000 },
      pipelineBeginEventIndexes: [6],
    });
  });

  it.each(['STATE_DROPPED', 'STATE_PRESENTED_PARTIAL'])(
    'rejects healthy JS heartbeat when Chromium reports %s affecting smoothness',
    (state) => {
      const result = assess(
        input(reporter(state, { affects_smoothness: true }))
      );
      expect(result).toMatchObject({
        verdict: 'FAIL',
        pipelineVerdict: 'FAIL',
        presentationVerdict: 'INCOMPLETE',
        counts: { affectsSmoothness: 1 },
      });
      expect(codes(result)).toContain('renderer-smoothness-failure');
    }
  );

  it.each([
    'has_missing_content',
    'checkerboarded_needs_raster',
    'checkerboarded_needs_record',
  ])('fails the presented frame with %s', (flag) => {
    expect(
      codes(assess(input(reporter('STATE_PRESENTED_ALL', { [flag]: true }))))
    ).toContain('renderer-missing-content');
  });

  it('does not convert a non-smoothness drop or the 75ms high-latency flag into a refresh deadline', () => {
    expect(
      assess(input(reporter('STATE_DROPPED', { has_high_latency: true })))
    ).toMatchObject({
      pipelineVerdict: 'NO_FAILURE_OBSERVED',
      presentationVerdict: 'INCOMPLETE',
      counts: { dropped: 1, highLatencyOver75Ms: 1 },
    });
  });

  it.each(['product', 'revision', 'userAgent'])(
    'rejects an unsupported source %s',
    (field) => {
      const sample = input(
        reporter('STATE_DROPPED', { affects_smoothness: true })
      );
      sample.receipt.version[field] = 'unsupported';
      expect(assess(sample)).toMatchObject({
        verdict: 'INCOMPLETE',
        attribution: null,
        records: [],
      });
      expect(codes(assess(sample))).toContain('unsupported-source');
    }
  );

  it.each([undefined, [], ['/test/Chromium', '--headless=new']])(
    'rejects missing or headless browser arguments %j',
    (args) => {
      const sample = input();
      sample.receipt.command.arguments = args;
      expect(codes(assess(sample))).toContain('unsupported-browser-mode');
    }
  );

  it.each([undefined, {}, { dataLossOccurred: true }])(
    'rejects incomplete CDP completion %j',
    (completion) => {
      const sample = input();
      sample.receipt.complete = completion;
      expect(assess(sample).pipelineVerdict).toBe('INCOMPLETE');
      expect(codes(assess(sample))).toContain('trace-not-complete');
    }
  );

  it('preserves a valid scoped renderer failure despite missing tail and lost data', () => {
    const sample = input(
      reporter('STATE_DROPPED', { affects_smoothness: true })
    );
    sample.receipt.complete.dataLossOccurred = true;
    sample.trace.traceEvents = sample.trace.traceEvents.filter(
      (event) => event.name !== 'scroller-presentation-tail'
    );
    const result = assess(sample);
    expect(result.verdict).toBe('FAIL');
    expect(codes(result)).toEqual(
      expect.arrayContaining([
        'trace-not-complete',
        'invalid-observation-tail',
        'renderer-smoothness-failure',
      ])
    );
  });

  it.each(['start', 'end', 'tail'])('rejects duplicate %s marks', (name) => {
    const sample = input();
    sample.trace.traceEvents.push(mark(name, 1_500_000));
    expect(assess(sample).pipelineVerdict).toBe('INCOMPLETE');
  });

  it.each([
    [
      'short tail',
      'scroller-presentation-tail',
      (event) => {
        event.ts = 2_999_999;
      },
    ],
    [
      'backward end',
      'scroller-presentation-end',
      (event) => {
        event.ts = 999_999;
      },
    ],
    [
      'other navigation',
      'scroller-presentation-start',
      (event) => {
        event.args.data.navigationId = 'old';
      },
    ],
    [
      'other main thread',
      'scroller-presentation-end',
      (event) => {
        event.tid++;
      },
    ],
    [
      'nonfinite time',
      'scroller-presentation-start',
      (event) => {
        event.ts = NaN;
      },
    ],
  ])('rejects %s', (_name, eventName, mutate) => {
    const sample = input();
    mutateEvent(sample, eventName, mutate);
    expect(assess(sample).pipelineVerdict).toBe('INCOMPLETE');
  });

  it('rejects target and navigation changes', () => {
    const changedTarget = input();
    changedTarget.receipt.target.targetInfo.targetId = 'other';
    expect(codes(assess(changedTarget))).toContain('invalid-target');
    const changedNavigation = input();
    changedNavigation.receipt.finalFrame = structuredClone(
      changedNavigation.receipt.frame
    );
    changedNavigation.receipt.finalFrame.frameTree.frame.loaderId = 'other';
    expect(codes(assess(changedNavigation))).toContain('navigation-changed');
  });

  it.each(['process_name', 'thread_name', 'SetLayerTreeId'])(
    'rejects missing %s attribution',
    (name) => {
      const sample = input();
      sample.trace.traceEvents = sample.trace.traceEvents.filter(
        (event) => event.name !== name
      );
      expect(assess(sample)).toMatchObject({
        pipelineVerdict: 'INCOMPLETE',
        attribution: null,
        records: [],
      });
    }
  );

  it('rejects rebinding the layer tree during the action', () => {
    const sample = input();
    const binding = structuredClone(sample.trace.traceEvents[2]);
    binding.ts = 1_500_000;
    binding.args.data.layerTreeId = 2;
    sample.trace.traceEvents.push(binding);
    expect(codes(assess(sample))).toContain('invalid-layer-binding');
  });

  it('rejects another page sharing the purported layer binding', () => {
    const sample = input();
    const binding = structuredClone(sample.trace.traceEvents[2]);
    binding.ts = 1_500_000;
    binding.args.data.frame = 'other';
    sample.trace.traceEvents.push(binding);
    expect(codes(assess(sample))).toContain('ambiguous-layer-binding');
  });

  it('does not attribute another renderer or layer tree failure to this page', () => {
    const sample = input();
    sample.trace.traceEvents.push(
      ...pair(
        reporter('STATE_DROPPED', { affects_smoothness: true }),
        '0x777'
      ).map((event) => ({ ...event, pid: 999 }))
    );
    sample.trace.traceEvents.push(
      ...pair(
        reporter('STATE_DROPPED', {
          affects_smoothness: true,
          layer_tree_host_id: 2,
        }),
        '0x888'
      )
    );
    expect(assess(sample)).toMatchObject({
      pipelineVerdict: 'NO_FAILURE_OBSERVED',
      counts: { records: 1, affectsSmoothness: 0 },
    });
  });

  it.each([
    'DrawFrame',
    'FramePresented',
    'Display::FrameDisplayed',
    'OnVSyncPresentation',
    'CommitPresentedFrameToCA',
    'requestAnimationFrame',
  ])('does not accept %s as target presentation evidence', (name) => {
    const sample = input();
    sample.trace.traceEvents = sample.trace.traceEvents.slice(0, 6);
    sample.trace.traceEvents.push({
      name,
      ph: 'R',
      ts: 1_010_000,
      pid,
      tid,
      args: { environment: 'browser' },
    });
    expect(assess(sample)).toMatchObject({
      presentationVerdict: 'INCOMPLETE',
      pipelineVerdict: 'INCOMPLETE',
      records: [],
    });
  });

  it.each([
    [
      'missing end',
      (sample) => {
        sample.trace.traceEvents.splice(7, 1);
      },
    ],
    [
      'duplicate begin',
      (sample) => {
        sample.trace.traceEvents.push(
          structuredClone(sample.trace.traceEvents[6])
        );
      },
    ],
    [
      'backward end',
      (sample) => {
        sample.trace.traceEvents[7].ts = 1_000_000;
      },
    ],
    [
      'numeric track ID',
      (sample) => {
        sample.trace.traceEvents[6].id2.local = 123;
      },
    ],
    [
      'unknown state',
      (sample) => {
        sample.trace.traceEvents[6].args.chrome_frame_reporter.state =
          'NEW_STATE';
      },
    ],
    [
      'unsafe source ID',
      (sample) => {
        sample.trace.traceEvents[6].args.chrome_frame_reporter.frame_source =
          Number.MAX_SAFE_INTEGER + 1;
      },
    ],
    [
      'unsafe sequence',
      (sample) => {
        sample.trace.traceEvents[6].args.chrome_frame_reporter.frame_sequence =
          Number.MAX_SAFE_INTEGER + 1;
      },
    ],
    [
      'missing flag',
      (sample) => {
        delete sample.trace.traceEvents[6].args.chrome_frame_reporter
          .affects_smoothness;
      },
    ],
    [
      'impossible smoothness state',
      (sample) => {
        sample.trace.traceEvents[6].args.chrome_frame_reporter.affects_smoothness = true;
      },
    ],
  ])('rejects %s rather than repairing the evidence', (_name, mutate) => {
    const sample = input();
    mutate(sample);
    expect(assess(sample)).toMatchObject({
      pipelineVerdict: 'INCOMPLETE',
      records: [],
    });
  });

  it('retains forked reporters and safely correlates feedback without rounded surface IDs', () => {
    const sample = input(
      reporter('STATE_PRESENTED_PARTIAL', {
        frame_type: 'FORKED',
        surface_frame_trace_id: -7738885594902590000,
      })
    );
    sample.trace.traceEvents.push(
      ...pair(
        reporter('STATE_PRESENTED_ALL', {
          frame_type: 'BACKFILL',
          surface_frame_trace_id: -7738885594902590000,
        }),
        '0x456'
      )
    );
    expect(assess(sample)).toMatchObject({
      pipelineVerdict: 'NO_FAILURE_OBSERVED',
      counts: { records: 2 },
      feedbackEstimates: [{ pipelineBeginEventIndexes: [6, 9] }],
    });
  });

  it('does not correlate zero or unsafe feedback identifiers', () => {
    for (const sequence of [0, Number.MAX_SAFE_INTEGER + 1]) {
      const sample = input();
      sample.trace.traceEvents[8].args.begin_frame_id.sequence_number =
        sequence;
      expect(assess(sample).feedbackEstimates).toEqual([]);
      expect(codes(assess(sample))).toContain('unattributed-feedback');
    }
  });

  it('does not correlate feedback using its reused local track or colliding surface identifier', () => {
    const sample = input();
    sample.trace.traceEvents[8].args.begin_frame_id.sequence_number = 260;
    sample.trace.traceEvents[8].args.surface_frame_trace_id =
      -7738885594902590000;
    expect(assess(sample).feedbackEstimates).toEqual([]);
  });

  it('exposes a frame that terminates beyond the observation boundary as incomplete', () => {
    const sample = input();
    sample.trace.traceEvents[7].ts = 3_000_001;
    expect(codes(assess(sample))).toContain('frame-extends-observation');
    expect(assess(sample).pipelineVerdict).toBe('INCOMPLETE');
  });

  it('does not ignore a renderer orphan end while accepting another complete frame', () => {
    const sample = input();
    sample.trace.traceEvents.push(pair(reporter(), '0x999')[1]);
    expect(codes(assess(sample))).toContain('unpaired-pipeline-record');
    expect(assess(sample).pipelineVerdict).toBe('INCOMPLETE');
  });

  it('preserves capture finalization errors and valid failure evidence independently', () => {
    const sample = input(
      reporter('STATE_DROPPED', { affects_smoothness: true })
    );
    sample.receipt.captureErrors = ['final frame unavailable'];
    expect(assess(sample).verdict).toBe('FAIL');
    expect(codes(assess(sample))).toContain('capture-error');
  });

  it('never invents coverage from an empty trace', () => {
    expect(
      assessChromiumPresentationEvidence({ traceEvents: [] }, {})
    ).toMatchObject({
      verdict: 'INCOMPLETE',
      presentationVerdict: 'INCOMPLETE',
      attribution: null,
    });
  });

  it('fails closed for malformed category metadata instead of throwing', () => {
    const sample = input();
    sample.trace.traceEvents[3].cat = 123;
    expect(assess(sample).pipelineVerdict).toBe('INCOMPLETE');
    sample.receipt.version.userAgent = 123;
    expect(codes(assess(sample))).toContain('unsupported-source');
  });
});
