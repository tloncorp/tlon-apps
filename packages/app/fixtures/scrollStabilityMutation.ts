import type { ScrollSnapshot } from './scrollStabilityTrace';

export type RowMutationEvent = {
  time: number;
  name: string;
  values?: Record<string, number | string | boolean>;
};
export type RowMutationEvidence = {
  events: readonly RowMutationEvent[];
  samples: readonly ScrollSnapshot[];
  committedKeys?: readonly string[];
  contract?: RowMutationContract;
  semanticSamples?: readonly RowMutationSemanticSample[];
};
type LegacyRowMutationWitness = {
  observed: boolean;
  reasons: string[];
  key?: string;
  kind?: string;
  effectTime?: number;
};
export type RowMutationSignature = {
  content: string;
  reactions: string;
  replies: string | number;
};
export type RowMutationState =
  | { presence: 'present'; signature: RowMutationSignature }
  | { presence: 'absent' };
type MutationRevision = {
  /** Capture ownership; this does not assert a production/network request ID. */
  requestId: string;
  revision: string;
  state: RowMutationState;
};
export type RowMutationPhase = MutationRevision & {
  id: string;
  requestWindow: { startTime: number; endTime: number };
  observationWindow: { startTime: number; endTime: number };
  effect: 'commit' | 'resize' | 'remove';
};
export type RowMutationContract = {
  version: 1;
  scope: string;
  key: string;
  kind: string;
  declaredAt: number;
  baseline: MutationRevision;
  coverage: {
    startTime: number;
    endTime: number;
    maxGapMs: number;
    maxMeasurementDurationMs: number;
  };
  deferredUntil: number;
  phases: readonly RowMutationPhase[];
};
export type RowMutationSemanticSample = MutationRevision & {
  time: number;
  scope: string;
  key: string;
  commitId: string;
  committedKeys: readonly string[];
  measurement: { valid: boolean; durationMs: number };
};
export type RowMutationIssue = {
  code: string;
  kind: 'failure' | 'incomplete';
  time?: number;
  phaseId?: string;
};
export type RowMutationWitness = LegacyRowMutationWitness & {
  verdict: 'PASS' | 'FAIL' | 'INCOMPLETE';
  evidenceLevel: 'sampled-row-semantics' | 'legacy-first-effect';
  nativePresentation: 'INCOMPLETE';
  issues: RowMutationIssue[];
  legacyObserved?: boolean;
};

/** Stable serialization for the pre-action plan event, not an authenticity signature. */
export function rowMutationContractFingerprint(
  contract: RowMutationContract
): string {
  const stable = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(stable)
      : value !== null && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, item]) => [key, stable(item)])
          )
        : value;
  return JSON.stringify(stable(contract));
}

