import { describe, expect, it } from 'vitest';
import {
  assessAnchorTrace,
  assessPresentationTrace,
  assessScrollTrace,
  assessScrollPreconditions,
  hasThinkingMotionOverlap,
  chooseReadingAnchor,
  type PresentedFrame,
  type ScrollSnapshot,
  type ScrollTraceExpectations,
} from './scrollStabilityTrace';

const sample = (rows: ScrollSnapshot['rows']): ScrollSnapshot => ({
  time: 0,
  scroll: 100,
  contentLength: 2000,
  viewportHeight: 600,
  viewportTop: 100,
  viewportBottom: 600,
  keyboardHeight: 0,
  nearEnd: false,
  rows,
});
describe('scroll stability evidence', () => {
  it('detects a transient jump even when the anchor returns', () => {
    const result = assessAnchorTrace(
      [0, 80, 0].map((delta) =>
        sample([{ key: 'a', y: 200 + delta, height: 50 }])
      ),
      'a',
      200
    );
    expect(result.maxDriftPt).toBe(80);
    expect(result.finalDriftPt).toBe(0);
  });
  it('does not treat an unmounted anchor as a pass', () => {
    expect(assessAnchorTrace([sample([])], 'a', 200)).toMatchObject({
      anchorMissingAtEnd: true,
      finalDriftPt: null,
      missingSamples: 1,
    });
  });
  it('selects a visible central anchor, excluding rows behind the composer', () => {
    expect(
      chooseReadingAnchor(
        sample([
          { key: 'hidden', y: 650, height: 50 },
          { key: 'top', y: 110, height: 50 },
          { key: 'center', y: 330, height: 50 },
        ])
      )?.key
    ).toBe('center');
  });
});

// These are adversarial detector controls, not mounted-scroller or device proof.
const measured = (
  time: number,
  changes: Partial<ScrollSnapshot> = {}
): ScrollSnapshot => ({
  ...sample([{ key: 'a', y: 200, height: 50 }]),
  time,
  measurement: { valid: true, durationMs: 2 },
  scrollBounds: { min: 0, max: 1400 },
  ...changes,
});

const trace = () => [0, 100, 200, 300, 400, 500].map((time) => measured(time));
const contract = (
  changes: Partial<ScrollTraceExpectations> = {}
): ScrollTraceExpectations => ({
  action: { name: 'resize', startedAt: 0, completedAt: 200, observed: true },
  coverage: { startTime: 0, endTime: 500 },
  anchor: { key: 'a', baselineY: 200 },
  ...changes,
});
const codes = (result: { issues: { code: string }[] }) =>
  result.issues.map((issue) => issue.code);

