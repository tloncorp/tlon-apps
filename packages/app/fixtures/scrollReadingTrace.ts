import type { ContentPresentation, ContentRect } from './scrollContentTrace';

export type ReadingHit = {
  x: number;
  y: number;
  stack: { relation: 'owner' | 'ancestor' | 'foreign'; tag: string }[];
};
export type ReadingFragment = {
  presentation: ContentPresentation;
  textAlpha: number;
  pointerEvents: string;
  hits: ReadingHit[];
};
export type ReadingSample = {
  time: number;
  scope: string;
  rowId: string | null;
  sameRow: boolean;
  sameBlock: boolean;
  blockCount: number;
  text: string;
  list: ContentPresentation;
  row: ContentPresentation;
  block: ContentPresentation;
  nodes: {
    text: string;
    start: number;
    end: number;
    fragments: ReadingFragment[];
  }[];
  point: null | {
    start: number;
    end: number;
    text: string;
    relativeX: number;
    relativeY: number;
    fragment: ReadingFragment;
  };
  measurement: { valid: boolean; durationMs: number };
  /** Optional scenario-authored text witnesses elsewhere in the same post. */
  observations?: {
    text: string;
    count: number;
    fragments: ReadingFragment[];
  }[];
  elements?: {
    selector: string;
    count: number;
    texts: string[];
    fragments: ReadingFragment[];
  }[];
};
export type ScrollReadingTrace = {
  blockSelector: string;
  /** Selector is acquisition only; subsequent identity is the retained element. */
  blockAcquisition?: 'retained-element';
  point: { start: number; end: number };
  samples: ReadingSample[];
  errors: string[];
  marks: { id: string; time: number }[];
};
export type ScrollReadingContract = {
  scope: string;
  rowId: string;
  blockSelector: string;
  revision: { id: string; text: string };
  point: {
    start: number;
    end: number;
    x: number;
    y: number;
    tolerancePx: number;
  };
  coverage: {
    startTime: number;
    endTime: number;
    maxGapMs: number;
    maxMeasurementDurationMs: number;
  };
  terminalTime: number;
};

