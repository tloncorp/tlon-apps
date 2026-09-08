import { isDeepStrictEqual } from 'node:util';
import {
  assessScrollTrace,
  assessClampedScrollLanding,
  assessScrollPreconditions,
  hasThinkingMotionOverlap,
} from '../packages/app/fixtures/scrollStabilityTrace.ts';
import { assessRowMutationWitness } from '../packages/app/fixtures/scrollStabilityMutation.ts';
import { assessImageLoadWitness } from '../packages/app/fixtures/scrollStabilityImageLoad.ts';
import {
  adaptNativeScrollGeometry,
  nativeThinkingGestureExtentIsMeasured,
} from '../packages/app/fixtures/scrollNativeGeometry.ts';
import {
  nativeCenterCommandEvidenceIssues,
  nativeOffscreenCommandEvidenceIssues,
} from '../packages/app/fixtures/scrollNativeTargetCommand.ts';
import {
  replayNativeBottomContinuity,
  replayNativePostGestureTail,
} from './scroll-stability-native-recording-evidence.mjs';
import {
  assessNativeMutationEvidence,
  assessNativeHoldEvidence,
} from './scroll-stability-native-mutation-evidence.mjs';

// Keep supplemental native evaluation outside the bridged reader's early exits.
// A missing JS bracket cannot erase an independently qualified native jump.
export function assessNativeEvidence(trace) {
  const sampled = assessSampledNativeEvidence(trace);
  // These two declarations assert only the bounded native tail. The fixture's
  // observe capture does not provide a whole-gesture sampled assertion.
  if (/^armed-post-gesture-thinking-(end|away)$/.test(trace?.scenario ?? '')) {
    const tail = replayNativePostGestureTail(trace);
    return {
      status:
        tail.verdict === 'FAIL'
          ? 'fail'
          : tail.verdict === 'PASS'
            ? 'recorded-sampled-pass'
            : 'incomplete',
      issues: tail.issues.map(
        (i) => `buffered:${i.code}${i.frame === undefined ? '' : `:${i.frame}`}`
      ),
      geometryEvidenceLevel: 'native-buffered-post-gesture-tail-v1',
      sampledGeometry: sampled,
      nativeContinuity: tail,
      nativePostGestureTail: tail,
      nativePresentation: 'INCOMPLETE',
    };
  }
  const nativeBottom = replayNativeBottomContinuity(trace);
  const mutation =
    /^(?:near|history)-(?:grow|shrink|reference|media|remove|reaction|reply|cache)$/.test(
      trace?.scenario ?? ''
    );
  const nativeMutation = mutation
    ? assessNativeMutationEvidence(trace)
    : undefined;
  const stationaryHold =
    /^(?:(?:append|burst)-history|prepend-history|stateful-image-load-history|thinking-(?:show-hide|label|handoff-(?:message-first|same-frame|hide-first))-history)$/.test(
      trace?.scenario ?? ''
    );
  const nativeContinuity =
    nativeMutation?.anchorContinuity ??
    (stationaryHold ? assessNativeHoldEvidence(trace) : nativeBottom);
  const required =
    mutation || stationaryHold || nativeBottom.verdict !== 'UNASSESSED';
  const supplemental = {
    sampledGeometry: sampled,
    nativeContinuity,
    ...(nativeMutation ? { nativeMutation } : {}),
  };
  const failures = [nativeContinuity, nativeMutation].filter(
    (r) => r?.verdict === 'FAIL'
  );
  if (failures.length)
    return {
      ...sampled,
      ...supplemental,
      status: 'fail',
      geometryEvidenceLevel: 'ios-buffered-main-thread-model',
      issues: [
        ...sampled.issues,
        ...failures.flatMap((r) =>
          r.issues
            .filter((i) => i.kind === 'failure')
            .map(
              (i) =>
                `buffered:${i.code}${i.frame === undefined ? '' : `:${i.frame}`}`
            )
        ),
      ],
    };
  if (
    required &&
    (nativeContinuity.verdict !== 'PASS' ||
      (nativeMutation && nativeMutation.verdict !== 'PASS')) &&
    sampled.status === 'recorded-sampled-pass'
  )
    return {
      ...sampled,
      ...supplemental,
      status: 'incomplete',
      issues: [
        ...sampled.issues,
        'Required buffered native continuity or mutation evidence is incomplete',
      ],
    };
  return { ...sampled, ...supplemental };
}