describe('sampled geometry contracts', () => {
  it('passes measured stable geometry but explicitly withholds native frame proof', () => {
    expect(assessScrollTrace(trace(), contract())).toMatchObject({
      passed: true,
      verdict: 'PASS',
      evidenceLevel: 'sampled-geometry',
      nativeFrames: 'INCOMPLETE',
      metrics: { maxAnchorDriftPt: 0, maxSampleGapMs: 100 },
    });
  });

  it('rejects a one-sample jump even when every final condition recovers', () => {
    const samples = trace();
    samples[2].rows[0].y += 80;
    const result = assessScrollTrace(samples, contract());
    expect(result.verdict).toBe('FAIL');
    expect(result.metrics.maxAnchorDriftPt).toBe(80);
    expect(result.anchor?.finalDriftPt).toBe(0);
    expect(codes(result)).toContain('anchor-drift');
  });

  it('rejects a temporarily missing anchor even with other visible content', () => {
    const samples = trace();
    samples[2].rows = [{ key: 'replacement', y: 200, height: 50 }];
    const result = assessScrollTrace(samples, contract());
    expect(result.verdict).toBe('FAIL');
    expect(result.anchor).toMatchObject({
      maxDriftPt: 0,
      anchorMissingAtEnd: false,
      anchorMissingAtAnyPoint: true,
      complete: false,
    });
    expect(codes(result)).toContain('anchor-missing');
  });

  it('does not accept an offscreen anchor just because its mounted position is stable', () => {
    const samples = trace().map((s) => ({
      ...s,
      rows: [...s.rows, { key: 'hidden', y: 700, height: 50 }],
    }));
    const result = assessScrollTrace(
      samples,
      contract({
        anchor: { key: 'hidden', baselineY: 700 },
      })
    );
    expect(codes(result)).toContain('anchor-not-visible');
    expect(result.passed).toBe(false);
  });

  it('selects a tall intersecting row whose origin is above the viewport', () => {
    const snapshot = measured(0, {
      rows: [
        { key: 'tall', y: -200, height: 1000 },
        { key: 'covered', y: 650, height: 50 },
      ],
    });
    expect(chooseReadingAnchor(snapshot)?.key).toBe('tall');
  });

  it('uses an explicitly moving viewport reference without redefining the baseline', () => {
    const samples = trace().map((s, index) => ({
      ...s,
      viewportTop: s.viewportTop + index * 5,
      viewportBottom: s.viewportBottom + index * 5,
      rows: [{ key: 'a', y: 200 + index * 5, height: 50 }],
    }));
    expect(assessScrollTrace(samples, contract()).verdict).toBe('FAIL');
    expect(
      assessScrollTrace(
        samples,
        contract({
          anchor: { key: 'a', baselineY: 200, reference: 'viewport-top' },
        })
      ).verdict
    ).toBe('PASS');
    samples[3].rows[0].y += 10;
    expect(
      assessScrollTrace(
        samples,
        contract({
          anchor: { key: 'a', baselineY: 200, reference: 'viewport-top' },
        })
      ).verdict
    ).toBe('FAIL');
  });

  it('checks the specified rounding tolerance without rounding away excursions', () => {
    const samples = trace();
    samples[3].rows[0].y += 1;
    expect(assessScrollTrace(samples, contract()).verdict).toBe('PASS');
    samples[3].rows[0].y += 0.001;
    expect(assessScrollTrace(samples, contract()).verdict).toBe('FAIL');
  });

  it('rejects even a transient blank viewport', () => {
    const samples = trace();
    samples[3].rows = [{ key: 'a', y: 700, height: 50 }];
    const result = assessScrollTrace(samples, contract({ anchor: undefined }));
    expect(result.metrics.blankSamples).toBe(1);
    expect(codes(result)).toContain('blank-viewport');
    expect(result.passed).toBe(false);
  });

  it('allows a declared empty-state contract, but does not choose one implicitly', () => {
    const samples = trace().map((s) => ({ ...s, contentLength: 0, rows: [] }));
    expect(
      assessScrollTrace(samples, contract({ anchor: undefined })).passed
    ).toBe(false);
    expect(
      assessScrollTrace(
        samples,
        contract({
          anchor: undefined,
          requireVisibleContent: false,
        })
      ).passed
    ).toBe(true);
  });
});

