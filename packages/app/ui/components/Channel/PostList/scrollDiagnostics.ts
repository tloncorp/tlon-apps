import {
  addCustomEnabledLoggers,
  createDevLogger,
  useDebugStore,
} from '@tloncorp/shared';

import {
  FrameTally,
  type LateFrame,
  ScrollDiagEvent,
  ScrollDiagFlag,
  ScrollDiagRecorder,
  activityAt,
  describeLateFrame,
  formatScrollDiagEvent,
  formatScrollDiagEvents,
} from './scrollDiagnosticsCore';
import { syncUiClock, watchFrames } from './scrollDiagnosticsFrames';

/**
 * Conversation scroll diagnostics.
 *
 * Everything that can move rows on screen is written to one timeline: data
 * changes, row resizes, the list's own offset corrections, native scroll
 * offsets, gestures, insets, the keyboard, and the list being hidden or
 * remounted. Movement that nothing accounts for is flagged as a jump or a
 * flicker and logged with the events that led up to it.
 *
 * Off unless one of these holds, checked when a list mounts:
 * - `ENABLED_LOGGERS` includes `scroller` (dev builds); add
 *   `scroller-timecode` to draw the strip a screen recording is lined up by;
 * - debug mode is on in app settings, which also makes the flagged events part
 *   of an uploaded debug log;
 * - a fixture or the debugger called `setScrollDiagnosticsEnabled(true)`.
 *
 * While diagnostics are on, the whole timeline is reachable from the debugger
 * as `globalThis.__scrollDiag` (`dump()`, `flagged()`, `events()`, `counts()`,
 * `frames()`, `nativeTrail()`, `clear()`, `mark(label)`).
 *
 * The UI thread's frame clock is watched as well, for the app as a whole:
 * frames that arrive late are added to the timeline as they happened, and
 * `frames()` gives the totals since the last `clear()`.
 */

const LOGGER_TAG = 'scroller';
// The time code strip redraws on every frame, which is work the frame-pacing
// figures should not include, so it is only drawn when a recording needs it.
const TIMECODE_TAG = 'scroller-timecode';
const CONTEXT_WINDOW_MS = 500;
const CONTEXT_COOLDOWN_MS = 250;

const logger = createDevLogger(LOGGER_TAG, false);

export const scrollDiagRecorder = new ScrollDiagRecorder();

let enabledOverride: boolean | null = null;

/** Forces diagnostics on or off for lists mounted afterwards; null defers. */
export function setScrollDiagnosticsEnabled(enabled: boolean | null) {
  enabledOverride = enabled;
  if (enabled) {
    addCustomEnabledLoggers([LOGGER_TAG]);
  }
}

export function isScrollDiagnosticsEnabled() {
  const { enabled, customLoggers } = useDebugStore.getState();
  const isEnabled =
    enabledOverride ?? (enabled || customLoggers.has(LOGGER_TAG));
  if (isEnabled) {
    installDebuggerHandle();
  }
  return isEnabled;
}

/** Whether to draw the strip that lets a screen recording be lined up. */
export function isScrollDiagnosticsTimecodeEnabled() {
  return (
    isScrollDiagnosticsEnabled() &&
    useDebugStore.getState().customLoggers.has(TIMECODE_TAG)
  );
}

const lastContextAt = new Map<string, number>();

export type ScrollDiagNoteOptions = {
  flag?: ScrollDiagFlag;
  /** Keep in the timeline without logging; for per-frame detail. */
  quiet?: boolean;
  data?: Record<string, unknown>;
  /** When it happened, if that was before now. */
  at?: number;
};

/**
 * Adds an entry to the timeline. Flagged entries are logged along with the
 * entries that preceded them; quiet entries only show up as that context.
 */
export function noteScrollDiagnostics(
  list: string,
  type: string,
  message: string,
  { flag, quiet, data, at }: ScrollDiagNoteOptions = {}
): ScrollDiagEvent {
  const event = scrollDiagRecorder.record({
    list,
    type,
    message,
    flag,
    data,
    at,
  });
  if (!flag) {
    if (!quiet) {
      logger.log(`${list} ${formatScrollDiagEvent(event)}`);
    }
    return event;
  }

  const lastContext = lastContextAt.get(list) ?? -Infinity;
  const context =
    event.t - lastContext > CONTEXT_COOLDOWN_MS
      ? scrollDiagRecorder.contextFor(event, CONTEXT_WINDOW_MS)
      : [];
  lastContextAt.set(list, event.t);
  logger.log(
    `${list} ${formatScrollDiagEvent(event)}${
      context.length > 0
        ? `\n  leading up to it:\n${context
            .map((entry) => `    ${formatScrollDiagEvent(entry)}`)
            .join('\n')}`
        : ''
    }`
  );
  return event;
}

export function shortListLabel(channelId: string) {
  const name = channelId.split('/').pop() ?? channelId;
  return name.length > 24 ? name.slice(-24) : name;
}

// --- Row lifecycle ----------------------------------------------------------

export type ScrollDiagRowEvent = {
  key: string;
  kind: 'mount' | 'unmount';
  t: number;
};

type RowListener = (event: ScrollDiagRowEvent) => void;

const rowListeners = new Map<string, Set<RowListener>>();

