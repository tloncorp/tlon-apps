export type MeasuredRow = { key: string; y: number; height: number };
export type ScrollSnapshot = {
  time: number;
  scroll: number;
  contentLength: number;
  viewportHeight: number;
  viewportTop: number;
  viewportBottom: number;
  keyboardHeight: number;
  nearEnd: boolean;
  rows: MeasuredRow[];
  /** Actual legal offsets, including the platform's applied insets. */
  scrollBounds?: { min: number; max: number };
  /** False when any required measurement fell back, failed or timed out. */
  measurement?: { valid: boolean; durationMs: number };
  /** Acquisition diagnostics; JS receipt time is not a native frame timestamp. */
  acquisition?: {
    registeredRowCount: number;
    selectedRowCount: number;
    measuredRowCount: number;
    visibleMeasuredRowCount: number;
    nativeMetricsReceivedAt: number | null;
    nativeMetricsAgeMs: number | null;
    /** Diagnostic breakdown only; it never replaces native geometry validation. */
    jsCoherence?: {
      listPresent: boolean;
      listIdentityStable: boolean;
      composerIdentityStable: boolean;
      requiredRowsStable: boolean;
      membershipStable: boolean;
      scopeStable: boolean;
      semanticStable: boolean;
      coherent: boolean;
      before: {
        scope: string;
        keys: string[] | null;
        semanticCommit:
          | import('./scrollStabilityMutation').RowMutationState
          | null;
      };
      after: {
        scope: string;
        keys: string[] | null;
        semanticCommit:
          | import('./scrollStabilityMutation').RowMutationState
          | null;
      };
      changedRequiredRows: string[];
      semanticTarget: { key: string; scope: string } | null;
    };
    nativeGeometry?: {
      request: import('./scrollNativeGeometry').NativeGeometryRequest;
      capture: unknown;
      issues: string[];
      nativePresentation: 'INCOMPLETE';
      ruler?: import('./scrollNativeGeometry').NativeSampledRulerObservation;
    } & (
      | {
          source: 'ios-main-thread-model-v1';
          bracket: import('./scrollNativeGeometry').NativeGeometryBracket;
        }
      | {
          source: 'ios-buffered-main-thread-model-v1';
          bracket?: never;
        }
    );
  };
};

const finite = Number.isFinite;
const validRow = (row: MeasuredRow) =>
  typeof row.key === 'string' &&
  row.key.length > 0 &&
  finite(row.y) &&
  finite(row.height) &&
  row.height > 0;
const visibleHeight = (sample: ScrollSnapshot, row: MeasuredRow) =>
  Math.max(
    0,
    Math.min(row.y + row.height, sample.viewportBottom) -
      Math.max(row.y, sample.viewportTop)
  );

const rowObscured = (sample: ScrollSnapshot, key: string) => {
  const ruler = sample.acquisition?.nativeGeometry?.ruler;
  return (
    ruler?.version === 'indexed-cell-and-surfaces-v2' &&
    ruler.obscuredKeys.includes(key)
  );
};

/** One measured landing, shared by first-reveal and settled-trace checks. */
export function assessClampedScrollLanding(
  sample: ScrollSnapshot,
  row: MeasuredRow,
  alignment: 'top' | 'center' | 'bottom',
  offsetPt = 0,
  tolerancePt = 1
) {
  const bounds = sample.scrollBounds;
  if (
    !bounds ||
    !validRow(row) ||
    ![
      sample.scroll,
      sample.viewportTop,
      sample.viewportBottom,
      bounds.min,
      bounds.max,
      offsetPt,
      tolerancePt,
    ].every(finite) ||
    bounds.min > bounds.max ||
    sample.viewportBottom <= sample.viewportTop ||
    tolerancePt < 0
  )
    return undefined;
  const fraction = alignment === 'top' ? 0 : alignment === 'bottom' ? 1 : 0.5;
  const targetPoint = row.y + row.height * fraction;
  const desiredPoint =
    sample.viewportTop +
    (sample.viewportBottom - sample.viewportTop) * fraction +
    offsetPt;
  const idealOffset = sample.scroll + targetPoint - desiredPoint;
  const reachableOffset = Math.min(
    bounds.max,
    Math.max(bounds.min, idealOffset)
  );
  return {
    errorPt: Math.abs(sample.scroll - reachableOffset),
    reachableOffset,
    targetPoint,
    exposed:
      targetPoint >= sample.viewportTop - tolerancePt &&
      targetPoint <= sample.viewportBottom + tolerancePt &&
      visibleHeight(sample, row) > 0,
  };
}