describe('trace evidence completeness', () => {
  it.each([
    ['empty capture', () => [], 'insufficient-samples'],
    ['single final screenshot', () => [measured(500)], 'insufficient-samples'],
    ['missing baseline', () => trace().slice(1), 'missing-start'],
    ['missing observation tail', () => trace().slice(0, -1), 'missing-tail'],
    [
      'dropped middle samples',
      () => trace().filter((_, i) => i !== 2),
      'sample-gap',
    ],
    [
      'out-of-order timestamps',
      () => trace().map((s, i) => (i === 2 ? { ...s, time: 50 } : s)),
      'nonmonotonic-time',
    ],
    [
      'duplicate timestamps',
      () => trace().map((s, i) => (i === 2 ? { ...s, time: 100 } : s)),
      'nonmonotonic-time',
    ],
    [
      'nonfinite timestamp',
      () => trace().map((s, i) => (i === 2 ? { ...s, time: NaN } : s)),
      'invalid-geometry',
    ],
    [
      'missing native measurement',
      () => trace().map((s) => ({ ...s, measurement: undefined })),
      'missing-measurement-status',
    ],
    [
      'timed-out native measurement',
      () =>
        trace().map((s) => ({
          ...s,
          measurement: { valid: false, durationMs: 2 },
        })),
      'invalid-measurement',
    ],
    [
      'incoherent acquisition',
      () =>
        trace().map((s) => ({
          ...s,
          measurement: { valid: true, durationMs: 250 },
        })),
      'invalid-measurement',
    ],
    [
      'NaN acquisition duration',
      () =>
        trace().map((s) => ({
          ...s,
          measurement: { valid: true, durationMs: NaN },
        })),
      'invalid-measurement',
    ],
    [
      'zero viewport',
      () => trace().map((s) => ({ ...s, viewportHeight: 0 })),
      'invalid-geometry',
    ],
    [
      'occlusion above viewport',
      () => trace().map((s) => ({ ...s, viewportBottom: 50 })),
      'invalid-geometry',
    ],
    [
      'duplicate row key',
      () => trace().map((s) => ({ ...s, rows: [...s.rows, ...s.rows] })),
      'invalid-geometry',
    ],
    [
      'nonfinite row height',
      () =>
        trace().map((s) => ({
          ...s,
          rows: [{ key: 'a', y: 200, height: Infinity }],
        })),
      'invalid-geometry',
    ],
  ] as const)('cannot pass %s', (_name, createSamples, expectedCode) => {
    const result = assessScrollTrace(createSamples(), contract());
    expect(result.passed).toBe(false);
    expect(codes(result)).toContain(expectedCode);
  });

  it('rejects an unobserved action even when the geometry is perfect', () => {
    const result = assessScrollTrace(
      trace(),
      contract({
        action: {
          name: 'image-load',
          startedAt: 0,
          completedAt: 200,
          observed: false,
        },
      })
    );
    expect(result.verdict).toBe('INCOMPLETE');
    expect(codes(result)).toContain('action-not-observed');
  });

  it('reports unusable measurements as incomplete rather than claiming a measured jump', () => {
    const samples = trace();
    samples[2].measurement = { valid: false, durationMs: 250 };
    samples[2].rows = [];
    const result = assessScrollTrace(samples, contract());
    expect(result.verdict).toBe('INCOMPLETE');
    expect(codes(result)).not.toContain('blank-viewport');
    expect(codes(result)).not.toContain('anchor-missing');
  });

  it('cannot hide a late action by ending the capture before it completes', () => {
    const result = assessScrollTrace(
      trace(),
      contract({
        action: {
          name: 'image-load',
          startedAt: 0,
          completedAt: 600,
          observed: true,
        },
      })
    );
    expect(codes(result)).toContain('invalid-action-window');
    expect(result.passed).toBe(false);
  });

  it('rejects NaN/infinite tolerances and invalid capture budgets', () => {
    expect(
      assessScrollTrace(
        trace(),
        contract({
          anchor: { key: 'a', baselineY: 200, tolerancePt: NaN },
        })
      ).passed
    ).toBe(false);
    expect(
      assessScrollTrace(
        trace(),
        contract({
          coverage: { startTime: 0, endTime: 500, maxGapMs: Infinity },
        })
      ).passed
    ).toBe(false);
    expect(
      assessScrollTrace(
        trace(),
        contract({
          coverage: { startTime: 500, endTime: 0 },
        })
      ).passed
    ).toBe(false);
  });
});