/** Strict sampled semantics. Historical first-effect inputs remain diagnostic only. */
export function assessRowMutationWitness(
  evidence: RowMutationEvidence
): RowMutationWitness {
  const issues: RowMutationIssue[] = [];
  const add = (
    code: string,
    kind: RowMutationIssue['kind'] = 'incomplete',
    time?: number,
    phaseId?: string
  ) => {
    issues.push({
      code,
      kind,
      ...(time === undefined ? {} : { time }),
      ...(phaseId ? { phaseId } : {}),
    });
  };
  const finish = (effectTime?: number): RowMutationWitness => {
    const verdict = issues.some((issue) => issue.kind === 'incomplete')
      ? 'INCOMPLETE'
      : issues.length
        ? 'FAIL'
        : 'PASS';
    return {
      observed: verdict === 'PASS',
      verdict,
      evidenceLevel: 'sampled-row-semantics',
      nativePresentation: 'INCOMPLETE',
      reasons: [...new Set(issues.map((issue) => issue.code))],
      issues,
      key: evidence?.contract?.key,
      kind: evidence?.contract?.kind,
      ...(effectTime === undefined ? {} : { effectTime }),
    };
  };
  if (!evidence?.contract) {
    let legacy: LegacyRowMutationWitness;
    try {
      legacy = assessLegacyRowMutationWitness(evidence);
    } catch {
      legacy = { observed: false, reasons: ['invalid-mutation-timeline'] };
    }
    return {
      ...legacy,
      observed: false,
      legacyObserved: legacy.observed,
      verdict: 'INCOMPLETE',
      evidenceLevel: 'legacy-first-effect',
      nativePresentation: 'INCOMPLETE',
      reasons: [...legacy.reasons, 'semantic-contract-required'],
      issues: [...legacy.reasons, 'semantic-contract-required'].map((code) => ({
        code,
        kind: 'incomplete',
      })),
    };
  }
  const {
    contract: plan,
    events,
    samples,
    semanticSamples: semantics,
  } = evidence;
  const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0;
  const stateValid = (state: unknown): state is RowMutationState =>
    object(state) &&
    (state.presence === 'absent' ||
      (state.presence === 'present' &&
        object(state.signature) &&
        typeof state.signature.content === 'string' &&
        typeof state.signature.reactions === 'string' &&
        (typeof state.signature.replies === 'string' ||
          (typeof state.signature.replies === 'number' &&
            Number.isFinite(state.signature.replies)))));
  const revisionValid = (revision: unknown): revision is MutationRevision =>
    object(revision) &&
    text(revision.requestId) &&
    text(revision.revision) &&
    stateValid(revision.state);
  const sameState = (a: RowMutationState, b: RowMutationState) =>
    a.presence === b.presence &&
    (a.presence === 'absent' ||
      (b.presence === 'present' &&
        a.signature.content === b.signature.content &&
        a.signature.reactions === b.signature.reactions &&
        a.signature.replies === b.signature.replies));
  const sameRevision = (a: MutationRevision, b: MutationRevision) =>
    a.requestId === b.requestId &&
    a.revision === b.revision &&
    sameState(a.state, b.state);
  const windowValid = (
    window: unknown
  ): window is { startTime: number; endTime: number } =>
    object(window) &&
    typeof window.startTime === 'number' &&
    typeof window.endTime === 'number' &&
    Number.isFinite(window.startTime) &&
    Number.isFinite(window.endTime) &&
    window.endTime >= window.startTime;
  const coverage = plan.coverage;
  if (
    !object(plan) ||
    plan.version !== 1 ||
    !text(plan.scope) ||
    !text(plan.key) ||
    ![
      'grow',
      'shrink',
      'media',
      'reference',
      'reaction',
      'reply',
      'cache',
      'remove',
    ].includes(plan.kind) ||
    !Number.isFinite(plan.declaredAt) ||
    !revisionValid(plan.baseline) ||
    plan.baseline.state.presence !== 'present' ||
    !windowValid(coverage) ||
    !Number.isFinite(coverage.maxGapMs) ||
    coverage.maxGapMs <= 0 ||
    coverage.maxGapMs > 125 ||
    !Number.isFinite(coverage.maxMeasurementDurationMs) ||
    coverage.maxMeasurementDurationMs < 0 ||
    coverage.maxMeasurementDurationMs > 32 ||
    !Number.isFinite(plan.deferredUntil) ||
    plan.deferredUntil < coverage.startTime ||
    !Array.isArray(plan.phases) ||
    !plan.phases.length ||
    plan.phases.some(
      (phase: RowMutationPhase, index: number) =>
        !revisionValid(phase) ||
        !text(phase.id) ||
        !windowValid(phase.requestWindow) ||
        !windowValid(phase.observationWindow) ||
        phase.requestWindow.startTime <
          (index
            ? plan.phases[index - 1]?.observationWindow?.endTime
            : coverage.startTime + 200) ||
        phase.requestWindow.endTime >= phase.observationWindow.startTime ||
        phase.observationWindow.endTime - phase.observationWindow.startTime <
          200 ||
        phase.observationWindow.endTime > coverage.endTime ||
        !['commit', 'resize', 'remove'].includes(phase.effect) ||
        (phase.effect === 'remove') !== (phase.state.presence === 'absent') ||
        sameState(
          phase.state,
          index ? plan.phases[index - 1]?.state : plan.baseline.state
        )
    ) ||
    plan.declaredAt >= plan.phases[0].requestWindow.startTime ||
    new Set(plan.phases.map((phase) => phase.id)).size !== plan.phases.length ||
    new Set([
      plan.baseline.requestId,
      ...plan.phases.map((phase) => phase.requestId),
    ]).size !==
      plan.phases.length + 1 ||
    new Set([
      plan.baseline.revision,
      ...plan.phases.map((phase) => phase.revision),
    ]).size !==
      plan.phases.length + 1 ||
    plan.phases.at(-1)!.observationWindow.endTime !== coverage.endTime ||
    coverage.endTime -
      Math.max(
        plan.phases.at(-1)!.observationWindow.startTime,
        plan.deferredUntil
      ) <
      1000
  ) {
    add('invalid-predeclared-semantic-plan');
    return finish();
  }
  if (
    !Array.isArray(events) ||
    !Array.isArray(samples) ||
    !samples.length ||
    !Array.isArray(semantics) ||
    semantics.length !== samples.length
  ) {
    add('missing-continuous-semantic-capture');
    return finish();
  }
  const keysValid = (keys: unknown): keys is readonly string[] =>
    Array.isArray(keys) &&
    keys.every(text) &&
    new Set(keys).size === keys.length;
  const coherent = (measurement: unknown) =>
    object(measurement) &&
    measurement.valid === true &&
    typeof measurement.durationMs === 'number' &&
    Number.isFinite(measurement.durationMs) &&
    measurement.durationMs >= 0 &&
    measurement.durationMs <= coverage.maxMeasurementDurationMs;
  if (
    samples[0]?.time !== coverage.startTime ||
    samples.at(-1)?.time < coverage.endTime ||
    samples.some(
      (sample, index) =>
        !sample ||
        !Number.isFinite(sample.time) ||
        !Array.isArray(sample.rows) ||
        !coherent(sample.measurement) ||
        (index > 0 &&
          (sample.time <= samples[index - 1].time ||
            sample.time - samples[index - 1].time > coverage.maxGapMs))
    ) ||
    semantics.some(
      (sample: RowMutationSemanticSample, index: number) =>
        !sample ||
        sample.time !== samples[index]?.time ||
        !revisionValid(sample) ||
        !text(sample.commitId) ||
        !text(sample.scope) ||
        !text(sample.key) ||
        !keysValid(sample.committedKeys) ||
        !coherent(sample.measurement)
    ) ||
    events.some(
      (event, index) =>
        !event ||
        !text(event.name) ||
        !Number.isFinite(event.time) ||
        event.time > samples.at(-1)!.time ||
        (index > 0 && event.time < events[index - 1].time)
    )
  ) {
    add('invalid-semantic-or-geometry-capture');
    return finish();
  }
  const declarations = events.filter(
    (event) => event.name === 'row-mutation-plan'
  );
  if (
    declarations.length !== 1 ||
    declarations[0].time !== plan.declaredAt ||
    declarations[0].values?.contract !== rowMutationContractFingerprint(plan)
  ) {
    add('semantic-plan-not-declared-before-action');
    return finish();
  }
  const requests = events.filter(
    (event) => event.name === 'row-mutation-request'
  );
  const requestFor = plan.phases.map((phase) =>
    requests.filter((event) => event.values?.phaseId === phase.id)
  );
  if (
    requests.length !== plan.phases.length ||
    requestFor.some((matches, index) => {
      const phase = plan.phases[index];
      const request = matches[0];
      return (
        matches.length !== 1 ||
        request.values?.scope !== plan.scope ||
        request.values?.key !== plan.key ||
        request.values?.kind !== plan.kind ||
        request.values?.requestId !== phase.requestId ||
        request.values?.revision !== phase.revision ||
        request.time < phase.requestWindow.startTime ||
        request.time > phase.requestWindow.endTime ||
        request.time <= plan.declaredAt
      );
    })
  ) {
    add('required-scoped-phase-request-not-witnessed');
    return finish();
  }
  const stateOf = (event: RowMutationEvent): RowMutationState =>
    event.name === 'row-detached'
      ? { presence: 'absent' }
      : {
          presence: 'present',
          signature: {
            content: event.values?.content as string,
            reactions: event.values?.reactions as string,
            replies: event.values?.replies as string | number,
          },
        };
  const commits = events.filter(
    (event) =>
      ['row-commit', 'row-detached'].includes(event.name) &&
      event.values?.key === plan.key
  );
  if (
    !commits.length ||
    commits.some(
      (event) =>
        !text(event.values?.commitId) ||
        !text(event.values?.requestId) ||
        !text(event.values?.revision) ||
        event.values?.scope !== plan.scope ||
        !stateValid(stateOf(event))
    ) ||
    new Set(commits.map((event) => event.values!.commitId)).size !==
      commits.length
  ) {
    add('invalid-scoped-render-commit-ledger');
    return finish();
  }
  const revisionOf = (event: RowMutationEvent): MutationRevision => ({
    requestId: event.values!.requestId as string,
    revision: event.values!.revision as string,
    state: stateOf(event),
  });
  const rowAt = (sample: ScrollSnapshot) =>
    sample.rows.filter((row) => row?.key === plan.key);
  const firstRows = rowAt(samples[0]);
  if (
    firstRows.length !== 1 ||
    !Number.isFinite(firstRows[0].y) ||
    !Number.isFinite(firstRows[0].height) ||
    firstRows[0].height <= 0 ||
    !Number.isFinite(samples[0].viewportTop) ||
    !Number.isFinite(samples[0].viewportBottom) ||
    firstRows[0].y >= samples[0].viewportBottom ||
    firstRows[0].y + firstRows[0].height <= samples[0].viewportTop ||
    !sameRevision(semantics[0], plan.baseline)
  )
    add('mutation-target-not-measured-at-semantic-baseline');
  for (const [index, semantic] of semantics.entries()) {
    const latest = commits
      .filter((event) => event.time <= semantic.time)
      .at(-1);
    if (
      !latest ||
      latest.values?.commitId !== semantic.commitId ||
      !sameRevision(revisionOf(latest), semantic)
    )
      add(
        'semantic-sample-does-not-reference-latest-render',
        'incomplete',
        semantic.time
      );
    if (semantic.scope !== plan.scope || semantic.key !== plan.key)
      add('wrong-semantic-sample-scope-or-row', 'failure', semantic.time);
    const rows = rowAt(samples[index]);
    if (semantic.state.presence === 'present') {
      if (
        !semantic.committedKeys.includes(plan.key) ||
        rows.length !== 1 ||
        !Number.isFinite(rows[0].height) ||
        rows[0].height <= 0 ||
        !Number.isFinite(rows[0].y)
      )
        add(
          'present-revision-not-independently-measured',
          'incomplete',
          semantic.time
        );
    } else if (semantic.committedKeys.includes(plan.key) || rows.length)
      add('removed-revision-still-present', 'failure', semantic.time);
  }
  if (
    evidence.committedKeys &&
    (!keysValid(evidence.committedKeys) ||
      [...evidence.committedKeys].sort().join('\n') !==
        [...semantics.at(-1)!.committedKeys].sort().join('\n'))
  )
    add('final-data-membership-contradicts-semantic-capture');

  const advanced = plan.phases.map(() => false);
  const points = [
    ...commits.map((event, order) => ({
      time: event.time,
      revision: revisionOf(event),
      order,
    })),
    ...semantics.map((sample, index) => ({
      time: sample.time,
      revision: sample,
      order: commits.length + index,
    })),
  ].sort((a, b) => a.time - b.time || a.order - b.order);
  for (const point of points) {
    if (point.time < coverage.startTime) continue;
    const phaseIndex = requestFor.findLastIndex(
      (matches) => matches[0].time <= point.time
    );
    if (phaseIndex < 0) {
      if (!sameRevision(point.revision, plan.baseline))
        add('baseline-revision-changed-before-request', 'failure', point.time);
      continue;
    }
    const phase = plan.phases[phaseIndex];
    const previous = phaseIndex ? plan.phases[phaseIndex - 1] : plan.baseline;
    if (sameRevision(point.revision, phase)) advanced[phaseIndex] = true;
    else if (
      advanced[phaseIndex] ||
      point.time >= phase.observationWindow.startTime ||
      !sameRevision(point.revision, previous)
    )
      add(
        'stale-skipped-or-undeclared-semantic-revision',
        'failure',
        point.time,
        phase.id
      );
  }
  let effectTime: number | undefined;
  for (const [index, phase] of plan.phases.entries()) {
    const request = requestFor[index][0];
    const phaseSamples = semantics.filter(
      (sample) =>
        sample.time >= phase.observationWindow.startTime &&
        (index === plan.phases.length - 1
          ? sample.time <= phase.observationWindow.endTime
          : sample.time < phase.observationWindow.endTime)
    );
    const rendered = commits.filter(
      (event) =>
        event.time >= request.time &&
        event.time <= phase.observationWindow.startTime &&
        sameRevision(revisionOf(event), phase)
    );
    if (
      !rendered.length ||
      phaseSamples.length < (index === plan.phases.length - 1 ? 6 : 3) ||
      !phaseSamples.some((sample) => sameRevision(sample, phase))
    ) {
      add(
        'required-phase-not-observed-before-supersession',
        'incomplete',
        undefined,
        phase.id
      );
      continue;
    }
    const commit = rendered[0];
    effectTime = Math.max(effectTime ?? commit.time, commit.time);
    if (phase.effect === 'resize') {
      const before = samples
        .filter((sample) => sample.time < request.time)
        .at(-1);
      const beforeRows = before ? rowAt(before) : [];
      const firstStable = samples.find(
        (sample) => sample.time === phaseSamples[0].time
      )!;
      const afterRows = rowAt(firstStable);
      const layout = events.find(
        (event) =>
          event.name === 'row-layout' &&
          event.values?.key === plan.key &&
          event.values.scope === plan.scope &&
          event.values.requestId === phase.requestId &&
          event.values.revision === phase.revision &&
          rendered.some(
            (render) =>
              render.values!.commitId === event.values?.commitId &&
              render.time <= event.time
          ) &&
          event.time <= phase.observationWindow.startTime &&
          typeof event.values.height === 'number' &&
          Number.isFinite(event.values.height) &&
          afterRows.length === 1 &&
          Math.abs(afterRows[0].height - event.values.height) <= 1
      );
      if (
        !layout ||
        beforeRows.length !== 1 ||
        afterRows.length !== 1 ||
        Math.abs(afterRows[0].height - beforeRows[0].height) <= 1
      )
        add(
          'phase-size-effect-not-measured-by-deadline',
          'incomplete',
          undefined,
          phase.id
        );
      else effectTime = Math.max(effectTime!, layout.time);
    }
  }
  const baselineSamples = semantics.filter(
    (sample) => sample.time < requestFor[0][0].time
  );
  if (baselineSamples.length < 3) add('baseline-semantic-phase-not-witnessed');
  return finish(effectTime);
}

