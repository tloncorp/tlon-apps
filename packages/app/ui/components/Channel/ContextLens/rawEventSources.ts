import type { ContextLens, ContextLensEvent } from './types';
import { FINAL_STATUSES, contextLensEventFromStewardRun } from './types';

export type ContextLensRawEventSource = {
  /** Normalized event used to render the inspector. */
  event: ContextLensEvent;
  /** Exact parsed envelope received from the selected source. */
  rawEnvelope: unknown;
};

type StewardRunSource = {
  botShip: string;
  complete?: boolean;
  receivedAt: number;
  payload?: unknown;
};

// The rendered stream may project an expired live event to a local `stale`
// state. Pair that projection with the original SSE event so Copy raw never
// mistakes a client-side projection for gateway output.
export function contextLensSourcesFromLiveEvents(
  renderedEvents: readonly ContextLensEvent[],
  rawEvents: readonly ContextLensEvent[]
): ContextLensRawEventSource[] {
  const latestRawByLensId = new Map<string, ContextLensEvent>();
  for (const event of rawEvents) {
    latestRawByLensId.set(event.lens.lensId, event);
  }

  return [...latestRawByLensId.values()].map((rawEvent) => {
    let renderedEvent: ContextLensEvent | undefined;
    for (let index = renderedEvents.length - 1; index >= 0; index -= 1) {
      const event = renderedEvents[index];
      if (
        event.lens.lensId === rawEvent.lens.lensId &&
        event.seq === rawEvent.seq &&
        event.at === rawEvent.at
      ) {
        renderedEvent = event;
        break;
      }
    }
    return {
      event: renderedEvent ?? rawEvent,
      rawEnvelope: rawEvent,
    };
  });
}

export function contextLensSourceFromStewardRun(
  run: StewardRunSource,
  now = Date.now()
): ContextLensRawEventSource | null {
  const event = contextLensEventFromStewardRun(run, now);
  if (!event) {
    return null;
  }
  return { event, rawEnvelope: run.payload };
}

export function contextLensSourceFromLookup(
  lens: ContextLens,
  rawEnvelope: unknown
): ContextLensRawEventSource {
  return {
    event: {
      seq: 0,
      at: lens.updatedAt,
      phase: 'lookup',
      lens,
    },
    rawEnvelope,
  };
}

function prefersSource(
  candidate: ContextLensRawEventSource,
  existing: ContextLensRawEventSource
) {
  const candidateFinal = FINAL_STATUSES.has(candidate.event.lens.status);
  const existingFinal = FINAL_STATUSES.has(existing.event.lens.status);
  if (candidateFinal !== existingFinal) {
    return candidateFinal;
  }
  return candidate.event.at >= existing.event.at;
}

export function preferredContextLensSource(
  candidate: ContextLensRawEventSource | undefined,
  fallback: ContextLensRawEventSource
): ContextLensRawEventSource {
  return candidate && prefersSource(candidate, fallback) ? candidate : fallback;
}

export function mergeContextLensRunSources(
  ...sourceGroups: readonly ContextLensRawEventSource[][]
) {
  const byLensId = new Map<string, ContextLensRawEventSource>();
  for (const source of sourceGroups.flat()) {
    const lensId = source.event.lens.lensId;
    const existing = byLensId.get(lensId);
    if (!existing || prefersSource(source, existing)) {
      byLensId.set(lensId, source);
    }
  }
  return [...byLensId.values()].sort(
    (left, right) => right.event.at - left.event.at
  );
}