// Replay the pure geometry oracle from raw measurements. A producer's PASS
// flag, aggregate metrics, or list of registered scenarios is not evidence.
function assessSampledNativeEvidence(trace) {
  const incomplete = (reason) => ({ status: 'incomplete', issues: [reason] });
  const geometryEvidenceLevel =
    trace.nativeGeometrySchemaVersion === 1
      ? 'ios-main-thread-model'
      : 'legacy-mixed-source-diagnostic';
  const fail = (reason) => ({
    status: 'fail',
    issues: [reason],
    geometryEvidenceLevel,
  });
  const expectations = trace.expectations;
  const samples = trace.samples;
  const mutationCase =
    /^(near|history)-(grow|shrink|reference|media|remove|reaction|reply|cache)$/.test(
      trace.scenario
    );
  let semanticWitness;
  let semanticFailures = [];
  if (
    trace.assertionSchemaVersion !== 1 ||
    typeof trace.followingOffsetThroughout !== 'boolean' ||
    typeof trace.emptyEndThroughout !== 'boolean' ||
    !expectations ||
    !Array.isArray(samples) ||
    samples.length < 3 ||
    !isDeepStrictEqual(trace.baseline, samples[0]) ||
    !Array.isArray(trace.events) ||
    trace.events.some(
      (event, index) =>
        !event ||
        !Number.isFinite(event.time) ||
        event.time > samples.at(-1).time ||
        typeof event.name !== 'string' ||
        (index > 0 && event.time < trace.events[index - 1].time)
    )
  )
    return incomplete(
      'Missing versioned raw oracle contract or event timeline'
    );
  const hasNativeGeometry = samples.some(
    (sample) => sample?.acquisition?.nativeGeometry
  );
  const sampledRuler = trace.nativeSampledRulerContract;
  const hasSampledRuler = samples.some(
    (sample) =>
      sample?.acquisition?.nativeGeometry?.ruler !== undefined ||
      sample?.acquisition?.nativeGeometry?.bracket?.ruler !== undefined
  );
  const declaredFields = ['scope', 'rootId', 'scrollViewId', 'composerId'];
  if (
    (sampledRuler !== undefined ||
      hasSampledRuler ||
      trace.nativeSampledRulerVersion !== undefined) &&
    (!sampledRuler ||
      sampledRuler.version !== 'indexed-cell-and-surfaces-v2' ||
      declaredFields.some(
        (key) => typeof sampledRuler[key] !== 'string' || !sampledRuler[key]
      ) ||
      trace.nativeGeometrySchemaVersion !== 1 ||
      trace.platform !== 'ios')
  )
    return incomplete(
      'Missing or unsupported sampled native ruler owner contract'
    );
  if (trace.nativeGeometrySchemaVersion !== undefined || hasNativeGeometry) {
    if (trace.nativeGeometrySchemaVersion !== 1 || trace.platform !== 'ios')
      return incomplete(
        'Missing or unsupported coherent native geometry schema'
      );
    const seenRequests = new Set();
    let nativeEnd = -Infinity;
    let previousReceipt = -Infinity;
    let sampledNativeOwner;
    for (const sample of samples) {
      const evidence = sample?.acquisition?.nativeGeometry;
      if (
        !evidence ||
        evidence.source !== 'ios-main-thread-model-v1' ||
        evidence.nativePresentation !== 'INCOMPLETE' ||
        !Array.isArray(evidence.issues) ||
        evidence.issues.length
      )
        return incomplete('Missing or invalid coherent native acquisition');
      if (
        sampledRuler &&
        (evidence.bracket?.ruler?.version !== sampledRuler.version ||
          evidence.bracket?.ruler?.scope !== sampledRuler.scope ||
          ['rootId', 'scrollViewId', 'composerId'].some(
            (key) => evidence.request?.[key] !== sampledRuler[key]
          ))
      )
        return incomplete(
          'Sampled native ruler contract differs from the declared owner'
        );
      let replay;
      try {
        replay = adaptNativeScrollGeometry(
          evidence.capture,
          evidence.request,
          evidence.bracket
        );
      } catch {
        return incomplete('Malformed coherent native acquisition');
      }
      if (
        !replay.snapshot.measurement.valid ||
        !sample.measurement?.valid ||
        sample.measurement.durationMs <
          replay.snapshot.measurement.durationMs ||
        sample.measurement.durationMs > 32 ||
        seenRequests.has(evidence.request.requestId) ||
        evidence.capture.startedAt < nativeEnd ||
        evidence.bracket.requestedAt < previousReceipt
      )
        return incomplete(
          'Invalid, stale or reused coherent native acquisition'
        );
      // Every derived ruler field consumed by a product oracle must reproduce
      // from the same raw native walk, including absence, identity and surfaces.
      if (
        !isDeepStrictEqual(
          evidence.ruler,
          replay.snapshot.acquisition.nativeGeometry.ruler
        )
      )
        return incomplete(
          'Native acquisition does not reproduce sampled ruler'
        );
      for (const key of [
        'time',
        'scroll',
        'contentLength',
        'viewportHeight',
        'viewportTop',
        'viewportBottom',
        'keyboardHeight',
        'nearEnd',
        'rows',
        'scrollBounds',
      ]) {
        // JSON serializes -0 as 0. Native top inset 0 produces minimum -0;
        // compare that exact numeric coordinate in its persisted JSON form.
        // No rounding or tolerance applies to any nonzero bound.
        const replayedValue =
          key === 'scrollBounds' && replay.snapshot.scrollBounds
            ? {
                min: replay.snapshot.scrollBounds.min + 0,
                max: replay.snapshot.scrollBounds.max + 0,
              }
            : replay.snapshot[key];
        const recordedValue =
          key === 'scrollBounds' && sample.scrollBounds
            ? {
                min: sample.scrollBounds.min + 0,
                max: sample.scrollBounds.max + 0,
              }
            : sample[key];
        if (!isDeepStrictEqual(recordedValue, replayedValue))
          return incomplete(`Native acquisition does not reproduce ${key}`);
      }
      for (const key of [
        'registeredRowCount',
        'selectedRowCount',
        'measuredRowCount',
        'visibleMeasuredRowCount',
        'nativeMetricsReceivedAt',
        'nativeMetricsAgeMs',
      ]) {
        if (
          !isDeepStrictEqual(
            sample.acquisition[key],
            replay.snapshot.acquisition[key]
          )
        )
          return incomplete(`Native acquisition count/source mismatch: ${key}`);
      }
      if (sampledRuler) {
        // Establish identity only after this complete acquisition was independently
        // reproduced. A retained tag is insufficient if its native object changed.
        const currentOwner = {
          root: evidence.capture.root.identity,
          window: evidence.capture.root.windowIdentity,
          scroll: evidence.capture.scroll.view.identity,
          host: evidence.capture.scroll.hostIdentity,
          composer: evidence.capture.composer.identity,
        };
        if (
          sampledNativeOwner &&
          !isDeepStrictEqual(currentOwner, sampledNativeOwner)
        )
          return incomplete(
            'Sampled native ruler mounted owner changed during capture'
          );
        sampledNativeOwner ??= currentOwner;
      }
      seenRequests.add(evidence.request.requestId);
      nativeEnd = evidence.capture.finishedAt;
      previousReceipt = evidence.bracket.receivedAt;
    }
  }
  const earlierEvents = trace.events.filter(
    (event) => event.time < samples[0].time
  );
  if (earlierEvents.length) {
    try {
      semanticWitness =
        mutationCase && trace.mutationEvidence?.contract
          ? assessRowMutationWitness(trace.mutationEvidence)
          : undefined;
    } catch {
      /* Invalid evidence cannot authorize out-of-capture records. */
    }
    const baselineCommitId =
      trace.mutationEvidence?.semanticSamples?.[0]?.commitId;
    if (
      !semanticWitness ||
      semanticWitness.verdict === 'INCOMPLETE' ||
      earlierEvents.some(
        (event) =>
          !(
            event.name === 'row-mutation-plan' &&
            event.time === trace.mutationEvidence.contract.declaredAt
          ) &&
          !(
            event.name === 'row-commit' &&
            event.values?.commitId === baselineCommitId &&
            event.values?.key === trace.mutationEvidence.contract.key &&
            event.values?.scope === trace.mutationEvidence.contract.scope
          )
      )
    )
      return incomplete(
        'Unqualified events before baseline; only the validated baseline render and pre-action plan are permitted'
      );
  }
  const { action, coverage, anchor, bottom, landing } = expectations;
  const minimumDuration =
    trace.scenario.startsWith('entry-') ||
    trace.scenario === 'command-center' ||
    trace.scenario === 'command-offscreen'
      ? 2800
      : trace.scenario === 'thinking-empty-show-hide'
        ? 2200
        : trace.scenario.startsWith('armed-') ||
            /^(keyboard|composer)-(end|history)$/.test(trace.scenario) ||
            trace.scenario === 'gesture'
          ? 4500
          : trace.scenario.startsWith('thinking-') ||
              trace.scenario.startsWith('stateful-image-load-')
            ? 2400
            : 1800;
  if (
    !action ||
    !coverage ||
    action.name !== trace.scenario ||
    action.observed !== true ||
    coverage.endTime - action.startedAt < minimumDuration ||
    expectations.requireMeasurementMetadata !== true ||
    (coverage.maxGapMs ?? 125) > 125 ||
    (coverage.maxMeasurementDurationMs ?? 32) > 32 ||
    (coverage.minSamples ?? 3) < 3 ||
    [anchor, bottom, landing].some(
      (contract) => contract && (contract.tolerancePt ?? 1) > 1
    ) ||
    (anchor?.reference !== undefined &&
      !['window', 'viewport-top', 'viewport-bottom'].includes(
        anchor.reference
      )) ||
    (['append-end', 'burst-end'].includes(trace.scenario) &&
      !trace.followingOffsetThroughout) ||
    (trace.scenario.startsWith('thinking-handoff-') &&
      trace.scenario.endsWith('-end') &&
      !trace.followingOffsetThroughout) ||
    (trace.scenario === 'thinking-empty-show-hide' &&
      !trace.emptyEndThroughout) ||
    (trace.assertion === 'hold' && !anchor) ||
    (trace.assertion === 'bottom' &&
      !bottom &&
      trace.scenario !== 'thinking-empty-show-hide') ||
    (trace.assertion === 'target' &&
      (!landing ||
        !['visible', 'top', 'center', 'bottom'].includes(landing.alignment))) ||
    (expectations.requireVisibleContent === false &&
      !trace.scenario.startsWith('entry-') &&
      !['empty-first-post', 'thinking-empty-show-hide'].includes(
        trace.scenario
      ))
  )
    return incomplete(
      'Missing action/position contract or weakened capture limits'
    );
  if (
    samples.some(
      (sample) =>
        !sample ||
        !Array.isArray(sample.rows) ||
        sample.rows.some((row) => !row || typeof row !== 'object')
    )
  )
    return incomplete('Missing raw row geometry');
  const imageCase = /^(stateful-image-load-|armed-image-load-)/.test(
    trace.scenario
  );
  const preconditions = trace.baselinePreconditions;
  const mutationKey = trace.events.find(
    (event) => event.name === 'row-mutation-request'
  )?.values?.key;
  if (
    !preconditions ||
    preconditions.requireHistory !==
      (trace.scenario.startsWith('history-') ||
        trace.scenario.endsWith('-history') ||
        trace.assertion === 'gesture') ||
    preconditions.requireInitialEnd !==
      (trace.scenario === 'command-center' ||
        trace.scenario === 'command-offscreen' ||
        (trace.assertion === 'bottom' &&
          !trace.scenario.startsWith('entry-') &&
          trace.scenario !== 'empty-first-post')) ||
    preconditions.requireReadingAnchor !==
      (trace.assertion === 'hold' || trace.assertion === 'gesture') ||
    !Array.isArray(preconditions.excludedAnchorKeys) ||
    (anchor && anchor.key !== preconditions.readingAnchorKey) ||
    (imageCase &&
      !preconditions.excludedAnchorKeys.includes(trace.imageLoadGate?.key)) ||
    (mutationCase && !preconditions.excludedAnchorKeys.includes(mutationKey)) ||
    (preconditions.allowEmptyEnd &&
      trace.scenario !== 'thinking-empty-show-hide')
  )
    return incomplete('Missing or weakened scenario preconditions');
  const baselineCheck = assessScrollPreconditions(
    trace.baseline,
    preconditions
  );
  if (!baselineCheck.established)
    return incomplete(
      baselineCheck.issues.map((issue) => issue.code).join(', ')
    );
  if (trace.scenario === 'command-center') {
    const issues = nativeCenterCommandEvidenceIssues(trace);
    if (issues.length) return incomplete(issues.join(', '));
  }
  if (trace.scenario === 'command-offscreen') {
    const issues = nativeOffscreenCommandEvidenceIssues(trace);
    if (issues.length) return incomplete(issues.join(', '));
  }
  if (mutationCase) {
    const evidence = trace.mutationEvidence;
    if (
      !evidence ||
      !isDeepStrictEqual(evidence.events, trace.events) ||
      !isDeepStrictEqual(evidence.samples, samples) ||
      !isDeepStrictEqual(evidence.committedKeys, trace.committedDataKeys)
    )
      return incomplete('Mutation witness is not bound to this raw capture');
    let witness;
    try {
      witness = semanticWitness ?? assessRowMutationWitness(evidence);
    } catch {
      return incomplete('Malformed strict mutation evidence');
    }
    if (witness.verdict === 'INCOMPLETE')
      return incomplete(witness.reasons.join(', '));
    const plan = evidence.contract;
    const kind = trace.scenario.split('-').at(-1);
    const effect =
      kind === 'reference' ? 'commit' : kind === 'remove' ? 'remove' : 'resize';
    const changedField =
      kind === 'reaction'
        ? 'reactions'
        : kind === 'reply'
          ? 'replies'
          : 'content';
    const requests = trace.events.filter(
      (event) => event.name === 'row-mutation-request'
    );
    if (
      witness.evidenceLevel !== 'sampled-row-semantics' ||
      !plan ||
      witness.kind !== kind ||
      plan.key !== mutationKey ||
      typeof trace.mutationScope !== 'string' ||
      !trace.mutationScope ||
      plan.scope !== trace.mutationScope ||
      plan.coverage.startTime !== coverage.startTime ||
      plan.coverage.endTime !== coverage.endTime ||
      plan.coverage.maxGapMs > (coverage.maxGapMs ?? 125) ||
      plan.coverage.maxMeasurementDurationMs >
        (coverage.maxMeasurementDurationMs ?? 32) ||
      plan.phases.length !== 1 ||
      plan.phases[0].effect !== effect ||
      (kind !== 'remove' &&
        plan.baseline.state.signature?.[changedField] ===
          plan.phases[0].state.signature?.[changedField]) ||
      plan.phases[0].observationWindow.startTime < action.completedAt ||
      requests.some(
        (request) =>
          request.time < action.startedAt || request.time > action.completedAt
      )
    )
      return incomplete(
        'Strict mutation scope, fixed capture or phase effect differs from the registered scenario'
      );
    if (witness.verdict === 'FAIL') semanticFailures = witness.reasons;
  }
  if (imageCase) {
    const evidence = trace.imageLoadEvidence;
    const imageKey = trace.imageLoadGate?.key;
    const expectedInteraction = trace.scenario.startsWith('armed-image-load-')
      ? trace.scenario.includes('-keyboard-')
        ? 'keyboard'
        : trace.scenario.includes('-composer-')
          ? 'composer'
          : 'gesture'
      : undefined;
    const expectedMeasurements = samples.flatMap((sample) => {
      const row = sample.rows.find((candidate) => candidate.key === imageKey);
      return row &&
        sample.measurement?.valid &&
        Number.isFinite(sample.measurement.durationMs) &&
        sample.measurement.durationMs <= 32
        ? [{ time: sample.time, height: row.height }]
        : [];
    });
    if (
      !evidence ||
      !isDeepStrictEqual(evidence.events, trace.events) ||
      !isDeepStrictEqual(evidence.gate, trace.imageLoadGate) ||
      evidence.recordingStartTime !== samples[0].time ||
      evidence.baselineHeight !==
        samples[0].rows.find((row) => row.key === imageKey)?.height ||
      !isDeepStrictEqual(evidence.measurements, expectedMeasurements) ||
      evidence.interaction !== expectedInteraction ||
      trace.imageLoadInteraction !== expectedInteraction
    )
      return incomplete('Image witness is not bound to this raw capture');
    const witness = assessImageLoadWitness(evidence);
    if (!witness.observed) return incomplete(witness.reasons.join(', '));
  }
  const keyboardCase =
    /^(keyboard-(history|end)|dismiss-history|armed-(thinking|image-load)-keyboard-(history|end))$/.test(
      trace.scenario
    );
  const composerCase = /^(armed-image-load-)?composer-(history|end)$/.test(
    trace.scenario
  );
  let keyboardStart;
  let keyboardMatched = false;
  for (const event of trace.events) {
    const will = /^keyboardWill(Show|Hide)$/.exec(event.name);
    const did = /^keyboardDid(Show|Hide)$/.exec(event.name);
    if (will) keyboardStart = { time: event.time, direction: will[1] };
    if (
      did &&
      keyboardStart?.direction === did[1] &&
      event.time > keyboardStart.time
    ) {
      keyboardMatched = true;
      keyboardStart = undefined;
    }
  }
  if (
    keyboardCase &&
    (!keyboardMatched ||
      !samples.some(
        (sample) => sample.keyboardHeight !== samples[0].keyboardHeight
      ))
  )
    return incomplete('No actual keyboard completion and height change');
  if (
    composerCase &&
    (!Number.isFinite(trace.baselineComposerHeight) ||
      !trace.events.some((event) => event.name === 'composer-input') ||
      !trace.events.some(
        (event) =>
          event.name === 'composer-layout' &&
          Number.isFinite(event.values?.height) &&
          Math.abs(event.values.height - trace.baselineComposerHeight) > 1
      ))
  )
    return incomplete('No actual composer input and height change');
  if (
    trace.scenario.startsWith('thinking-') ||
    trace.scenario.startsWith('armed-thinking-')
  ) {
    const requests = trace.events.filter(
      (event) => event.name === 'thinking-request'
    );
    const layouts = trace.events.filter(
      (event) => event.name === 'thinking-layout'
    );
    if (
      !requests.length ||
      requests.some(
        (request) =>
          !trace.events.some(
            (event) =>
              event.name === 'thinking-commit' &&
              event.time >= request.time &&
              event.values?.visible === request.values?.visible &&
              (!request.values?.visible ||
                event.values?.label === request.values?.label)
          ) ||
          (request.values?.layoutChange === true &&
            !layouts.some(
              (event) =>
                event.time >= request.time &&
                event.values?.height === (request.values?.visible ? 52 : 0)
            ))
      )
    )
      return incomplete(
        'Expected production thinking commits/layouts were not captured'
      );
    if (trace.scenario.startsWith('armed-thinking-')) {
      if (
        !hasThinkingMotionOverlap(
          trace.events,
          keyboardCase ? 'keyboard' : 'gesture'
        )
      )
        return incomplete(
          'No thinking layout inside one matched interaction interval'
        );
    }
  }
  if (
    /^(append|burst)-(end|history)$/.test(trace.scenario) ||
    trace.scenario === 'prepend-history' ||
    trace.scenario === 'empty-first-post'
  ) {
    const before = trace.originalDataKeys;
    const after = trace.committedDataKeys;
    if (
      !Array.isArray(before) ||
      !Array.isArray(after) ||
      new Set(before).size !== before.length ||
      new Set(after).size !== after.length
    )
      return incomplete('Missing actual before/after list identities');
    const prepend = trace.scenario === 'prepend-history';
    const added = after.length - before.length;
    if (
      added <= 0 ||
      (prepend && added !== 20) ||
      (trace.scenario.startsWith('append-') && added !== 1) ||
      (trace.scenario.startsWith('burst-') && added !== 10) ||
      (trace.scenario === 'empty-first-post' &&
        (before.length !== 0 || after.length !== 1)) ||
      !isDeepStrictEqual(
        prepend ? after.slice(added) : after.slice(0, before.length),
        before
      )
    )
      return incomplete(
        'Expected list insertion count/order was not committed'
      );
  }
  if (trace.scenario.startsWith('entry-')) {
    const mode = trace.scenario.slice('entry-'.length);
    const reset = trace.events.find(
      (event) => event.name === 'reset' && event.values?.mode === mode
    );
    const attach = trace.events.find(
      (event) =>
        event.name === 'list-attached' && reset && event.time >= reset.time
    );
    const ready = trace.events.find(
      (event) =>
        event.name === 'entry-state' &&
        event.values?.ready === true &&
        event.values?.count === 90 &&
        attach &&
        event.time >= attach.time
    );
    const expectedKeys = Array.from(
      { length: 90 },
      (_, index) => `scroll-fixture-${index + 30}`
    );
    const targetKey =
      mode === 'selected' ? 'scroll-fixture-65' : expectedKeys.at(-1);
    if (
      !reset ||
      !attach ||
      !ready ||
      !isDeepStrictEqual(trace.committedDataKeys, expectedKeys) ||
      !trace.events.some(
        (event) =>
          event.name === 'row-commit' &&
          event.values?.key === targetKey &&
          event.time >= attach.time
      ) ||
      (mode === 'selected'
        ? landing?.key !== targetKey
        : bottom?.tailKey !== targetKey)
    )
      return incomplete(
        'Actual reset, mounted list, ready data and entry target were not witnessed'
      );
    if (
      mode === 'delayed' &&
      !trace.events.some(
        (event) =>
          event.name === 'entry-state' &&
          event.values?.count === 0 &&
          event.time >= reset.time &&
          event.time < ready.time
      )
    )
      return incomplete(
        'Delayed entry never captured its empty/loading data stage'
      );
  }
  let replay;
  try {
    replay = assessScrollTrace(samples, expectations);
  } catch {
    return incomplete('Malformed raw geometry contract');
  }
  if (['command-center', 'command-offscreen'].includes(trace.scenario)) {
    const requestName =
      trace.scenario === 'command-center'
        ? 'center-command-request'
        : 'offscreen-command-request';
    const request = trace.events.find((event) => event.name === requestName);
    const trajectory = assessNonanimatedCommandTrajectory(
      samples,
      landing,
      request.time,
      coverage.maxMeasurementDurationMs ?? 32
    );
    if (trajectory.length)
      return {
        status:
          trajectory.some((issue) => issue.kind === 'failure') ||
          replay.verdict === 'FAIL'
            ? 'fail'
            : 'incomplete',
        geometryEvidenceLevel,
        issues: [
          ...replay.issues.map((issue) => issue.code),
          ...trajectory.map((issue) => issue.code),
          ...semanticFailures,
        ],
      };
  }
  if (replay.verdict !== 'PASS')
    return {
      status: replay.verdict === 'FAIL' ? 'fail' : 'incomplete',
      geometryEvidenceLevel,
      issues: [
        ...replay.issues.map((issue) => issue.code),
        ...semanticFailures,
      ],
    };
  if (
    Object.entries(replay.metrics).some(
      ([key, value]) => trace.result?.metrics?.[key] !== value
    )
  )
    return incomplete('Reported metrics disagree with raw oracle replay');
  // Fixture-only follow and empty-list contracts supplement the shared oracle.
  if (trace.followingOffsetThroughout || trace.emptyEndThroughout) {
    if (samples.some((sample) => !sample.scrollBounds))
      return incomplete('Missing legal end bounds');
    if (
      samples.some(
        (sample) => Math.abs(sample.scrollBounds.max - sample.scroll) > 1
      )
    )
      return fail('Raw samples contradict end pinning throughout');
  }
  if (trace.emptyEndThroughout && samples.some((sample) => sample.rows.length))
    return incomplete('The empty-list scope contains rows');
  if (trace.assertion === 'gesture') {
    const imageKey = trace.imageLoadGate?.key;
    const order = trace.committedDataKeys;
    const starts = trace.events.filter((event) => event.name === 'drag-begin');
    const ends = trace.events.filter((event) => event.name === 'drag-end');
    if (
      !starts.some((start) => ends.some((end) => end.time > start.time)) ||
      !samples.some(
        (sample) => Math.abs(sample.scroll - samples[0].scroll) > 1
      ) ||
      (imageKey &&
        (!Array.isArray(order) || new Set(order).size !== order.length))
    )
      return incomplete('Missing real gesture or image row order');
    let witnessedPairs = 0;
    let displacementFailure = false;
    for (let index = 1; index < samples.length; index++) {
      const previous = samples[index - 1];
      const current = samples[index];
      const visible = (sample, row) =>
        row.y < sample.viewportBottom &&
        row.y + row.height > sample.viewportTop;
      const witness = previous.rows.find(
        (row) =>
          row.key !== imageKey &&
          visible(previous, row) &&
          current.rows.some(
            (next) => next.key === row.key && visible(current, next)
          )
      );
      const next = current.rows.find((row) => row.key === witness?.key);
      if (!witness || !next || Math.abs(next.height - witness.height) > 1)
        return incomplete('Missing unchanged visible gesture witness');
      let expectedHeightDelta = 0;
      if (imageKey) {
        const beforeImage = previous.rows.find((row) => row.key === imageKey);
        const afterImage = current.rows.find((row) => row.key === imageKey);
        if (
          !beforeImage ||
          !afterImage ||
          !order.includes(imageKey) ||
          !order.includes(witness.key)
        )
          return incomplete('Missing measured image gesture displacement');
        const delta = afterImage.height - beforeImage.height;
        if (
          Math.abs(current.contentLength - previous.contentLength - delta) > 1
        )
          return incomplete('Unexplained content extent during image gesture');
        if (order.indexOf(imageKey) < order.indexOf(witness.key))
          expectedHeightDelta = delta;
      } else if (
        Math.abs(current.contentLength - previous.contentLength) > 1 &&
        !(
          trace.scenario.startsWith('armed-thinking-') &&
          nativeThinkingGestureExtentIsMeasured(
            previous,
            current,
            trace.events,
            trace.committedDataKeys
          )
        )
      )
        return incomplete('Unexplained content extent during gesture');
      witnessedPairs++;
      const residual = Math.abs(
        next.y -
          witness.y +
          current.scroll -
          previous.scroll -
          (current.viewportTop - previous.viewportTop) -
          expectedHeightDelta
      );
      if (residual > 1) displacementFailure = true;
    }
    if (!witnessedPairs) return incomplete('No coherent gesture pairs');
    // A later unmeasured/unexplained interval can disqualify the gesture scope.
    // Do not stop at an early residual before checking the entire capture.
    if (displacementFailure)
      return fail('Raw gesture displacement exceeds 1 pt');
  }
  return semanticFailures.length
    ? { status: 'fail', issues: semanticFailures, geometryEvidenceLevel }
    : { status: 'recorded-sampled-pass', issues: [], geometryEvidenceLevel };
}