describe('bottom and target landing contracts', () => {
  const atEnd = () =>
    trace().map((s) => ({
      ...s,
      scroll: 1400,
      rows: [{ key: 'tail', y: 550, height: 50 }],
    }));
  const endContract = () =>
    contract({ anchor: undefined, bottom: { tailKey: 'tail' } });

  it('checks the actual legal offset and visible newest identity', () => {
    expect(assessScrollTrace(atEnd(), endContract()).passed).toBe(true);
    const samples = atEnd();
    samples[2].scroll -= 30;
    samples[2].nearEnd = true;
    const result = assessScrollTrace(samples, endContract());
    expect(result.verdict).toBe('FAIL');
    expect(codes(result)).toContain('bottom-distance');
    expect(result.metrics.maxBottomDistancePt).toBe(30);
  });

  it('rejects overscroll as well as stopping short', () => {
    const samples = atEnd();
    samples[2].scroll += 30;
    expect(assessScrollTrace(samples, endContract()).passed).toBe(false);
  });

  it('rejects logical bottom when newest content is under the composer', () => {
    const samples = atEnd();
    samples[3].rows[0].y += 20;
    const result = assessScrollTrace(samples, endContract());
    expect(result.metrics.maxBottomDistancePt).toBe(0);
    expect(codes(result)).toContain('tail-not-visible');
    expect(result.passed).toBe(false);
  });

  it('does not infer insets/legal range or newest identity from nearEnd', () => {
    expect(
      codes(
        assessScrollTrace(
          atEnd().map((s) => ({ ...s, scrollBounds: undefined })),
          endContract()
        )
      )
    ).toContain('missing-scroll-bounds');
    expect(
      codes(
        assessScrollTrace(atEnd(), contract({ anchor: undefined, bottom: {} }))
      )
    ).toContain('missing-tail-identity');
  });

  it('accepts a short list at its legal end without inventing negative distance', () => {
    const samples = atEnd().map((s) => ({
      ...s,
      scroll: 0,
      contentLength: 100,
      scrollBounds: { min: 0, max: 0 },
    }));
    expect(assessScrollTrace(samples, endContract()).passed).toBe(true);
  });

  const landed = () =>
    trace().map((s) => ({
      ...s,
      rows: [{ key: 'target', y: 300, height: 100 }],
    }));
  const targetContract = () =>
    contract({
      anchor: undefined,
      landing: { key: 'target', alignment: 'center', settleStartTime: 200 },
    });

  it('rejects the wrong but visible target', () => {
    const samples = landed().map((s) => ({
      ...s,
      rows: [{ key: 'wrong', y: 300, height: 100 }],
    }));
    expect(codes(assessScrollTrace(samples, targetContract()))).toContain(
      'target-missing'
    );
  });

  it('rejects intermediate wrong landings even if the last frame is perfect', () => {
    const samples = landed();
    samples[3].rows[0].y += 15;
    const result = assessScrollTrace(samples, targetContract());
    expect(result.verdict).toBe('FAIL');
    expect(result.metrics.maxLandingErrorPt).toBe(15);
  });

  it('checks declared top/center/bottom alignments independently', () => {
    for (const [alignment, y] of [
      ['top', 100],
      ['center', 300],
      ['bottom', 500],
    ] as const) {
      const samples = landed().map((s) => ({
        ...s,
        rows: [{ key: 'target', y, height: 100 }],
      }));
      expect(
        assessScrollTrace(
          samples,
          contract({
            anchor: undefined,
            landing: { key: 'target', alignment, settleStartTime: 200 },
          })
        ).passed
      ).toBe(true);
    }
  });

  it('accepts the closest legal landing but rejects a bogus clamp', () => {
    const samples = landed().map((s) => ({
      ...s,
      scroll: 0,
      rows: [{ key: 'target', y: 100, height: 50 }],
    }));
    expect(assessScrollTrace(samples, targetContract()).passed).toBe(true);
    samples[3].scroll = 20;
    expect(assessScrollTrace(samples, targetContract()).passed).toBe(false);
  });

  it('supports oversized visibility without requiring the impossible full row', () => {
    const samples = landed().map((s) => ({
      ...s,
      rows: [{ key: 'target', y: 0, height: 1000 }],
    }));
    const options = contract({
      anchor: undefined,
      landing: { key: 'target', alignment: 'visible', settleStartTime: 200 },
    });
    expect(assessScrollTrace(samples, options).passed).toBe(true);
    samples[3].rows[0].y = 200;
    expect(assessScrollTrace(samples, options).passed).toBe(false);
  });

  it('rejects a final-frame-only settlement and settlement before action completion', () => {
    for (const settleStartTime of [500, 0, NaN]) {
      const result = assessScrollTrace(
        landed(),
        contract({
          anchor: undefined,
          landing: { key: 'target', alignment: 'center', settleStartTime },
        })
      );
      expect(result.passed).toBe(false);
      expect(codes(result)).toContain('invalid-settling-window');
    }
  });
});

