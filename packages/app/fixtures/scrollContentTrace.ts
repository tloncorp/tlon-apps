export type ContentRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};
export type ContentPresentation = {
  connected: boolean;
  displayed: boolean;
  opacity: number;
  rect: ContentRect;
  clip: ContentRect;
};
export type ContentImage = {
  src: string;
  currentSrc: string;
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
  sameElement: boolean;
  presentation: ContentPresentation;
  frontmost: boolean;
};
export type ScrollContentSample = {
  time: number;
  scope: string;
  rowId: string | null;
  sameRow: boolean;
  list: ContentPresentation;
  row: ContentPresentation;
  imageFrame: ContentPresentation;
  caption: {
    count: number;
    text: string;
    presentation: ContentPresentation | null;
  };
  images: ContentImage[];
  fallbackPresent: boolean;
  measurement: { valid: boolean; durationMs: number };
};
export type ScrollContentTrace = {
  samples: ScrollContentSample[];
  events: {
    id: 'image-load' | 'image-decoded' | 'image-error';
    time: number;
    scope: string;
    src: string;
    currentSrc: string;
    originalTarget: boolean;
    trusted: boolean;
  }[];
  marks: { id: string; time: number }[];
  errors: string[];
};
export type ScrollContentContract = {
  scope: string;
  rowId: string;
  src: string;
  caption: string;
  coverage: {
    startTime: number;
    endTime: number;
    maxGapMs: number;
    maxMeasurementDurationMs: number;
  };
  releaseTime: number;
  terminalTime: number;
};