export function chooseReadingAnchor(snapshot: ScrollSnapshot) {
  const center = (snapshot.viewportTop + snapshot.viewportBottom) / 2;
  return snapshot.rows
    .filter((row) => validRow(row) && visibleHeight(snapshot, row) > 0)
    .sort((a, b) => {
      // Include a tall row crossing the entire viewport. Its top can be above
      // the viewport, so comparing only row origins would lose every anchor.
      const distance = (row: MeasuredRow) =>
        Math.abs(
          (Math.max(row.y, snapshot.viewportTop) +
            Math.min(row.y + row.height, snapshot.viewportBottom)) /
            2 -
            center
        );
      return distance(a) - distance(b);
    })[0];
}

/** Native row coordinates, not estimated list offsets, decide anchor drift. */
export function assessAnchorTrace(
  samples: ScrollSnapshot[],
  key: string,
  baselineY: number
) {
  const positions = samples.flatMap((sample) => {
    const matches = sample.rows.filter((item) => item.key === key);
    const row =
      matches.length === 1 && validRow(matches[0]) ? matches[0] : null;
    return row
      ? [{ time: sample.time, y: row.y, delta: row.y - baselineY }]
      : [];
  });
  const finalMatches = samples.at(-1)?.rows.filter((row) => row.key === key);
  const finalRow =
    finalMatches?.length === 1 && validRow(finalMatches[0])
      ? finalMatches[0]
      : null;
  return {
    anchorKey: key,
    baselineY,
    measuredSamples: positions.length,
    missingSamples: samples.length - positions.length,
    maxDriftPt: Math.max(0, ...positions.map((row) => Math.abs(row.delta))),
    finalDriftPt: finalRow ? finalRow.y - baselineY : null,
    // Losing the anchor cannot silently turn into a zero-drift pass.
    anchorMissingAtEnd: !finalRow,
    anchorMissingAtAnyPoint:
      samples.length === 0 || positions.length !== samples.length,
    complete:
      samples.length > 0 &&
      positions.length === samples.length &&
      finite(baselineY),
  };
}

export type TraceIssue = {
  code: string;
  kind: 'failure' | 'incomplete';
  message: string;
  sampleIndex?: number;
};

export type TraceVerdict = 'PASS' | 'FAIL' | 'INCOMPLETE';

export function hasThinkingMotionOverlap(
  events: readonly {
    time: number;
    name: string;
    values?: Record<string, number | string | boolean>;
  }[],
  interaction: 'keyboard' | 'gesture'
) {
  if (
    events.some(
      (event, index) =>
        !finite(event.time) ||
        (index > 0 && event.time < events[index - 1].time)
    )
  )
    return false;
  let start: { time: number; completion: string } | undefined;
  let layoutTime: number | undefined;
  for (const event of events) {
    const completion =
      interaction === 'keyboard'
        ? event.name === 'keyboardWillShow'
          ? 'keyboardDidShow'
          : event.name === 'keyboardWillHide'
            ? 'keyboardDidHide'
            : undefined
        : event.name === 'drag-begin'
          ? 'drag-end'
          : undefined;
    if (completion) {
      // A new transition cancels the previous interval and its evidence.
      start = { time: event.time, completion };
      layoutTime = undefined;
    }
    if (
      start &&
      event.name === 'thinking-layout' &&
      (event.values?.height === 0 || event.values?.height === 52)
    )
      layoutTime = event.time;
    if (start && event.name === start.completion) {
      if (
        layoutTime !== undefined &&
        layoutTime >= start.time &&
        layoutTime <= event.time
      )
        return true;
      start = undefined;
      layoutTime = undefined;
    }
  }
  return false;
}