describe('presentation evidence controls', () => {
  const frames = (): PresentedFrame[] => [
    { sequence: 0, startedAt: 0, deadline: 16, presentedAt: 15 },
    { sequence: 1, startedAt: 16, deadline: 24, presentedAt: 23 },
    { sequence: 2, startedAt: 24, deadline: 32, presentedAt: 31 },
  ];
  const options = {
    source: 'native-presentation',
    startTime: 0,
    endTime: 32,
  } as const;

  it('uses each actual presentation deadline across a refresh-rate change', () => {
    expect(assessPresentationTrace(frames(), options)).toMatchObject({
      passed: true,
      missedDeadlines: 0,
    });
  });

  it('detects a renderer stall despite a healthy callback cadence', () => {
    const samples = frames();
    samples[1].presentedAt = 27;
    expect(assessPresentationTrace(samples, options)).toMatchObject({
      verdict: 'FAIL',
      missedDeadlines: 1,
      maxDeadlineOverrunMs: 3,
    });
  });

  it.each(['js-raf', 'native-vsync'] as const)(
    'never treats %s as app presentation proof',
    (source) => {
      expect(
        assessPresentationTrace(frames(), { ...options, source }).verdict
      ).toBe('INCOMPLETE');
    }
  );

  it('rejects dropped frame records and missing observation tails', () => {
    const skipped = frames();
    skipped[1].sequence = 8;
    expect(codes(assessPresentationTrace(skipped, options))).toContain(
      'missing-frame-evidence'
    );
    expect(assessPresentationTrace(frames().slice(0, 2), options).passed).toBe(
      false
    );
  });

  it('rejects invalid presentation times and a missing first frame', () => {
    const invalid = frames();
    invalid[1].presentedAt = NaN;
    expect(codes(assessPresentationTrace(invalid, options))).toContain(
      'invalid-frame'
    );
    expect(assessPresentationTrace(frames().slice(1), options).passed).toBe(
      false
    );
  });
});