/** One same-props, unknown-size image at latest. DOM evidence is not paint. */
export function assessScrollContentTrace(
  trace: ScrollContentTrace,
  contract: ScrollContentContract
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
  const finish = () => ({
    verdict: issues.some((issue) => issue.kind === 'incomplete')
      ? 'INCOMPLETE'
      : issues.length
        ? 'FAIL'
        : 'PASS',
    passed: issues.length === 0,
    evidenceLevel: 'sampled-dom-content',
    nativePresentation: 'INCOMPLETE',
    issues,
    metrics: { samples: trace?.samples?.length ?? 0, maxGapMs },
  });
  if (
    !trace ||
    !Array.isArray(trace.samples) ||
    !Array.isArray(trace.events) ||
    !Array.isArray(trace.marks) ||
    !Array.isArray(trace.errors) ||
    trace.errors.length ||
    !contract?.coverage
  ) {
    add('invalid-capture', 'incomplete');
    return finish();
  }
  const { coverage, releaseTime, terminalTime } = contract;
  if (
    ![contract.scope, contract.rowId, contract.src, contract.caption].every(
      (value) => typeof value === 'string' && value.length > 0
    ) ||
    ![
      coverage.startTime,
      coverage.endTime,
      coverage.maxGapMs,
      coverage.maxMeasurementDurationMs,
      releaseTime,
      terminalTime,
    ].every(Number.isFinite) ||
    coverage.maxGapMs <= 0 ||
    coverage.maxGapMs > 100 ||
    coverage.maxMeasurementDurationMs < 0 ||
    coverage.maxMeasurementDurationMs > 32 ||
    releaseTime - coverage.startTime < 200 ||
    terminalTime <= releaseTime ||
    coverage.endTime !== terminalTime + 1000
  ) {
    add('invalid-fixed-contract', 'incomplete');
    return finish();
  }
  for (const [id, expectedTime] of [
    ['response-release', releaseTime],
    ['terminal-ready', terminalTime],
  ] as const) {
    const matches = trace.marks.filter((mark) => mark?.id === id);
    if (matches.length !== 1 || matches[0].time !== expectedTime)
      add('missing-causal-marker', 'incomplete');
  }
  if (
    trace.marks.length !== 2 ||
    trace.samples.length < 6 ||
    trace.samples[0]?.time !== coverage.startTime ||
    trace.samples.at(-1)!.time < coverage.endTime
  )
    add('missing-planned-coverage', 'incomplete');
  const load = trace.events.filter((event) => event?.id === 'image-load');
  const decoded = trace.events.filter((event) => event?.id === 'image-decoded');
  if (
    load.length !== 1 ||
    decoded.length !== 1 ||
    load[0].time < releaseTime ||
    decoded[0].time < load[0].time ||
    decoded[0].time > terminalTime
  )
    add('missing-real-load-decode', 'incomplete');
  if (trace.events.some((event) => event?.id === 'image-error'))
    add('image-load-error');
  if (
    trace.events.some(
      (event, index) => index > 0 && event?.time < trace.events[index - 1]?.time
    )
  )
    add('invalid-event-order', 'incomplete');
  if (
    trace.events.some(
      (event) =>
        !event ||
        !Number.isFinite(event.time) ||
        event.time < releaseTime ||
        event.time > coverage.endTime ||
        event.scope !== contract.scope ||
        event.src !== contract.src ||
        event.currentSrc !== contract.src ||
        event.originalTarget !== true ||
        event.trusted !== true ||
        !['image-load', 'image-decoded', 'image-error'].includes(event.id)
    )
  )
    add('invalid-image-event', 'incomplete');
  const validRect = (rect: ContentRect) =>
    rect &&
    ['left', 'right', 'top', 'bottom', 'width', 'height'].every((key) =>
      Number.isFinite(rect[key as keyof ContentRect])
    ) &&
    rect.width >= 0 &&
    rect.height >= 0 &&
    Math.abs(rect.right - rect.left - rect.width) <= 0.01 &&
    Math.abs(rect.bottom - rect.top - rect.height) <= 0.01;
  const validPresentation = (value: ContentPresentation | null) =>
    value &&
    typeof value.connected === 'boolean' &&
    typeof value.displayed === 'boolean' &&
    Number.isFinite(value.opacity) &&
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
    value.connected &&
    value.displayed &&
    exposed(value) &&
    Math.abs(value.opacity - 1) <= 0.01;
  let seenReady = false;
  let pendingSamples = 0;
  let terminalSamples = 0;
  for (const [index, sample] of trace.samples.entries()) {
    if (index) {
      const gap = sample?.time - trace.samples[index - 1]?.time;
      if (Number.isFinite(gap)) maxGapMs = Math.max(maxGapMs, gap);
      if (!Number.isFinite(gap) || gap <= 0 || gap > coverage.maxGapMs)
        add('capture-gap', 'incomplete', index);
    }
    if (
      !sample ||
      !Number.isFinite(sample.time) ||
      typeof sample.scope !== 'string' ||
      (sample.rowId !== null && typeof sample.rowId !== 'string') ||
      typeof sample.sameRow !== 'boolean' ||
      !sample.measurement ||
      sample.measurement.valid !== true ||
      !Number.isFinite(sample.measurement.durationMs) ||
      sample.measurement.durationMs < 0 ||
      sample.measurement.durationMs > coverage.maxMeasurementDurationMs ||
      ![sample.list, sample.row, sample.imageFrame].every(validPresentation) ||
      !sample.caption ||
      !Number.isInteger(sample.caption.count) ||
      typeof sample.caption.text !== 'string' ||
      (sample.caption.presentation !== null &&
        !validPresentation(sample.caption.presentation)) ||
      !Array.isArray(sample.images) ||
      sample.images.some(
        (image) =>
          !image ||
          typeof image.src !== 'string' ||
          typeof image.currentSrc !== 'string' ||
          typeof image.complete !== 'boolean' ||
          typeof image.sameElement !== 'boolean' ||
          typeof image.frontmost !== 'boolean' ||
          !Number.isFinite(image.naturalWidth) ||
          !Number.isFinite(image.naturalHeight) ||
          image.naturalWidth < 0 ||
          image.naturalHeight < 0 ||
          !validPresentation(image.presentation)
      ) ||
      typeof sample.fallbackPresent !== 'boolean'
    ) {
      add('invalid-sample', 'incomplete', index);
      continue;
    }
    if (
      sample.scope !== contract.scope ||
      sample.rowId !== contract.rowId ||
      sample.sameRow !== true
    )
      add('wrong-row-or-scope', 'failure', index);
    if (
      !visible(sample.list) ||
      !visible(sample.row) ||
      !visible(sample.imageFrame)
    )
      add('hidden-or-empty-reservation', 'failure', index);
    if (
      sample.caption.count !== 1 ||
      sample.caption.text !== contract.caption ||
      !sample.caption.presentation?.connected
    )
      add('caption-identity', 'failure', index);
    else if (
      exposed(sample.caption.presentation) &&
      !visible(sample.caption.presentation)
    )
      add('hidden-exposed-caption', 'failure', index);
    if (sample.fallbackPresent)
      add('unexpected-error-fallback', 'failure', index);
    if (sample.images.length !== 1) {
      add('missing-or-duplicate-image', 'failure', index);
      continue;
    }
    const image = sample.images[0];
    if (
      !image.sameElement ||
      image.src !== contract.src ||
      (image.currentSrc && image.currentSrc !== contract.src)
    )
      add('image-identity-or-source', 'failure', index);
    const ready =
      image.complete &&
      image.naturalWidth === 2 &&
      image.naturalHeight === 1 &&
      image.currentSrc === contract.src;
    const pending =
      !image.complete && image.naturalWidth === 0 && image.naturalHeight === 0;
    if (!ready && !pending) add('unexpected-image-content', 'failure', index);
    if (ready && !visible(image.presentation))
      add('hidden-image-element', 'failure', index);
    if (ready && !image.frontmost)
      add('image-region-occlusion-unqualified', 'incomplete', index);
    if (sample.time < releaseTime) {
      pendingSamples++;
      if (!pending) add('image-not-pending-before-release', 'failure', index);
    }
    if (seenReady && !ready) add('ready-content-reverted', 'failure', index);
    seenReady ||= ready;
    if (sample.time >= terminalTime) {
      terminalSamples++;
      if (!ready) add('terminal-image-not-ready', 'failure', index);
      if (
        ['left', 'top', 'right', 'bottom'].some(
          (edge) =>
            Math.abs(
              image.presentation.rect[edge as keyof ContentRect] -
                image.presentation.clip[edge as keyof ContentRect]
            ) > 1
        )
      )
        add('terminal-image-clipped', 'failure', index);
    }
  }
  if (pendingSamples < 3 || terminalSamples < 6 || !seenReady)
    add('phase-not-witnessed', 'incomplete');
  return finish();
}
