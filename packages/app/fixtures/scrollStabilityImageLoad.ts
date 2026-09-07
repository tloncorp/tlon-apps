export type ImageLoadEvent = {
  time: number;
  name: string;
  values?: Record<string, number | string | boolean>;
};

export type ImageLoadGate = {
  key: string;
  src: string;
  token: string;
  pendingAt: number;
  requested: true;
  released: false;
};

export type ImageLoadInteraction = 'gesture' | 'keyboard' | 'composer';

type Interval = { startTime: number; endTime: number };

export function imageGestureDisplacementErrorPt({
  rowDelta,
  scrollDelta,
  viewportDelta,
  imageHeightDelta,
  imageBeforeWitness,
}: {
  rowDelta: number;
  scrollDelta: number;
  viewportDelta: number;
  imageHeightDelta: number;
  imageBeforeWitness: boolean;
}): number | undefined {
  if (
    ![rowDelta, scrollDelta, viewportDelta, imageHeightDelta].every(
      Number.isFinite
    )
  )
    return undefined;
  return Math.abs(
    rowDelta +
      scrollDelta -
      viewportDelta -
      (imageBeforeWitness ? imageHeightDelta : 0)
  );
}

/** A causal native-load witness, independent of viewport stability assertions. */
export function assessImageLoadWitness({
  events,
  gate,
  recordingStartTime,
  baselineHeight,
  baselineComposerHeight,
  propsUnchanged,
  measurements,
  interaction,
}: {
  events: readonly ImageLoadEvent[];
  gate?: ImageLoadGate;
  recordingStartTime: number;
  baselineHeight?: number;
  baselineComposerHeight?: number;
  propsUnchanged: boolean;
  measurements: readonly { time: number; height: number }[];
  interaction?: ImageLoadInteraction;
}): {
  observed: boolean;
  reasons: string[];
  interval?: Interval;
  releaseTime?: number;
  layoutTime?: number;
} {
  const missing = (reason: string) => ({ observed: false, reasons: [reason] });
  if (
    !gate ||
    !gate.key ||
    !gate.src ||
    !gate.token ||
    gate.requested !== true ||
    gate.released !== false ||
    !Number.isFinite(gate.pendingAt) ||
    !Number.isFinite(recordingStartTime) ||
    gate.pendingAt > recordingStartTime
  )
    return missing('unreleased-gate-not-established-before-capture');
  if (!propsUnchanged) return missing('post-props-changed-during-load');
  if (!Number.isFinite(baselineHeight) || baselineHeight! <= 0)
    return missing('pending-row-height-unmeasured');
  if (
    events.some(
      (event, index) =>
        !Number.isFinite(event.time) ||
        event.time < recordingStartTime ||
        (index > 0 && event.time < events[index - 1].time)
    )
  )
    return missing('invalid-event-timeline');

  const intervals: Interval[] = [];
  let gestureStart: number | undefined;
  const keyboardStarts = new Map<string, number>();
  let composerStart: number | undefined;
  let composerHeight = baselineComposerHeight;
  for (const event of events) {
    if (interaction === 'gesture') {
      if (event.name === 'drag-begin') gestureStart = event.time;
      if (event.name === 'drag-end' && gestureStart !== undefined) {
        intervals.push({ startTime: gestureStart, endTime: event.time });
        gestureStart = undefined;
      }
    } else if (interaction === 'keyboard') {
      const will = /^keyboardWill(Show|Hide)$/.exec(event.name);
      const did = /^keyboardDid(Show|Hide)$/.exec(event.name);
      if (will) {
        // A superseding opposite-direction transition cancels the old interval.
        keyboardStarts.clear();
        keyboardStarts.set(will[1], event.time);
      }
      if (did) {
        const start = keyboardStarts.get(did[1]);
        if (start !== undefined)
          intervals.push({ startTime: start, endTime: event.time });
        keyboardStarts.delete(did[1]);
      }
    } else if (interaction === 'composer') {
      if (event.name === 'composer-input') composerStart = event.time;
      if (event.name === 'composer-layout') {
        const height = event.values?.height;
        if (
          composerStart !== undefined &&
          typeof height === 'number' &&
          Number.isFinite(height) &&
          Number.isFinite(composerHeight) &&
          Math.abs(height - composerHeight!) > 1 &&
          event.time - composerStart <= 125
        )
          intervals.push({ startTime: composerStart, endTime: event.time });
        composerHeight = typeof height === 'number' ? height : undefined;
        composerStart = undefined;
      }
    }
  }
  const requests = events.filter(
    (event) =>
      event.name === 'image-release-request' &&
      event.values?.key === gate.key &&
      event.values?.src === gate.src
  );
  for (const request of requests) {
    const acknowledged = events.some(
      (event) =>
        event.name === 'image-release' &&
        event.time >= request.time &&
        event.values?.key === gate.key &&
        event.values?.src === gate.src
    );
    if (!acknowledged) continue;
    for (const layout of events) {
      const height = layout.values?.height;
      if (
        layout.name !== 'row-layout' ||
        layout.values?.key !== gate.key ||
        layout.time < request.time ||
        typeof height !== 'number' ||
        !Number.isFinite(height) ||
        height <= 0 ||
        Math.abs(height - baselineHeight!) <= 1 ||
        !measurements.some(
          (sample) =>
            Number.isFinite(sample.time) &&
            sample.time >= layout.time &&
            Number.isFinite(sample.height) &&
            Math.abs(sample.height - height) <= 1
        )
      )
        continue;
      const interval = intervals.find(
        (candidate) =>
          request.time >= candidate.startTime &&
          layout.time > candidate.startTime &&
          request.time <= layout.time &&
          layout.time <= candidate.endTime &&
          candidate.endTime > candidate.startTime
      );
      if (!interaction || interval)
        return {
          observed: true,
          reasons: [],
          ...(interval ? { interval } : {}),
          releaseTime: request.time,
          layoutTime: layout.time,
        };
    }
  }
  return missing(
    interaction
      ? 'native-image-load-not-witnessed-inside-interaction'
      : 'native-image-load-not-witnessed'
  );
}