export type ScrollPreconditions = {
  requireHistory: boolean;
  requireInitialEnd: boolean;
  requireReadingAnchor: boolean;
  readingAnchorKey?: string;
  excludedAnchorKeys: string[];
  initialTailKey?: string;
  allowEmptyEnd: boolean;
};

/** Setup failures qualify raw residuals as diagnostic, never product failures. */
export function assessScrollPreconditions(
  baseline: ScrollSnapshot,
  options: ScrollPreconditions
) {
  const issues: TraceIssue[] = [];
  const add = (code: string, message: string) =>
    issues.push({ code, kind: 'incomplete', message });
  const valid =
    baseline.measurement?.valid === true &&
    finite(baseline.measurement.durationMs) &&
    baseline.measurement.durationMs <= 32 &&
    baseline.measurement.durationMs >= 0 &&
    [
      baseline.time,
      baseline.scroll,
      baseline.viewportTop,
      baseline.viewportBottom,
      baseline.viewportHeight,
    ].every(finite) &&
    baseline.viewportHeight > 0 &&
    baseline.viewportBottom > baseline.viewportTop &&
    baseline.rows.every(validRow) &&
    new Set(baseline.rows.map((row) => row.key)).size === baseline.rows.length;
  if (!valid)
    add(
      'baseline-measurement-invalid',
      'The baseline needs coherent measured native geometry.'
    );
  const bounds = baseline.scrollBounds;
  const legal =
    valid &&
    bounds !== undefined &&
    finite(bounds.min) &&
    finite(bounds.max) &&
    bounds.min <= bounds.max &&
    baseline.scroll >= bounds.min - 1 &&
    baseline.scroll <= bounds.max + 1;
  if (
    options.requireHistory &&
    (!legal || bounds!.max - baseline.scroll <= baseline.viewportHeight + 1)
  )
    add(
      'history-precondition-not-established',
      'History must begin more than one viewport + 1 pt from the measured legal end.'
    );
  const anchor = baseline.rows.find(
    (row) => row.key === options.readingAnchorKey
  );
  if (
    options.requireReadingAnchor &&
    (!valid ||
      !anchor ||
      options.excludedAnchorKeys.includes(anchor.key) ||
      visibleHeight(baseline, anchor) <= 0)
  )
    add(
      'reading-anchor-precondition-not-established',
      'A visible, independently measured reading row must exist before the action.'
    );
  if (
    options.requireReadingAnchor &&
    anchor &&
    rowObscured(baseline, anchor.key)
  )
    add(
      'reading-anchor-obscured',
      'A measured native surface intersects the required reading row.'
    );
  const tail = baseline.rows.find((row) => row.key === options.initialTailKey);
  if (options.requireInitialEnd && tail && rowObscured(baseline, tail.key))
    add(
      'initial-tail-obscured',
      'A measured native surface intersects the required newest row.'
    );
  const tailVisible =
    tail &&
    visibleHeight(baseline, tail) > 0 &&
    tail.y + tail.height <= baseline.viewportBottom + 1;
  const emptyEstablished =
    options.allowEmptyEnd &&
    !options.initialTailKey &&
    baseline.rows.length === 0;
  if (
    options.requireInitialEnd &&
    (!legal ||
      Math.abs(bounds!.max - baseline.scroll) > 1 ||
      (!tailVisible && !emptyEstablished))
  )
    add(
      'initial-end-precondition-not-established',
      'FOLLOW must begin within 1 pt of the legal end with the newest trailing edge visible, or a coherently measured empty list.'
    );
  return { established: issues.length === 0, issues };
}