/** Proves that the selected real row received and rendered the requested change. */
function assessLegacyRowMutationWitness({
  events,
  samples,
  committedKeys,
}: RowMutationEvidence): LegacyRowMutationWitness {
  const missing = (reason: string) => ({ observed: false, reasons: [reason] });
  if (
    !samples.length ||
    events.some(
      (event, index) =>
        !Number.isFinite(event.time) ||
        event.time < samples[0].time ||
        (index > 0 && event.time < events[index - 1].time)
    )
  )
    return missing('invalid-mutation-timeline');
  const requests = events.filter(
    (event) => event.name === 'row-mutation-request'
  );
  if (requests.length !== 1)
    return missing('exactly-one-mutation-request-required');
  const request = requests[0];
  const key = request.values?.key;
  const kind = request.values?.kind;
  if (
    typeof key !== 'string' ||
    !key ||
    typeof kind !== 'string' ||
    ![
      'grow',
      'shrink',
      'media',
      'reference',
      'reaction',
      'reply',
      'cache',
      'remove',
    ].includes(kind)
  )
    return missing('mutation-identity-missing');
  const coherent = (sample: ScrollSnapshot) =>
    sample.measurement?.valid === true &&
    Number.isFinite(sample.measurement.durationMs) &&
    sample.measurement.durationMs >= 0 &&
    sample.measurement.durationMs <= 32;
  const baseline = samples[0];
  const baselineRows = baseline.rows.filter((row) => row.key === key);
  const row = baselineRows[0];
  if (
    !coherent(baseline) ||
    baselineRows.length !== 1 ||
    !row ||
    !Number.isFinite(row.height) ||
    row.height <= 0 ||
    row.y >= baseline.viewportBottom ||
    row.y + row.height <= baseline.viewportTop
  )
    return missing('mutation-target-not-measured-at-baseline');
  if (!committedKeys || new Set(committedKeys).size !== committedKeys.length)
    return missing('committed-data-unmeasured');
  if (kind === 'remove') {
    const detached = events.find(
      (event) =>
        event.name === 'row-detached' &&
        event.values?.key === key &&
        event.time >= request.time
    );
    const final = samples.at(-1)!;
    if (
      !detached ||
      committedKeys.includes(key) ||
      !coherent(final) ||
      final.time < detached.time ||
      final.rows.some((candidate) => candidate.key === key)
    )
      return missing('target-removal-not-witnessed');
    return {
      observed: true,
      reasons: [],
      key,
      kind,
      effectTime: detached.time,
    };
  }
  if (!committedKeys.includes(key))
    return missing('mutation-target-not-in-committed-data');
  const fields = ['content', 'reactions', 'replies'] as const;
  if (
    fields.some(
      (field) =>
        request.values?.[`expected-${field}`] === undefined ||
        request.values?.[`previous-${field}`] === undefined
    ) ||
    fields.every(
      (field) =>
        request.values?.[`expected-${field}`] ===
        request.values?.[`previous-${field}`]
    )
  )
    return missing('expected-mutation-is-missing-or-unchanged');
  const changedField =
    kind === 'reaction'
      ? 'reactions'
      : kind === 'reply'
        ? 'replies'
        : 'content';
  if (
    request.values?.[`expected-${changedField}`] ===
    request.values?.[`previous-${changedField}`]
  )
    return missing('intended-mutation-field-unchanged');
  const commit = events.find(
    (event) =>
      event.name === 'row-commit' &&
      event.time >= request.time &&
      event.values?.key === key &&
      fields.every(
        (field) =>
          event.values?.[field] === request.values?.[`expected-${field}`]
      )
  );
  if (!commit) return missing('expected-row-content-not-committed');
  const measured = samples.flatMap((sample) => {
    const matches = sample.rows.filter((candidate) => candidate.key === key);
    const candidate = matches[0];
    return coherent(sample) &&
      sample.time >= commit.time &&
      matches.length === 1 &&
      candidate &&
      Number.isFinite(candidate.height) &&
      candidate.height > 0
      ? [{ time: sample.time, height: candidate.height }]
      : [];
  });
  if (!measured.length) return missing('committed-row-not-measured');
  // These cases explicitly promise a size transition. No target height or
  // direction is assumed: real content/rendering can choose either direction.
  if (
    ['grow', 'shrink', 'media', 'cache', 'reaction', 'reply'].includes(kind)
  ) {
    const layout = events.find(
      (event) =>
        event.name === 'row-layout' &&
        event.time >= request.time &&
        event.values?.key === key &&
        typeof event.values?.height === 'number' &&
        Number.isFinite(event.values.height) &&
        Math.abs(event.values.height - row.height) > 1 &&
        measured.some(
          (sample) =>
            sample.time >= event.time &&
            Math.abs(sample.height - Number(event.values!.height)) <= 1 &&
            Math.abs(sample.height - row.height) > 1
        )
    );
    if (!layout) return missing('expected-row-size-transition-not-measured');
    return {
      observed: true,
      reasons: [],
      key,
      kind,
      effectTime: Math.max(commit.time, layout.time),
    };
  }
  return { observed: true, reasons: [], key, kind, effectTime: commit.time };
}
