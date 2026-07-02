import type { ContextLens } from './context-lens.js';
import { sharedSlot } from './shared-state.js';

export type ContextLensEvent = {
  seq: number;
  at: number;
  phase: string;
  lens: ContextLens;
  detail?: {
    toolName?: string;
    toolPhase?: string;
    toolCallId?: string;
    toolCallCount?: number;
  };
};

type ContextLensListener = (event: ContextLensEvent) => void;

type ContextLensEventState = {
  listeners: Set<ContextLensListener>;
  recentEvents: ContextLensEvent[];
  nextSeq: number;
  maxRecentEvents: number;
};

const DEFAULT_MAX_RECENT_EVENTS = 200;
const CONTEXT_LENS_EVENTS_SLOT = '@tloncorp/openclaw.context-lens-events';
const stateSlot = sharedSlot<ContextLensEventState>(CONTEXT_LENS_EVENTS_SLOT);
const state = stateSlot.get() ?? {
  listeners: new Set<ContextLensListener>(),
  recentEvents: [],
  nextSeq: 1,
  maxRecentEvents: DEFAULT_MAX_RECENT_EVENTS,
};
// Slot state written by an older module copy may predate this field.
state.maxRecentEvents ??= DEFAULT_MAX_RECENT_EVENTS;

stateSlot.set(state);

export function setContextLensEventCapacity(
  maxEntries: number | null | undefined
) {
  state.maxRecentEvents =
    maxEntries && maxEntries > 0 ? maxEntries : DEFAULT_MAX_RECENT_EVENTS;
}

function pruneExpiredEvents(now = Date.now()) {
  state.recentEvents = state.recentEvents.filter(
    (event) => event.lens.expiresAt > now
  );
}

export function publishContextLensEvent(
  phase: string,
  lens: ContextLens,
  detail?: ContextLensEvent['detail']
) {
  const event: ContextLensEvent = {
    seq: state.nextSeq++,
    at: Date.now(),
    phase,
    lens,
    ...(detail ? { detail } : {}),
  };

  pruneExpiredEvents(event.at);
  if (event.lens.expiresAt <= event.at) {
    return;
  }
  state.recentEvents.push(event);
  if (state.recentEvents.length > state.maxRecentEvents) {
    state.recentEvents.splice(
      0,
      state.recentEvents.length - state.maxRecentEvents
    );
  }

  // Deliver this event to the listeners that existed at publish start.
  // oxlint-disable-next-line no-useless-spread
  for (const listener of [...state.listeners]) {
    try {
      listener(event);
    } catch {
      // Listener-owned resources, such as SSE responses, clean themselves up.
      // Keep publishing so one broken subscriber cannot interrupt bot work.
    }
  }
}

export function listRecentContextLensEvents() {
  pruneExpiredEvents();
  return [...state.recentEvents];
}

export function findRecentContextLensById(lensId: string) {
  pruneExpiredEvents();
  for (const event of state.recentEvents.toReversed()) {
    if (event.lens.lensId === lensId) {
      return event.lens;
    }
  }
  return null;
}

export function subscribeToContextLensEvents(listener: ContextLensListener) {
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}