// Called only after the fixed command's real native scope/request validation.
// Exported for narrow detector controls; it does not grant acquisition proof.
export function assessNonanimatedCommandTrajectory(
  samples,
  landing,
  requestTime,
  maxMeasurementDurationMs = 32
) {
  const issues = [];
  const finite = Number.isFinite;
  const tolerance = landing?.tolerancePt ?? 1;
  const valid = (sample) =>
    sample &&
    finite(sample.time) &&
    finite(sample.scroll) &&
    finite(sample.viewportTop) &&
    finite(sample.viewportBottom) &&
    sample.viewportBottom > sample.viewportTop &&
    sample.measurement?.valid === true &&
    finite(sample.measurement.durationMs) &&
    sample.measurement.durationMs >= 0 &&
    sample.measurement.durationMs <= maxMeasurementDurationMs &&
    sample.scrollBounds &&
    finite(sample.scrollBounds.min) &&
    finite(sample.scrollBounds.max) &&
    sample.scrollBounds.min <= sample.scrollBounds.max &&
    Array.isArray(sample.rows) &&
    new Set(sample.rows.map((row) => row?.key)).size === sample.rows.length &&
    sample.rows.every(
      (row) =>
        row &&
        typeof row.key === 'string' &&
        row.key &&
        finite(row.y) &&
        finite(row.height) &&
        row.height > 0
    );
  if (
    !finite(maxMeasurementDurationMs) ||
    maxMeasurementDurationMs < 0 ||
    maxMeasurementDurationMs > 32 ||
    !Array.isArray(samples) ||
    !samples.length ||
    !valid(samples[0]) ||
    !finite(requestTime) ||
    !landing?.key ||
    landing.alignment !== 'center' ||
    !finite(tolerance) ||
    tolerance < 0 ||
    tolerance > 1
  )
    return [
      { code: 'command-trajectory-invalid-baseline', kind: 'incomplete' },
    ];
  const baseline = samples[0].scroll;
  let moved = false;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (!valid(sample) || (i && sample.time <= samples[i - 1].time)) {
      issues.push({
        code: 'command-trajectory-invalid-sample',
        kind: 'incomplete',
        sampleIndex: i,
      });
      continue;
    }
    if (sample.time < requestTime) continue;
    if (Math.abs(sample.scroll - baseline) > tolerance) moved = true;
    if (!moved) continue;
    const row = sample.rows.find((row) => row.key === landing.key);
    if (!row) {
      issues.push({
        code: 'command-trajectory-target-missing',
        kind: 'failure',
        sampleIndex: i,
      });
      continue;
    }
    const result = assessClampedScrollLanding(
      sample,
      row,
      landing.alignment,
      landing.offsetPt ?? 0,
      tolerance
    );
    if (!result) {
      issues.push({
        code: 'command-trajectory-invalid-geometry',
        kind: 'incomplete',
        sampleIndex: i,
      });
      continue;
    }
    const ruler = sample.acquisition?.nativeGeometry?.ruler;
    if (result.errorPt > tolerance)
      issues.push({
        code: 'command-trajectory-wrong-landing',
        kind: 'failure',
        sampleIndex: i,
        errorPt: result.errorPt,
      });
    if (
      !result.exposed ||
      (ruler?.version === 'indexed-cell-and-surfaces-v2' &&
        ruler.obscuredKeys.includes(landing.key))
    )
      issues.push({
        code: 'command-trajectory-target-occluded',
        kind: 'failure',
        sampleIndex: i,
      });
  }
  return issues;
}