export type ScrollTraceExpectations = {
  /** A dispatched command is insufficient: observed means its effect occurred. */
  action: {
    name: string;
    startedAt: number;
    completedAt: number;
    observed: boolean;
  };
  /** Planned bounds; do not derive endTime from the last received sample. */
  coverage: {
    startTime: number;
    endTime: number;
    maxGapMs?: number;
    minSamples?: number;
    maxMeasurementDurationMs?: number;
  };
  anchor?: {
    key: string;
    baselineY: number;
    reference?: 'window' | 'viewport-top' | 'viewport-bottom';
    tolerancePt?: number;
  };
  bottom?: {
    /** Omit for pinning throughout; set for an explicit settled interval. */
    startTime?: number;
    tolerancePt?: number;
    /** Required to establish newest-content visibility as well as offset. */
    tailKey?: string;
  };
  landing?: {
    key: string;
    alignment: 'visible' | 'top' | 'center' | 'bottom';
    /** Must start after the scenario's expected terminal revision is observed. */
    settleStartTime: number;
    offsetPt?: number;
    tolerancePt?: number;
  };
  requireVisibleContent?: boolean;
  requireMeasurementMetadata?: boolean;
};

function verdictFor(issues: TraceIssue[]): TraceVerdict {
  return issues.some((issue) => issue.kind === 'failure')
    ? 'FAIL'
    : issues.length
      ? 'INCOMPLETE'
      : 'PASS';
}

/**
 * Checks measured samples, not the scroller's own desired offsets. A PASS is
 * limited to these samples and configured contracts. Even perfect JS sampling
 * cannot certify native presentation, paint readiness or between-sample motion.
 */