/** A stationary text revision and character point. This does not measure paint. */
export function assessScrollReadingTrace(
  trace: ScrollReadingTrace,
  contract: ScrollReadingContract
) {
  const issues: {
    code: string;
    kind: 'failure' | 'incomplete';
    sampleIndex?: number;
  }[] = [];
  const add = (
    code: string,
    kind: 'failure' | 'incomplete' = 'failure',
    sampleIndex?: number
  ) => issues.push({ code, kind, sampleIndex });
  let maxGapMs = 0;
  let maxPointDisplacementPx = 0;
  const finish = () => ({
    verdict: issues.some((issue) => issue.kind === 'incomplete')
      ? 'INCOMPLETE'
      : issues.length
        ? 'FAIL'
        : 'PASS',
    passed: issues.length === 0,
    evidenceLevel: 'sampled-dom-text-and-reading-point',
    presentedFrames: 'INCOMPLETE',
    issues,
    metrics: {
      samples: trace?.samples?.length ?? 0,
      maxGapMs,
      maxPointDisplacementPx,
    },
  });
  const finite = (values: unknown[]) =>
    values.every(
      (value) => typeof value === 'number' && Number.isFinite(value)
    );
  const nonempty = (value: unknown) =>
    typeof value === 'string' && value.length > 0;
  if (
    !trace ||
    !Array.isArray(trace.samples) ||
    !Array.isArray(trace.errors) ||
    trace.errors.length ||
    !Array.isArray(trace.marks) ||
    !contract?.coverage ||
    !contract.point ||
    !contract.revision
  ) {
    add('invalid-capture', 'incomplete');
    return finish();
  }
  const { coverage, point, revision, terminalTime } = contract;
  const splitsSurrogate = (offset: number) =>
    offset > 0 &&
    /[\uD800-\uDBFF]/.test(revision.text[offset - 1]) &&
    /[\uDC00-\uDFFF]/.test(revision.text[offset]);
  if (
    ![
      contract.scope,
      contract.rowId,
      contract.blockSelector,
      revision.id,
      revision.text,
    ].every(nonempty) ||
    !finite([
      coverage.startTime,
      coverage.endTime,
      coverage.maxGapMs,
      coverage.maxMeasurementDurationMs,
      terminalTime,
      point.start,
      point.end,
      point.x,
      point.y,
      point.tolerancePx,
    ]) ||
    coverage.startTime < 0 ||
    terminalTime - coverage.startTime < 200 ||
    coverage.endTime !== terminalTime + 1000 ||
    coverage.maxGapMs <= 0 ||
    coverage.maxGapMs > 100 ||
    coverage.maxMeasurementDurationMs < 0 ||
    coverage.maxMeasurementDurationMs > 32 ||
    point.tolerancePx < 0 ||
    point.tolerancePx > 1 ||
    !Number.isInteger(point.start) ||
    !Number.isInteger(point.end) ||
    point.start < 0 ||
    point.end <= point.start ||
    point.end > revision.text.length ||
    !revision.text.slice(point.start, point.end).trim() ||
    splitsSurrogate(point.start) ||
    splitsSurrogate(point.end)
  ) {
    add('invalid-fixed-contract', 'incomplete');
    return finish();
  }
  if (
    trace.blockSelector !== contract.blockSelector ||
    trace.point?.start !== point.start ||
    trace.point?.end !== point.end
  )
    add('capture-contract-mismatch', 'incomplete');
  if (
    trace.marks.length !== 1 ||
    trace.marks[0]?.id !== 'terminal-ready' ||
    trace.marks[0]?.time !== terminalTime
  )
    add('missing-terminal-marker', 'incomplete');
  if (
    trace.samples.length < 6 ||
    trace.samples[0]?.time !== coverage.startTime ||
    (trace.samples.at(-1)?.time ?? -1) < coverage.endTime
  )
    add('missing-planned-coverage', 'incomplete');
  const validRect = (rect: ContentRect) =>
    rect &&
    finite([
      rect.left,
      rect.top,
      rect.right,
      rect.bottom,
      rect.width,
      rect.height,
    ]) &&
    rect.width >= 0 &&
    rect.height >= 0 &&
    Math.abs(rect.right - rect.left - rect.width) <= 0.01 &&
    Math.abs(rect.bottom - rect.top - rect.height) <= 0.01;
  const validPresentation = (value: ContentPresentation) =>
    value &&
    typeof value.connected === 'boolean' &&
    typeof value.displayed === 'boolean' &&
    finite([value.opacity]) &&
    value.opacity >= 0 &&
    value.opacity <= 1 &&
    validRect(value.rect) &&
    validRect(value.clip) &&
    (value.clip.width === 0 ||
      value.clip.height === 0 ||
      (value.clip.left >= value.rect.left - 0.01 &&
        value.clip.top >= value.rect.top - 0.01 &&
        value.clip.right <= value.rect.right + 0.01 &&
        value.clip.bottom <= value.rect.bottom + 0.01));
  const exposed = (value: ContentPresentation) =>
    value.clip.width > 0 && value.clip.height > 0;
  const visible = (value: ContentPresentation) =>
    value.connected && value.displayed && Math.abs(value.opacity - 1) <= 0.01;
  const validFragment = (fragment: ReadingFragment) =>
    fragment &&
    validPresentation(fragment.presentation) &&
    finite([fragment.textAlpha]) &&
    fragment.textAlpha >= 0 &&
    fragment.textAlpha <= 1 &&
    nonempty(fragment.pointerEvents) &&
    Array.isArray(fragment.hits) &&
    fragment.hits.every(
      (hit) =>
        hit &&
        finite([hit.x, hit.y]) &&
        Array.isArray(hit.stack) &&
        hit.stack.every(
          (entry) =>
            entry &&
            ['owner', 'ancestor', 'foreign'].includes(entry.relation) &&
            nonempty(entry.tag)
        )
    );
  const checkFragment = (
    fragment: ReadingFragment,
    index: number,
    required: boolean
  ) => {
    const { presentation, hits } = fragment;
    if (!visible(presentation) || fragment.textAlpha < 0.99) {
      if (required || exposed(presentation))
        add('hidden-text', 'failure', index);
    }
    if (!exposed(presentation)) {
      if (required) add('reading-point-clipped', 'failure', index);
      if (hits.length) add('invalid-hit-witness', 'incomplete', index);
      return;
    }
    if (
      required &&
      (presentation.clip.left - presentation.rect.left > 1 ||
        presentation.clip.top - presentation.rect.top > 1 ||
        presentation.rect.right - presentation.clip.right > 1 ||
        presentation.rect.bottom - presentation.clip.bottom > 1)
    )
      add('reading-point-clipped', 'failure', index);
    const clip = presentation.clip;
    if (
      hits.length !== 3 ||
      hits.some(
        (hit, hitIndex) =>
          Math.abs(
            hit.x - (clip.left + clip.width * [0.1, 0.5, 0.9][hitIndex])
          ) > 0.01 ||
          Math.abs(hit.y - (clip.top + clip.height / 2)) > 0.01 ||
          hit.stack.length === 0
      )
    ) {
      add('missing-hit-witness', 'incomplete', index);
    } else if (
      hits.some(
        (hit) =>
          hit.stack[0].relation !== 'owner' &&
          !(
            fragment.pointerEvents === 'none' &&
            hit.stack[0].relation === 'ancestor'
          )
      )
    ) {
      add('text-obstructed', 'failure', index);
    }
  };
  let tailSamples = 0;
  for (const [index, sample] of trace.samples.entries()) {
    if (index) {
      const gap = sample?.time - trace.samples[index - 1]?.time;
      if (Number.isFinite(gap)) maxGapMs = Math.max(maxGapMs, gap);
      if (!Number.isFinite(gap) || gap <= 0 || gap > coverage.maxGapMs)
        add('capture-gap', 'incomplete', index);
    }
    if (
      !sample ||
      !finite([sample.time]) ||
      sample.time < coverage.startTime ||
      typeof sample.scope !== 'string' ||
      (sample.rowId !== null && typeof sample.rowId !== 'string') ||
      typeof sample.sameRow !== 'boolean' ||
      typeof sample.sameBlock !== 'boolean' ||
      !Number.isInteger(sample.blockCount) ||
      sample.blockCount < 0 ||
      typeof sample.text !== 'string' ||
      ![sample.list, sample.row, sample.block].every(validPresentation) ||
      !Array.isArray(sample.nodes) ||
      !sample.measurement ||
      sample.measurement.valid !== true ||
      !finite([sample.measurement.durationMs]) ||
      sample.measurement.durationMs < 0 ||
      sample.measurement.durationMs > coverage.maxMeasurementDurationMs ||
      sample.nodes.some(
        (node) =>
          !node ||
          typeof node.text !== 'string' ||
          !Number.isInteger(node.start) ||
          !Number.isInteger(node.end) ||
          !Array.isArray(node.fragments) ||
          !node.fragments.every(validFragment)
      ) ||
      (sample.point !== null &&
        (!sample.point ||
          !finite([
            sample.point.start,
            sample.point.end,
            sample.point.relativeX,
            sample.point.relativeY,
          ]) ||
          typeof sample.point.text !== 'string' ||
          !validFragment(sample.point.fragment)))
    ) {
      add('invalid-sample', 'incomplete', index);
      continue;
    }
    if (sample.time >= terminalTime && sample.time <= coverage.endTime)
      tailSamples++;
    if (sample.scope !== contract.scope || sample.rowId !== contract.rowId)
      add('content-identity-changed', 'failure', index);
    if (!sample.sameRow || !sample.sameBlock) {
      // A same-looking clone is not itself a visible defect. This bounded
      // retained-handle measurement cannot establish continuity across it.
      add('content-acquisition-lost', 'incomplete', index);
      continue;
    }
    if (sample.blockCount !== 1)
      add('ambiguous-content-acquisition', 'incomplete', index);
    if (sample.text !== revision.text)
      add('unexpected-text-revision', 'failure', index);
    let offset = 0;
    for (const node of sample.nodes) {
      if (node.start !== offset || node.end !== offset + node.text.length)
        add('invalid-text-inventory', 'incomplete', index);
      offset += node.text.length;
      if (node.text.trim() && node.fragments.length === 0)
        add('missing-text-layout', 'failure', index);
      for (const fragment of node.fragments)
        checkFragment(fragment, index, false);
    }
    if (sample.nodes.map((node) => node.text).join('') !== sample.text)
      add('invalid-text-inventory', 'incomplete', index);
    if (
      ![sample.list, sample.row, sample.block].every(visible) ||
      !exposed(sample.list) ||
      !exposed(sample.row) ||
      !exposed(sample.block)
    )
      add('hidden-content-container', 'failure', index);
    if (sample.point === null) {
      add('missing-reading-point', 'failure', index);
      continue;
    }
    const actual = sample.point;
    if (
      actual.start !== point.start ||
      actual.end !== point.end ||
      actual.text !== revision.text.slice(point.start, point.end)
    )
      add('reading-point-identity-changed', 'failure', index);
    const rect = actual.fragment.presentation.rect;
    const owner = sample.nodes.find(
      (node) => node.start <= actual.start && node.end >= actual.end
    );
    if (
      !owner ||
      !owner.fragments.some((fragment) => {
        const outer = fragment.presentation.rect;
        return (
          rect.left >= outer.left - 0.01 &&
          rect.top >= outer.top - 0.01 &&
          rect.right <= outer.right + 0.01 &&
          rect.bottom <= outer.bottom + 0.01
        );
      })
    )
      add('reading-point-not-in-text-layout', 'incomplete', index);
    if (
      Math.abs(actual.relativeX - (rect.left - sample.list.rect.left)) > 0.01 ||
      Math.abs(actual.relativeY - (rect.top - sample.list.rect.top)) > 0.01
    )
      add('invalid-reading-point-coordinates', 'incomplete', index);
    const displacement = Math.max(
      Math.abs(actual.relativeX - point.x),
      Math.abs(actual.relativeY - point.y)
    );
    maxPointDisplacementPx = Math.max(maxPointDisplacementPx, displacement);
    if (displacement > point.tolerancePx)
      add('reading-point-moved', 'failure', index);
    checkFragment(actual.fragment, index, true);
  }
  if (tailSamples < 6) add('missing-terminal-tail', 'incomplete');
  return finish();
}

