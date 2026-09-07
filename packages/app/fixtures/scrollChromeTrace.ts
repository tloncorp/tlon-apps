export type ScrollChromeControl = {
  id: string;
  scope: string;
  kind: string;
  /** Actual presentation visibility after ancestor/viewport clipping. */
  visible: boolean;
  /** Effective opacity, including ancestors; this does not prove paint. */
  opacity: number;
};
export type ScrollChromeSample = {
  time: number;
  scope: string;
  loading: boolean;
  semanticState: string;
  controls: ScrollChromeControl[];
  measurement: { valid: boolean; durationMs: number };
};
export type ScrollChromeTrace = {
  samples: ScrollChromeSample[];
  /** Actual dispatched UI/causal events, not planned actions. */
  actions: { id: string; scope: string; time: number }[];
};
export type ExpectedScrollChromeControl = {
  id: string;
  kind: string;
  visibility: 'visible' | 'hidden' | 'absent';
  /** Defaults to1 for visible and0 otherwise. Hidden-but-opaque is explicit. */
  opacity?: number;
};
export type ScrollChromePhase = {
  id: string;
  startTime: number;
  endTime: number;
  loading: boolean;
  semanticState: string;
  /** Complete inventory of the controls under test, including absent controls. */
  controls: ExpectedScrollChromeControl[];
};
export type ScrollChromeTransition = {
  from: string;
  to: string;
  startTime: number;
  endTime: number;
  opacity: 'instant' | 'monotonic';
};
export type ScrollChromeContract = {
  scope: string;
  coverage: {
    startTime: number;
    endTime: number;
    maxGapMs?: number;
    maxMeasurementDurationMs?: number;
  };
  action: { id: string; startTime: number; endTime: number };
  /** Phases and transitions partition the planned capture in this order. */
  phases: ScrollChromePhase[];
  transitions: ScrollChromeTransition[];
};
export type ScrollChromeIssue = {
  code: string;
  kind: 'failure' | 'incomplete';
  message: string;
  sampleIndex?: number;
  phaseId?: string;
  controlId?: string;
};

const finite = Number.isFinite;
const opacityTolerance = 0.01;
const opacityFor = (control: ExpectedScrollChromeControl) =>
  control.opacity ?? (control.visibility === 'visible' ? 1 : 0);
const stateFor = (state: { loading: boolean; semanticState: string }) =>
  JSON.stringify([state.loading, state.semanticState]);
const phaseAt = (time: number, phases: ScrollChromePhase[]) =>
  phases.find(
    (phase, index) =>
      (time >= phase.startTime || index === 0) &&
      (time < phase.endTime || index === phases.length - 1)
  );

/**
 * Tests observed chrome against an independently authored scenario schedule.
 * JS/DOM snapshots cannot prove that a state was painted or detect flicker
 * between samples. A PASS is sampled state only; presentation stays incomplete.
 */