describe('scenario baseline preconditions', () => {
  const options = {
    requireHistory: true,
    requireInitialEnd: false,
    requireReadingAnchor: true,
    readingAnchorKey: 'a',
    excludedAnchorKeys: [],
    allowEmptyEnd: false,
  };
  it('establishes measured deep-history reading before a mutation', () => {
    expect(assessScrollPreconditions(measured(0), options).established).toBe(
      true
    );
  });
  it('does not interpret a blank baseline as a later scroll regression', () => {
    const result = assessScrollPreconditions(
      measured(0, { rows: [] }),
      options
    );
    expect(result.established).toBe(false);
    expect(codes(result)).toContain(
      'reading-anchor-precondition-not-established'
    );
    expect(result.issues.every((issue) => issue.kind === 'incomplete')).toBe(
      true
    );
  });
  it('requires an independent reading row when the only visible row is the changing image', () => {
    expect(
      assessScrollPreconditions(measured(0), {
        ...options,
        excludedAnchorKeys: ['a'],
      }).established
    ).toBe(false);
  });
  it('rejects a history setup inside the FOLLOW threshold and missing native bounds', () => {
    expect(
      assessScrollPreconditions(measured(0, { scroll: 1000 }), options)
        .established
    ).toBe(false);
    expect(
      assessScrollPreconditions(
        measured(0, { scrollBounds: undefined }),
        options
      ).established
    ).toBe(false);
  });
  it('rejects baseline sampling failure, duplicate row identity and offscreen anchor', () => {
    expect(
      assessScrollPreconditions(
        measured(0, { measurement: { valid: false, durationMs: 2 } }),
        options
      ).established
    ).toBe(false);
    expect(
      assessScrollPreconditions(
        measured(0, {
          rows: [
            { key: 'a', y: 200, height: 50 },
            { key: 'a', y: 300, height: 50 },
          ],
        }),
        options
      ).established
    ).toBe(false);
    expect(
      assessScrollPreconditions(
        measured(0, { rows: [{ key: 'a', y: 650, height: 50 }] }),
        options
      ).established
    ).toBe(false);
  });
  const endOptions = {
    ...options,
    requireHistory: false,
    requireReadingAnchor: false,
    requireInitialEnd: true,
    initialTailKey: 'a',
  };
  it('requires both initial legal-end offset and newest trailing-edge visibility', () => {
    expect(
      assessScrollPreconditions(measured(0, { scroll: 1400 }), endOptions)
        .established
    ).toBe(true);
    expect(
      assessScrollPreconditions(measured(0, { scroll: 1099 }), endOptions)
        .established
    ).toBe(false);
    expect(
      assessScrollPreconditions(
        measured(0, { scroll: 1400, rows: [{ key: 'a', y: 580, height: 50 }] }),
        endOptions
      ).established
    ).toBe(false);
  });
  it('requires explicit coherent empty-list scope; absence of telemetry cannot establish empty FOLLOW', () => {
    const empty = {
      ...endOptions,
      initialTailKey: undefined,
      allowEmptyEnd: true,
    };
    expect(
      assessScrollPreconditions(measured(0, { scroll: 1400, rows: [] }), empty)
        .established
    ).toBe(true);
    expect(
      assessScrollPreconditions(
        measured(0, { scroll: 1400, rows: [], scrollBounds: undefined }),
        empty
      ).established
    ).toBe(false);
    expect(
      assessScrollPreconditions(measured(0, { scroll: 1400, rows: [] }), {
        ...empty,
        allowEmptyEnd: false,
      }).established
    ).toBe(false);
  });
});

describe('thinking and real interaction overlap detector', () => {
  const event = (time: number, name: string) => ({
    time,
    name,
    values: name === 'thinking-layout' ? { height: 52 } : undefined,
  });
  it.each([
    ['keyboard', 'keyboardWillShow', 'keyboardDidShow'],
    ['gesture', 'drag-begin', 'drag-end'],
  ] as const)(
    'rejects thinking in a settled gap between two %s interactions',
    (kind, start, end) => {
      const events = [
        event(0, start),
        event(50, end),
        event(70, 'thinking-layout'),
        event(100, start),
        event(150, end),
      ];
      expect(hasThinkingMotionOverlap(events, kind)).toBe(false);
      events[2].time = 120;
      events.sort((a, b) => a.time - b.time);
      expect(hasThinkingMotionOverlap(events, kind)).toBe(true);
    }
  );
  it('discards layout evidence from a cancelled keyboard transition', () => {
    expect(
      hasThinkingMotionOverlap(
        [
          event(0, 'keyboardWillShow'),
          event(20, 'thinking-layout'),
          event(30, 'keyboardWillHide'),
          event(40, 'keyboardDidShow'),
          event(60, 'keyboardDidHide'),
        ],
        'keyboard'
      )
    ).toBe(false);
  });
  it('requires a real completed interval and an actual 52/0 thinking layout', () => {
    expect(
      hasThinkingMotionOverlap(
        [event(0, 'drag-begin'), event(20, 'thinking-layout')],
        'gesture'
      )
    ).toBe(false);
    expect(
      hasThinkingMotionOverlap(
        [
          event(0, 'drag-begin'),
          { time: 20, name: 'thinking-layout', values: { height: 99 } },
          event(50, 'drag-end'),
        ],
        'gesture'
      )
    ).toBe(false);
  });
});