/** Observing an injected fault never qualifies continuous product stability. */
export function assessInjectedReadingFault(
  trace: ScrollReadingTrace,
  contract: ScrollReadingContract,
  fault: { code: string; appliedAt: number; restoredAt: number }
) {
  const assessment = assessScrollReadingTrace(trace, contract);
  const baseline = trace?.samples?.[0];
  const validWindow =
    baseline &&
    typeof fault?.code === 'string' &&
    fault.code.length > 0 &&
    Number.isFinite(fault.appliedAt) &&
    Number.isFinite(fault.restoredAt) &&
    !assessment.issues.some(
      (issue) =>
        issue.sampleIndex === 0 ||
        [
          'invalid-capture',
          'invalid-fixed-contract',
          'capture-contract-mismatch',
        ].includes(issue.code)
    ) &&
    fault.appliedAt >= baseline.time &&
    fault.restoredAt > fault.appliedAt &&
    fault.restoredAt <= contract.terminalTime;
  const witnesses = validWindow
    ? assessment.issues
        .filter((issue) => {
          if (
            issue.kind !== 'failure' ||
            issue.code !== fault.code ||
            issue.sampleIndex === undefined
          )
            return false;
          const index = issue.sampleIndex;
          const sample = trace.samples[index];
          if (
            !sample ||
            sample.time < fault.appliedAt ||
            sample.time > fault.restoredAt ||
            sample.sameRow !== true ||
            sample.rowId !== contract.rowId ||
            sample.scope !== contract.scope
          )
            return false;
          // A gap limits continuity. A malformed sample cannot even prove detection.
          if (
            assessment.issues.some(
              (other) =>
                other.kind === 'incomplete' &&
                other.sampleIndex === index &&
                other.code !== 'capture-gap'
            )
          )
            return false;
          return (['left', 'top', 'width', 'height'] as const).every(
            (key) =>
              Math.abs(sample.row.rect[key] - baseline.row.rect[key]) <=
              contract.point.tolerancePx
          );
        })
        .map((issue) => ({
          code: issue.code,
          sampleIndex: issue.sampleIndex!,
          time: trace.samples[issue.sampleIndex!].time,
        }))
    : [];
  return {
    detected: witnesses.length > 0,
    evidenceLevel: 'injected-dom-fault-detection',
    continuityVerdict: assessment.verdict,
    productCoverage: false,
    witnesses,
    assessment,
  };
}