export function assessScrollChromeTrace(
  trace: ScrollChromeTrace,
  contract: ScrollChromeContract
) {
  const issues: ScrollChromeIssue[] = [];
  const add = (
    code: string,
    kind: ScrollChromeIssue['kind'],
    message: string,
    sampleIndex?: number,
    phaseId?: string,
    controlId?: string
  ) => issues.push({ code, kind, message, sampleIndex, phaseId, controlId });
  if (
    !trace ||
    !Array.isArray(trace.samples) ||
    !Array.isArray(trace.actions) ||
    trace.samples.some((sample) => !sample) ||
    trace.actions.some((event) => !event) ||
    !contract ||
    !contract.coverage ||
    !contract.action ||
    !Array.isArray(contract.phases) ||
    !Array.isArray(contract.transitions) ||
    contract.phases.some(
      (phase) =>
        !phase ||
        !Array.isArray(phase.controls) ||
        phase.controls.some((control) => !control)
    ) ||
    contract.transitions.some((transition) => !transition)
  ) {
    return {
      verdict: 'INCOMPLETE' as const,
      passed: false,
      evidenceLevel: 'sampled-state' as const,
      nativePresentation: 'INCOMPLETE' as const,
      issues: [
        {
          code: 'invalid-trace-shape',
          kind: 'incomplete' as const,
          message:
            'Complete trace, action, phase and control arrays are required.',
        },
      ],
      metrics: {
        samples: Array.isArray(trace?.samples) ? trace.samples.length : 0,
        maxSampleGapMs: 0,
        observedViolations: 0,
      },
    };
  }
  const { coverage, phases, transitions, action } = contract;
  const maxGap = coverage.maxGapMs ?? 100;
  const maxAcquisition = coverage.maxMeasurementDurationMs ?? 32;
  let maxSampleGapMs = 0;
  const finish = () => ({
    verdict: issues.some((issue) => issue.kind === 'incomplete')
      ? ('INCOMPLETE' as const)
      : issues.length
        ? ('FAIL' as const)
        : ('PASS' as const),
    passed: issues.length === 0,
    evidenceLevel: 'sampled-state' as const,
    nativePresentation: 'INCOMPLETE' as const,
    issues,
    metrics: {
      samples: trace.samples.length,
      maxSampleGapMs,
      observedViolations: issues.filter((issue) => issue.kind === 'failure')
        .length,
    },
  });
  const validControl = (control: ExpectedScrollChromeControl) =>
    !!control.id &&
    !!control.kind &&
    ['visible', 'hidden', 'absent'].includes(control.visibility) &&
    finite(opacityFor(control)) &&
    opacityFor(control) >= 0 &&
    opacityFor(control) <= 1 &&
    (control.visibility !== 'visible' ||
      opacityFor(control) > opacityTolerance);
  if (
    !contract.scope ||
    !finite(coverage.startTime) ||
    !finite(coverage.endTime) ||
    coverage.endTime <= coverage.startTime ||
    !finite(maxGap) ||
    maxGap <= 0 ||
    !finite(maxAcquisition) ||
    maxAcquisition < 0 ||
    !phases.length ||
    new Set(phases.map((phase) => phase.id)).size !== phases.length ||
    phases.some(
      (phase) =>
        !phase.id ||
        !finite(phase.startTime) ||
        !finite(phase.endTime) ||
        phase.endTime <= phase.startTime ||
        typeof phase.loading !== 'boolean' ||
        typeof phase.semanticState !== 'string' ||
        !phase.controls.every(validControl) ||
        new Set(phase.controls.map((control) => control.id)).size !==
          phase.controls.length
    ) ||
    phases[0]?.startTime !== coverage.startTime ||
    phases.at(-1)?.endTime !== coverage.endTime ||
    transitions.length !== phases.length - 1 ||
    transitions.some(
      (transition, index) =>
        transition.from !== phases[index].id ||
        transition.to !== phases[index + 1].id ||
        transition.startTime !== phases[index].endTime ||
        transition.endTime !== phases[index + 1].startTime ||
        transition.endTime < transition.startTime ||
        !['instant', 'monotonic'].includes(transition.opacity)
    ) ||
    !action.id ||
    !finite(action.startTime) ||
    !finite(action.endTime) ||
    action.startTime < coverage.startTime ||
    action.endTime > coverage.endTime ||
    action.endTime < action.startTime
  ) {
    add(
      'invalid-contract',
      'incomplete',
      'Ordered phases, explicit transitions, scope and action must cover a finite planned interval.'
    );
    return finish();
  }
  const inventory = phases[0].controls
    .map((control) => control.id)
    .sort()
    .join('\0');
  if (
    phases.some(
      (phase) =>
        phase.controls
          .map((control) => control.id)
          .sort()
          .join('\0') !== inventory
    )
  ) {
    add(
      'incomplete-control-inventory',
      'incomplete',
      'Every phase must name every tracked control, declaring hidden or absent explicitly.'
    );
    return finish();
  }
  if (phases.at(-1)!.endTime - phases.at(-1)!.startTime < 200)
    add(
      'insufficient-terminal-tail',
      'incomplete',
      'The terminal semantic state needs at least200ms of planned observation.'
    );
  const actionEvents = trace.actions.filter((event) => event.id === action.id);
  if (
    trace.actions.some(
      (event) => !finite(event.time) || !event.id || !event.scope
    ) ||
    actionEvents.length !== 1 ||
    actionEvents[0]?.scope !== contract.scope ||
    actionEvents[0].time < action.startTime ||
    actionEvents[0].time > action.endTime
  )
    add(
      'action-not-witnessed',
      'incomplete',
      'Exactly one actual action with the expected scope and time must be captured.'
    );
  if (
    !trace.samples.length ||
    trace.samples[0].time > coverage.startTime ||
    trace.samples.at(-1)!.time < coverage.endTime
  )
    add(
      'missing-capture-boundary',
      'incomplete',
      'The planned baseline and final capture boundary must both be sampled.'
    );
  const validIndices = new Set<number>();
  trace.samples.forEach((sample, index) => {
    if (index) {
      const gap = sample.time - trace.samples[index - 1].time;
      if (finite(gap)) maxSampleGapMs = Math.max(maxSampleGapMs, gap);
      if (!finite(gap) || gap <= 0)
        add(
          'invalid-timeline',
          'incomplete',
          'Sample times must strictly increase.',
          index
        );
      else if (gap > maxGap)
        add(
          'capture-gap',
          'incomplete',
          'A required sampling interval is missing.',
          index
        );
    }
    if (
      !finite(sample.time) ||
      !sample.scope ||
      typeof sample.loading !== 'boolean' ||
      typeof sample.semanticState !== 'string' ||
      !sample.measurement ||
      sample.measurement.valid !== true ||
      !finite(sample.measurement.durationMs) ||
      sample.measurement.durationMs < 0 ||
      sample.measurement.durationMs > maxAcquisition ||
      !Array.isArray(sample.controls) ||
      sample.controls.some(
        (control) =>
          !control.id ||
          !control.scope ||
          !control.kind ||
          typeof control.visible !== 'boolean' ||
          !finite(control.opacity) ||
          control.opacity < 0 ||
          control.opacity > 1
      )
    ) {
      add(
        'invalid-sample',
        'incomplete',
        'State and effective opacity must be completely and coherently acquired.',
        index
      );
      return;
    }
    validIndices.add(index);
    if (
      sample.scope !== contract.scope ||
      sample.controls.some((control) => control.scope !== contract.scope)
    )
      add(
        'wrong-scope',
        'failure',
        'Observed chrome belongs to another conversation or request scope.',
        index
      );
    if (
      new Set(sample.controls.map((control) => control.id)).size !==
      sample.controls.length
    )
      add(
        'duplicate-control',
        'failure',
        'A logical control has multiple mounted presentations.',
        index
      );
    for (const control of sample.controls)
      if (!phases[0].controls.some((expected) => expected.id === control.id))
        add(
          'unexpected-control',
          'failure',
          'Observed control is outside the declared inventory.',
          index,
          undefined,
          control.id
        );
  });
  const compareStable = (
    sample: ScrollChromeSample,
    phase: ScrollChromePhase,
    index: number
  ) => {
    if (stateFor(sample) !== stateFor(phase))
      add(
        'semantic-state-mismatch',
        'failure',
        'Loading/content state differs from the expected current revision.',
        index,
        phase.id
      );
    for (const expected of phase.controls) {
      const matches = sample.controls.filter(
        (control) => control.id === expected.id
      );
      if (expected.visibility === 'absent') {
        if (matches.length)
          add(
            'control-should-be-absent',
            'failure',
            'The control must be unmounted in this phase.',
            index,
            phase.id,
            expected.id
          );
        continue;
      }
      const observed = matches[0];
      if (!observed) {
        add(
          'control-missing',
          'failure',
          'A required mounted control disappeared.',
          index,
          phase.id,
          expected.id
        );
        continue;
      }
      if (observed.kind !== expected.kind)
        add(
          'control-kind-mismatch',
          'failure',
          'Spinner/icon or control identity changed without permission.',
          index,
          phase.id,
          expected.id
        );
      if (observed.visible !== (expected.visibility === 'visible'))
        add(
          'control-visibility-mismatch',
          'failure',
          'Control visibility changed outside an allowed transition.',
          index,
          phase.id,
          expected.id
        );
      if (Math.abs(observed.opacity - opacityFor(expected)) > opacityTolerance)
        add(
          'control-opacity-mismatch',
          'failure',
          'Effective opacity differs from the stable expected presentation.',
          index,
          phase.id,
          expected.id
        );
    }
  };
  const phaseCounts = new Map<string, number>();
  const transitionProgress = new Map<
    string,
    { categorical: Map<string, boolean>; opacity: Map<string, number> }
  >();
  trace.samples.forEach((sample, index) => {
    if (!validIndices.has(index)) return;
    const phase = phaseAt(sample.time, phases);
    if (phase) {
      if (sample.time >= phase.startTime && sample.time <= phase.endTime)
        phaseCounts.set(phase.id, (phaseCounts.get(phase.id) ?? 0) + 1);
      compareStable(sample, phase, index);
      return;
    }
    const transition = transitions.find(
      (item) => sample.time >= item.startTime && sample.time < item.endTime
    );
    if (!transition) {
      add(
        'unassigned-sample',
        'incomplete',
        'Sample is outside the declared phase schedule.',
        index
      );
      return;
    }
    const from = phases.find((item) => item.id === transition.from)!;
    const to = phases.find((item) => item.id === transition.to)!;
    let progress = transitionProgress.get(transition.to);
    if (!progress) {
      progress = { categorical: new Map(), opacity: new Map() };
      transitionProgress.set(transition.to, progress);
    }
    const advance = (
      field: string,
      value: unknown,
      initial: unknown,
      terminal: unknown,
      controlId?: string
    ) => {
      if (value !== initial && value !== terminal) {
        add(
          'unpermitted-transition-state',
          'failure',
          'Observed an undeclared intermediate state.',
          index,
          undefined,
          controlId
        );
      } else if (initial !== terminal) {
        if (value === initial && progress!.categorical.get(field))
          add(
            'transition-reversal',
            'failure',
            'A transition reverted after reaching its next state.',
            index,
            undefined,
            controlId
          );
        if (value === terminal) progress!.categorical.set(field, true);
      }
    };
    advance('semantic', stateFor(sample), stateFor(from), stateFor(to));
    if (
      from.controls.some((control) => control.visibility === 'visible') &&
      to.controls.some((control) => control.visibility === 'visible') &&
      !sample.controls.some(
        (control) => control.visible && control.opacity > opacityTolerance
      )
    )
      add(
        'blank-transition-bridge',
        'failure',
        'A transition between visible controls exposed no visible chrome.',
        index
      );
    for (const initial of from.controls) {
      const terminal = to.controls.find(
        (control) => control.id === initial.id
      )!;
      const observed = sample.controls.find(
        (control) => control.id === initial.id
      );
      const id = initial.id;
      advance(
        `${id}:mounted`,
        !!observed,
        initial.visibility !== 'absent',
        terminal.visibility !== 'absent',
        id
      );
      advance(
        `${id}:visible`,
        observed?.visible ?? false,
        initial.visibility === 'visible',
        terminal.visibility === 'visible',
        id
      );
      if (observed)
        advance(`${id}:kind`, observed.kind, initial.kind, terminal.kind, id);
      const opacity = observed?.opacity ?? 0;
      const startOpacity =
        initial.visibility === 'absent' ? 0 : opacityFor(initial);
      const endOpacity =
        terminal.visibility === 'absent' ? 0 : opacityFor(terminal);
      if (transition.opacity === 'instant') {
        const atStart = Math.abs(opacity - startOpacity) <= opacityTolerance;
        const atEnd = Math.abs(opacity - endOpacity) <= opacityTolerance;
        advance(
          `${id}:opacity`,
          atEnd ? endOpacity : atStart ? startOpacity : null,
          startOpacity,
          endOpacity,
          id
        );
      } else {
        const previous = progress.opacity.get(id) ?? startOpacity;
        const direction = Math.sign(endOpacity - startOpacity);
        if (
          opacity < Math.min(startOpacity, endOpacity) - opacityTolerance ||
          opacity > Math.max(startOpacity, endOpacity) + opacityTolerance ||
          (direction >= 0 && opacity < previous - opacityTolerance) ||
          (direction <= 0 && opacity > previous + opacityTolerance)
        )
          add(
            'opacity-reversal',
            'failure',
            'Opacity left its declared monotonic fade or reset after progress.',
            index,
            undefined,
            id
          );
        // Compare with the furthest progress, so many sub-tolerance steps
        // cannot accumulate into a visible backwards fade.
        progress.opacity.set(
          id,
          direction >= 0
            ? Math.max(previous, opacity)
            : Math.min(previous, opacity)
        );
      }
    }
  });
  for (const phase of phases)
    if ((phaseCounts.get(phase.id) ?? 0) < 3)
      add(
        'phase-not-witnessed',
        'incomplete',
        'Every stable phase requires at least3valid observed samples.',
        undefined,
        phase.id
      );
  return finish();
}