/** Lets a list instance hear when rows for its channel mount and unmount. */
export function subscribeToScrollDiagRows(
  channelId: string,
  listener: RowListener
) {
  const listeners = rowListeners.get(channelId) ?? new Set();
  listeners.add(listener);
  rowListeners.set(channelId, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      rowListeners.delete(channelId);
    }
  };
}

export function hasScrollDiagRowListeners(channelId: string) {
  return rowListeners.has(channelId);
}

export function reportScrollDiagRow(
  channelId: string,
  key: string,
  kind: ScrollDiagRowEvent['kind']
) {
  const listeners = rowListeners.get(channelId);
  if (!listeners) {
    return;
  }
  const event = { key, kind, t: scrollDiagRecorder.time() };
  listeners.forEach((listener) => listener(event));
}

// --- Frame pacing -----------------------------------------------------------

const frameTally = new FrameTally();

function startWatchingFrames() {
  // Added to a UI-thread time to place it on the timeline; until the two
  // clocks have been compared, late frames are placed when they are reported.
  let uiClockOffset: number | null = null;
  syncUiClock(
    () => scrollDiagRecorder.time(),
    (offset) => {
      uiClockOffset = offset;
    }
  );
  watchFrames(({ frames, elapsedMs, late }) => {
    const lateFrames: LateFrame[] = [];
    for (let i = 0; i < late.length; i += 3) {
      lateFrames.push({
        t:
          uiClockOffset === null
            ? scrollDiagRecorder.time()
            : late[i] + uiClockOffset,
        gap: late[i + 1],
        interval: late[i + 2],
      });
    }
    frameTally.add(frames, elapsedMs, lateFrames);
    for (const frame of lateFrames) {
      const { message, flag } = describeLateFrame(
        frame,
        activityAt(scrollDiagRecorder.getEvents(), frame.t)
      );
      noteScrollDiagnostics('ui', 'frames', message, {
        at: frame.t,
        data: { gap: frame.gap, interval: frame.interval },
        flag,
        quiet: !flag,
      });
    }
  });
}

// --- Debugger handle --------------------------------------------------------

let debuggerHandleInstalled = false;

const EXPORT_TAG = 'scroller-export';
const EXPORT_URL = 'http://localhost:8799/live';
const EXPORT_INTERVAL_MS = 1000;

// With the `scroller-export` logger enabled as well, the timeline is posted to
// a collector on the development machine (`scripts/scroll-hunt/collect.mjs`),
// so a simulator build with no debugger attached can still be read.
function startExportingTimeline() {
  let lastSent = '';
  setInterval(() => {
    const events = scrollDiagRecorder.getEvents();
    const stamp = `${events.length}:${events.at(-1)?.t ?? 0}`;
    if (stamp === lastSent) {
      return;
    }
    lastSent = stamp;
    fetch(EXPORT_URL, { method: 'POST', body: JSON.stringify(events) }).catch(
      () => {
        // No collector is running; the timeline stays in memory.
      }
    );
  }, EXPORT_INTERVAL_MS);
}

// --- Raw scroll events ------------------------------------------------------

const NATIVE_TRAIL_LENGTH = 400;
/** `t, offset, content height, viewport height, bottom inset` per event. */
const nativeTrail: number[][] = [];

/**
 * Keeps the scroll view's last few hundred events as it reported them. The
 * timeline says what moved and by how much in a frame; when two things move
 * the offset in one frame, only the order they arrived in tells them apart.
 */
export function recordNativeScroll(
  offset: number,
  contentHeight: number,
  viewportHeight: number,
  insetBottom: number
) {
  nativeTrail.push([
    Math.round(scrollDiagRecorder.time()),
    Math.round(offset * 10) / 10,
    Math.round(contentHeight),
    Math.round(viewportHeight),
    Math.round(insetBottom),
  ]);
  if (nativeTrail.length > NATIVE_TRAIL_LENGTH) {
    nativeTrail.shift();
  }
}

function installDebuggerHandle() {
  if (debuggerHandleInstalled) {
    return;
  }
  debuggerHandleInstalled = true;
  if (useDebugStore.getState().customLoggers.has(EXPORT_TAG)) {
    startExportingTimeline();
  }
  startWatchingFrames();
  (globalThis as Record<string, unknown>).__scrollDiag = {
    enable: setScrollDiagnosticsEnabled,
    events: () => scrollDiagRecorder.getEvents(),
    counts: () => scrollDiagRecorder.getCounts(),
    /** UI-thread frame pacing since the last `clear()`. */
    frames: () => frameTally.summary(),
    /** The scroll view's own recent events, oldest first. */
    nativeTrail: () => nativeTrail.slice(),
    clear: () => {
      scrollDiagRecorder.clear();
      frameTally.reset();
    },
    /** The last `count` entries as text; flagged entries carry `!JUMP` etc. */
    dump: (count = 200) =>
      formatScrollDiagEvents(scrollDiagRecorder.getEvents().slice(-count)),
    flagged: () =>
      formatScrollDiagEvents(
        scrollDiagRecorder.getEvents().filter((event) => event.flag)
      ),
    /** Drops a labelled entry into the timeline, to bracket a manual step. */
    mark: (label: string) =>
      scrollDiagRecorder.record({ list: 'hunt', type: 'mark', message: label })
        .seq,
  };
}