export function assessScrollTrace(
  samples: ScrollSnapshot[],
  expectations: ScrollTraceExpectations
) {
  const issues: TraceIssue[] = [];
  const add = (
    code: string,
    message: string,
    sampleIndex?: number,
    kind: TraceIssue['kind'] = 'incomplete'
  ) => issues.push({ code, message, sampleIndex, kind });
  const { coverage, action, anchor, bottom, landing } = expectations;
  const maxGapMs = coverage.maxGapMs ?? 125;
  const minSamples = coverage.minSamples ?? 3;
  const maxMeasurementDurationMs = coverage.maxMeasurementDurationMs ?? 32;
  const requireMetadata = expectations.requireMeasurementMetadata ?? true;
  const requireContent = expectations.requireVisibleContent ?? true;
  let maxSampleGapMs = 0;
  let maxAnchorDriftPt = 0;
  let maxBottomDistancePt = 0;
  let maxLandingErrorPt = 0;
  let blankSamples = 0;

  if (
    !finite(coverage.startTime) ||
    !finite(coverage.endTime) ||
    coverage.endTime <= coverage.startTime ||
    !finite(maxGapMs) ||
    maxGapMs <= 0 ||
    !Number.isInteger(minSamples) ||
    minSamples < 3 ||
    !finite(maxMeasurementDurationMs) ||
    maxMeasurementDurationMs < 0
  ) {
    add(
      'invalid-coverage',
      'Coverage needs finite ordered bounds and positive sampling limits.'
    );
  }
  if (
    !action.name ||
    !finite(action.startedAt) ||
    !finite(action.completedAt) ||
    action.completedAt < action.startedAt ||
    action.startedAt < coverage.startTime ||
    action.completedAt > coverage.endTime
  ) {
    add(
      'invalid-action-window',
      'The action must occur inside the planned capture window.'
    );
  }
  if (action.observed !== true) {
    add(
      'action-not-observed',
      'No causal evidence confirms the intended action actually occurred.'
    );
  }
  if (samples.length < minSamples) {
    add(
      'insufficient-samples',
      `Need at least ${minSamples} samples, received ${samples.length}.`
    );
  }
  // Boundary coverage is intentionally strict: accepting a whole sample period
  // at either edge would hide the first jump or a late completion callback.
  if (!samples.length || samples[0].time > coverage.startTime) {
    add('missing-start', 'Capture lacks the planned baseline.');
  }
  if (!samples.length || samples[samples.length - 1].time < coverage.endTime) {
    add('missing-tail', 'Capture ended before the planned observation tail.');
  }
  for (const [name, contract] of [
    ['anchor', anchor],
    ['bottom', bottom],
    ['landing', landing],
  ] as const) {
    if (
      contract &&
      (!finite(contract.tolerancePt ?? 1) || (contract.tolerancePt ?? 1) < 0)
    ) {
      add(
        'invalid-tolerance',
        `${name} tolerance must be finite and nonnegative.`
      );
    }
  }
  if (anchor && (!anchor.key || !finite(anchor.baselineY))) {
    add('invalid-anchor', 'Anchor identity and baseline must be valid.');
  }
  if (bottom && !bottom.tailKey) {
    add(
      'missing-tail-identity',
      'Bottom proof requires the expected newest row identity.'
    );
  }
  if (landing && (!landing.key || !finite(landing.offsetPt ?? 0))) {
    add(
      'invalid-target',
      'Landing requires a target identity and a finite alignment offset.'
    );
  }

  const checkSettling = (startTime: number, name: string) => {
    if (
      !finite(startTime) ||
      startTime < action.completedAt ||
      coverage.endTime - startTime < 200
    ) {
      add(
        'invalid-settling-window',
        `${name} requires at least 200 ms after the action completes.`
      );
    }
    if (
      samples.filter(
        (sample) => sample.time >= startTime && sample.time <= coverage.endTime
      ).length < 3
    ) {
      add(
        'insufficient-settling-samples',
        `${name} requires at least three samples throughout settling.`
      );
    }
  };
  if (landing) checkSettling(landing.settleStartTime, 'Landing');
  if (bottom?.startTime !== undefined)
    checkSettling(bottom.startTime, 'Bottom landing');

  const validSamples = new Set<number>();
  samples.forEach((sample, index) => {
    const numericFields = [
      sample.time,
      sample.scroll,
      sample.contentLength,
      sample.viewportHeight,
      sample.viewportTop,
      sample.viewportBottom,
      sample.keyboardHeight,
    ];
    if (
      !numericFields.every(finite) ||
      sample.contentLength < 0 ||
      sample.viewportHeight <= 0 ||
      sample.viewportBottom <= sample.viewportTop ||
      sample.viewportBottom > sample.viewportTop + sample.viewportHeight + 1 ||
      sample.keyboardHeight < 0 ||
      !sample.rows.every(validRow) ||
      new Set(sample.rows.map((row) => row.key)).size !== sample.rows.length
    ) {
      add(
        'invalid-geometry',
        'Geometry must be finite, positive and have unique row identities.',
        index
      );
    } else {
      validSamples.add(index);
    }
    const previous = samples[index - 1];
    if (previous) {
      const gap = sample.time - previous.time;
      maxSampleGapMs = Math.max(maxSampleGapMs, finite(gap) ? gap : 0);
      if (!(gap > 0))
        add('nonmonotonic-time', 'Sample times must strictly increase.', index);
      if (gap > maxGapMs)
        add(
          'sample-gap',
          `Unobserved interval of ${gap} ms exceeds ${maxGapMs} ms.`,
          index
        );
    }
    if (requireMetadata && !sample.measurement) {
      add(
        'missing-measurement-status',
        'Measurement validity and acquisition duration were not recorded.',
        index
      );
      validSamples.delete(index);
    }
    if (
      sample.measurement &&
      (sample.measurement.valid !== true ||
        !finite(sample.measurement.durationMs) ||
        sample.measurement.durationMs < 0 ||
        sample.measurement.durationMs > maxMeasurementDurationMs)
    ) {
      add(
        'invalid-measurement',
        'Required measurements failed or acquisition exceeded its coherence budget.',
        index
      );
      validSamples.delete(index);
    }
    if (
      sample.scrollBounds &&
      (!finite(sample.scrollBounds.min) ||
        !finite(sample.scrollBounds.max) ||
        sample.scrollBounds.min > sample.scrollBounds.max)
    ) {
      add(
        'invalid-scroll-bounds',
        'Legal scroll bounds must be finite and ordered.',
        index
      );
      validSamples.delete(index);
    }
  });

  const initial = samples[0];
  const anchorReference = (sample: ScrollSnapshot) =>
    anchor?.reference === 'viewport-top'
      ? sample.viewportTop
      : anchor?.reference === 'viewport-bottom'
        ? sample.viewportBottom
        : 0;

  samples.forEach((sample, index) => {
    if (!validSamples.has(index)) return;
    if (
      requireContent &&
      !sample.rows.some((row) => visibleHeight(sample, row) > 0)
    ) {
      blankSamples++;
      add(
        'blank-viewport',
        'No expected row intersects the unobscured viewport.',
        index,
        'failure'
      );
    }
    if (anchor && rowObscured(sample, anchor.key))
      add(
        'anchor-obscured',
        'A measured native surface intersects the required reading row.',
        index,
        'failure'
      );
    if (anchor) {
      const row = sample.rows.find((candidate) => candidate.key === anchor.key);
      if (!row) {
        add(
          'anchor-missing',
          'The required reading anchor disappeared during capture.',
          index,
          'failure'
        );
      } else {
        if (visibleHeight(sample, row) <= 0) {
          add(
            'anchor-not-visible',
            'The reading anchor is mounted but outside the unobscured viewport.',
            index,
            'failure'
          );
        }
        const drift = Math.abs(
          row.y -
            anchorReference(sample) -
            (anchor.baselineY - anchorReference(initial))
        );
        maxAnchorDriftPt = Math.max(maxAnchorDriftPt, drift);
        if (drift > (anchor.tolerancePt ?? 1)) {
          add(
            'anchor-drift',
            `Reading anchor moved unexpectedly by ${drift} pt.`,
            index,
            'failure'
          );
        }
      }
    }
    if (bottom && sample.time >= (bottom.startTime ?? coverage.startTime)) {
      if (!sample.scrollBounds) {
        add(
          'missing-scroll-bounds',
          'Bottom assessment needs actual legal offsets including applied insets.',
          index
        );
      } else {
        const distance = Math.abs(sample.scrollBounds.max - sample.scroll);
        maxBottomDistancePt = Math.max(maxBottomDistancePt, distance);
        if (distance > (bottom.tolerancePt ?? 1)) {
          add(
            'bottom-distance',
            `Distance from legal end is ${distance} pt.`,
            index,
            'failure'
          );
        }
      }
      if (bottom.tailKey && rowObscured(sample, bottom.tailKey))
        add(
          'tail-obscured',
          'A measured native surface intersects the required newest row.',
          index,
          'failure'
        );
      if (bottom.tailKey) {
        const row = sample.rows.find(
          (candidate) => candidate.key === bottom.tailKey
        );
        if (
          !row ||
          visibleHeight(sample, row) <= 0 ||
          row.y + row.height > sample.viewportBottom + (bottom.tolerancePt ?? 1)
        ) {
          add(
            'tail-not-visible',
            'The expected newest row or its trailing edge is missing or occluded.',
            index,
            'failure'
          );
        }
      }
    }
    if (landing && sample.time >= landing.settleStartTime) {
      if (rowObscured(sample, landing.key))
        add(
          'target-obscured',
          'A measured native surface intersects the requested target.',
          index,
          'failure'
        );
      const row = sample.rows.find(
        (candidate) => candidate.key === landing.key
      );
      const tolerance = landing.tolerancePt ?? 1;
      if (!row) {
        add(
          'target-missing',
          'The requested target is absent during settling.',
          index,
          'failure'
        );
      } else if (landing.alignment === 'visible') {
        const deficit =
          Math.min(row.height, sample.viewportBottom - sample.viewportTop) -
          visibleHeight(sample, row);
        maxLandingErrorPt = Math.max(maxLandingErrorPt, deficit);
        if (deficit > tolerance)
          add(
            'target-occluded',
            `Target has ${deficit} pt of avoidable clipping.`,
            index,
            'failure'
          );
      } else if (!sample.scrollBounds) {
        add(
          'missing-scroll-bounds',
          'Aligned landing needs actual legal offsets for independent clamping.',
          index
        );
      } else {
        const checked = assessClampedScrollLanding(
          sample,
          row,
          landing.alignment,
          landing.offsetPt ?? 0,
          tolerance
        );
        if (!checked) {
          add(
            'invalid-landing-geometry',
            'Clamped landing geometry is unavailable.',
            index
          );
          return;
        }
        const error = checked.errorPt;
        maxLandingErrorPt = Math.max(maxLandingErrorPt, error);
        if (error > tolerance)
          add(
            'wrong-landing',
            `Reachable target alignment is off by ${error} pt.`,
            index,
            'failure'
          );
        if (!checked.exposed) {
          add(
            'target-occluded',
            'The declared target reading point is outside the unobscured viewport.',
            index,
            'failure'
          );
        }
      }
    }
  });

  const verdict = verdictFor(issues);
  return {
    verdict,
    passed: verdict === 'PASS',
    evidenceLevel: 'sampled-geometry' as const,
    nativeFrames: 'INCOMPLETE' as const,
    issues,
    anchor: anchor
      ? assessAnchorTrace(samples, anchor.key, anchor.baselineY)
      : undefined,
    metrics: {
      samples: samples.length,
      maxSampleGapMs,
      maxAnchorDriftPt,
      maxBottomDistancePt,
      maxLandingErrorPt,
      blankSamples,
    },
  };
}

export type PresentedFrame = {
  sequence: number;
  startedAt: number;
  deadline: number;
  presentedAt: number;
};

/** Actual per-frame deadlines support variable refresh; heartbeats are not proof. */
export function assessPresentationTrace(
  frames: PresentedFrame[],
  options: {
    source:
      | 'native-presentation'
      | 'browser-presentation'
      | 'js-raf'
      | 'native-vsync';
    startTime: number;
    endTime: number;
  }
) {
  const issues: TraceIssue[] = [];
  const add = (
    code: string,
    message: string,
    kind: TraceIssue['kind'] = 'incomplete',
    sampleIndex?: number
  ) => issues.push({ code, message, kind, sampleIndex });
  if (
    options.source !== 'native-presentation' &&
    options.source !== 'browser-presentation'
  ) {
    add(
      'not-presentation-evidence',
      'JS callbacks and native vsync heartbeats cannot certify app presentation.'
    );
  }
  if (
    !finite(options.startTime) ||
    !finite(options.endTime) ||
    options.endTime <= options.startTime
  ) {
    add(
      'invalid-coverage',
      'Presentation coverage requires finite ordered bounds.'
    );
  }
  if (frames.length < 3)
    add('insufficient-frames', 'Need at least three actual presented frames.');
  if (
    !frames.length ||
    frames[0].startedAt > options.startTime ||
    frames[frames.length - 1].deadline < options.endTime
  ) {
    add(
      'incomplete-frame-coverage',
      'Presentation evidence does not span the requested interval.'
    );
  }
  let missedDeadlines = 0;
  let maxDeadlineOverrunMs = 0;
  frames.forEach((frame, index) => {
    if (
      !Number.isInteger(frame.sequence) ||
      ![frame.startedAt, frame.deadline, frame.presentedAt].every(finite) ||
      frame.deadline <= frame.startedAt ||
      frame.presentedAt < frame.startedAt
    ) {
      add(
        'invalid-frame',
        'Frame identifiers and presentation times must be valid.',
        'incomplete',
        index
      );
      return;
    }
    const previous = frames[index - 1];
    if (
      previous &&
      (frame.sequence !== previous.sequence + 1 ||
        frame.startedAt <= previous.startedAt ||
        frame.startedAt > previous.deadline)
    ) {
      add(
        'missing-frame-evidence',
        'Frame sequence or timeline contains an unobserved interval.',
        'incomplete',
        index
      );
    }
    const overrun = Math.max(0, frame.presentedAt - frame.deadline);
    maxDeadlineOverrunMs = Math.max(maxDeadlineOverrunMs, overrun);
    if (overrun > 0) {
      missedDeadlines++;
      add(
        'missed-presentation-deadline',
        `Frame missed its presentation deadline by ${overrun} ms.`,
        'failure',
        index
      );
    }
  });
  const verdict = verdictFor(issues);
  return {
    verdict,
    passed: verdict === 'PASS',
    source: options.source,
    issues,
    missedDeadlines,
    maxDeadlineOverrunMs,
  };
}
