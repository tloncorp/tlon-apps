/**
 * Platform-free core of the conversation scroll diagnostics: the event
 * timeline, the data diff, and the analysis that decides whether rows moved on
 * screen without anything asking them to. Nothing here touches React or the
 * list library, so it can be unit tested.
 */

export type ScrollDiagFlag = 'jump' | 'flicker' | 'warn' | 'hitch';

export type ScrollDiagEvent = {
  seq: number;
  /** Milliseconds since the recorder was created. */
  t: number;
  list: string;
  type: string;
  message: string;
  flag?: ScrollDiagFlag;
  data?: Record<string, unknown>;
};

export type ScrollDiagCounts = Record<ScrollDiagFlag, number>;

type ScrollDiagListener = (event: ScrollDiagEvent) => void;

const DEFAULT_CAPACITY = 1500;

function defaultNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function noCounts(): ScrollDiagCounts {
  return { jump: 0, flicker: 0, warn: 0, hitch: 0 };
}

export class ScrollDiagRecorder {
  private events: ScrollDiagEvent[] = [];
  private seq = 0;
  private counts: ScrollDiagCounts = noCounts();
  private listeners = new Set<ScrollDiagListener>();
  private origin: number;

  constructor(
    private capacity = DEFAULT_CAPACITY,
    private now: () => number = defaultNow
  ) {
    this.origin = now();
  }

  time() {
    return Math.round((this.now() - this.origin) * 10) / 10;
  }

  /**
   * `at` records something that happened earlier than it is being reported,
   * as with what the UI thread saw while this one was busy. The entry goes
   * where it belongs in time, so the timeline still reads in order.
   */
  record(
    input: Omit<ScrollDiagEvent, 'seq' | 't'> & { at?: number }
  ): ScrollDiagEvent {
    const { at, ...rest } = input;
    const event: ScrollDiagEvent = {
      seq: ++this.seq,
      t: at ?? this.time(),
      ...rest,
    };
    let index = this.events.length;
    while (index > 0 && this.events[index - 1].t > event.t) {
      index--;
    }
    this.events.splice(index, 0, event);
    // Trim in chunks so a full buffer does not pay for a shift on every event.
    if (this.events.length > this.capacity * 1.25) {
      this.events = this.events.slice(-this.capacity);
    }
    if (event.flag) {
      this.counts[event.flag] += 1;
    }
    this.listeners.forEach((listener) => listener(event));
    return event;
  }

  getEvents() {
    return this.events;
  }

  getCounts(): ScrollDiagCounts {
    return { ...this.counts };
  }

  /**
   * Events for the same conversation in the `windowMs` before `event`, oldest
   * first. Labels look like `channel#3`; the part before `#` is shared by the
   * list instance and the components around it.
   */
  contextFor(event: ScrollDiagEvent, windowMs: number, limit = 12) {
    const conversation = conversationOf(event.list);
    const context: ScrollDiagEvent[] = [];
    for (let i = this.events.length - 1; i >= 0; i--) {
      const candidate = this.events[i];
      if (candidate.seq >= event.seq) {
        continue;
      }
      if (event.t - candidate.t > windowMs || context.length >= limit) {
        break;
      }
      if (conversationOf(candidate.list) === conversation) {
        context.push(candidate);
      }
    }
    return context.reverse();
  }

  clear() {
    this.events = [];
    this.counts = noCounts();
  }

  subscribe(listener: ScrollDiagListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

function conversationOf(list: string) {
  return list.split('#')[0];
}

export function formatScrollDiagEvent(event: ScrollDiagEvent) {
  const flag = event.flag ? ` !${event.flag.toUpperCase()}` : '';
  return `#${event.seq} ${event.t.toFixed(0)}ms${flag} ${event.type}: ${event.message}`;
}

export function formatScrollDiagEvents(events: ScrollDiagEvent[]) {
  return events.map(formatScrollDiagEvent).join('\n');
}

export function px(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

// --- Data diff --------------------------------------------------------------

export type KeyDiff = {
  kind:
    | 'none'
    | 'initial'
    | 'cleared'
    | 'replaced'
    | 'prepend'
    | 'append'
    | 'mixed';
  added: number;
  removed: number;
  /** Rows added before the first surviving row (the visual top). */
  addedAtStart: number;
  /** Rows added after the last surviving row (the visual bottom). */
  addedAtEnd: number;
  addedInside: number;
  removedAtStart: number;
  removedAtEnd: number;
  removedInside: number;
  /** Surviving rows changed order relative to each other. */
  reordered: boolean;
};

/**
 * Describes how a list's keys changed between two renders, in the terms that
 * matter for scroll anchoring: where rows were added or removed relative to the
 * rows that survived.
 */
export function diffKeys(prev: string[], next: string[]): KeyDiff {
  const diff: KeyDiff = {
    kind: 'none',
    added: 0,
    removed: 0,
    addedAtStart: 0,
    addedAtEnd: 0,
    addedInside: 0,
    removedAtStart: 0,
    removedAtEnd: 0,
    removedInside: 0,
    reordered: false,
  };

  if (prev.length === 0 && next.length === 0) {
    return diff;
  }
  if (prev.length === 0) {
    return { ...diff, kind: 'initial', added: next.length };
  }
  if (next.length === 0) {
    return { ...diff, kind: 'cleared', removed: prev.length };
  }

  const prevIndex = new Map(prev.map((key, index) => [key, index]));
  const nextKeys = new Set(next);

  diff.added = next.reduce((n, key) => n + (prevIndex.has(key) ? 0 : 1), 0);
  diff.removed = prev.reduce((n, key) => n + (nextKeys.has(key) ? 0 : 1), 0);

  if (diff.added === next.length) {
    return { ...diff, kind: 'replaced' };
  }

  const leadingRun = (keys: string[], isMissing: (key: string) => boolean) => {
    let count = 0;
    while (count < keys.length && isMissing(keys[count])) {
      count++;
    }
    return count;
  };
  const trailingRun = (keys: string[], isMissing: (key: string) => boolean) => {
    let count = 0;
    while (count < keys.length && isMissing(keys[keys.length - 1 - count])) {
      count++;
    }
    return count;
  };
  const isNew = (key: string) => !prevIndex.has(key);
  const isGone = (key: string) => !nextKeys.has(key);

  diff.addedAtStart = leadingRun(next, isNew);
  diff.addedAtEnd = trailingRun(next, isNew);
  diff.addedInside = diff.added - diff.addedAtStart - diff.addedAtEnd;
  diff.removedAtStart = leadingRun(prev, isGone);
  diff.removedAtEnd = trailingRun(prev, isGone);
  diff.removedInside = diff.removed - diff.removedAtStart - diff.removedAtEnd;

  let lastSurvivorIndex = -1;
  for (const key of next) {
    const index = prevIndex.get(key);
    if (index === undefined) {
      continue;
    }
    if (index < lastSurvivorIndex) {
      diff.reordered = true;
      break;
    }
    lastSurvivorIndex = index;
  }

  if (diff.added === 0 && diff.removed === 0 && !diff.reordered) {
    return diff;
  }

  const onlyAdded = diff.removed === 0 && !diff.reordered;
  if (onlyAdded && diff.added === diff.addedAtStart) {
    return { ...diff, kind: 'prepend' };
  }
  if (onlyAdded && diff.added === diff.addedAtEnd) {
    return { ...diff, kind: 'append' };
  }
  return { ...diff, kind: 'mixed' };
}

export function describeKeyDiff(diff: KeyDiff) {
  const parts: string[] = [];
  const add = (count: number, label: string) => {
    if (count > 0) {
      parts.push(`${label}${count}`);
    }
  };
  add(diff.addedAtStart, '+top ');
  add(diff.addedAtEnd, '+bottom ');
  add(diff.addedInside, '+inside ');
  add(diff.removedAtStart, '-top ');
  add(diff.removedAtEnd, '-bottom ');
  add(diff.removedInside, '-inside ');
  if (diff.kind === 'initial') {
    parts.push(`first ${diff.added} rows`);
  }
  if (diff.kind === 'replaced') {
    parts.push(`all rows replaced (-${diff.removed} +${diff.added})`);
  }
  if (diff.kind === 'cleared') {
    parts.push(`cleared ${diff.removed} rows`);
  }
  if (diff.reordered) {
    parts.push('reordered');
  }
  return parts.join(', ') || 'no key change';
}

// --- Frame analysis ---------------------------------------------------------

export type RowSample = {
  key: string;
  /** Offset of the row inside the list's item region. */
  position: number;
  size: number;
};

export type FrameSample = {
  /** The list's own scroll offset, including corrections it has requested. */
  scroll: number;
  /** Padding and header above the first row; a change moves every row. */
  topPad: number;
  viewport: number;
  content: number;
  /** Rows intersecting the viewport, top to bottom. */
  rows: RowSample[];
  /** Rows that should be on screen but have no mounted view. */
  blank: number;
  atEnd: boolean;
  /** Close enough to the end that the list keeps itself pinned there. */
  nearEnd: boolean;
};

export type ShiftKind =
  | 'stable'
  /** Offset moved, rows did not: ordinary scrolling. */
  | 'scroll'
  /** Rows moved and the list corrected the offset by the same amount. */
  | 'compensated'
  /** Every row moved together on screen with no matching correction. */
  | 'shift'
  /** Rows moved relative to each other: a row in view changed height. */
  | 'reflow'
  /** No row survived between the two frames. */
  | 'replaced';

export type ShiftAnalysis = {
  kind: ShiftKind;
  /** Rows present in both frames. */
  common: number;
  scrollDelta: number;
  /** Median movement of surviving rows in content coordinates. */
  layoutDelta: number;
  /** Offset corrections the list requested between the two frames. */
  corrected: number;
  /**
   * Row movement no correction covers. This is what shows on screen as a
   * jump, whether or not a gesture is also moving the offset.
   */
  uncorrected: number;
  /** Offset movement that is not a correction: a gesture, or something else. */
  otherScroll: number;
  /** How far surviving rows moved relative to each other. */
  spread: number;
  contentDelta: number;
  viewportDelta: number;
};

export const SHIFT_TOLERANCE = 1.5;

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * Compares two frames of the list's own bookkeeping. `corrected` is the sum
 * of the offset corrections the list requested in between: when rows above
 * the viewport change height, the rows in view move in content coordinates
 * and the list asks the scroll view to move its offset by the same amount, so
 * that nothing moves on screen. Row movement with no such request is a jump.
 */
export function analyzeShift(
  prev: FrameSample,
  next: FrameSample,
  corrected = 0
): ShiftAnalysis {
  const prevPositions = new Map(
    prev.rows.map((row) => [row.key, row.position + prev.topPad])
  );
  const layoutDeltas: number[] = [];
  for (const row of next.rows) {
    const previous = prevPositions.get(row.key);
    if (previous !== undefined) {
      layoutDeltas.push(row.position + next.topPad - previous);
    }
  }

  const scrollDelta = next.scroll - prev.scroll;
  const otherScroll = scrollDelta - corrected;
  const base = {
    common: layoutDeltas.length,
    scrollDelta,
    corrected,
    otherScroll,
    contentDelta: next.content - prev.content,
    viewportDelta: next.viewport - prev.viewport,
  };

  if (layoutDeltas.length === 0) {
    const hadRows = prev.rows.length > 0 && next.rows.length > 0;
    return {
      ...base,
      kind: hadRows ? 'replaced' : 'stable',
      layoutDelta: 0,
      uncorrected: 0,
      spread: 0,
    };
  }

  const layoutDelta = median(layoutDeltas);
  const uncorrected = layoutDelta - corrected;
  const spread = Math.max(...layoutDeltas) - Math.min(...layoutDeltas);
  const exceeds = (value: number) => Math.abs(value) > SHIFT_TOLERANCE;

  let kind: ShiftKind = 'stable';
  if (exceeds(spread)) {
    kind = 'reflow';
  } else if (exceeds(uncorrected)) {
    kind = 'shift';
  } else if (exceeds(layoutDelta)) {
    kind = 'compensated';
  } else if (exceeds(otherScroll)) {
    kind = 'scroll';
  }

  return { ...base, kind, layoutDelta, uncorrected, spread };
}

export type ScrollPhase = 'idle' | 'drag' | 'momentum';

export type ShiftVerdict = {
  type: 'shift' | 'adjust' | 'auto-scroll' | 'reflow';
  flag?: ScrollDiagFlag;
  message: string;
};

/**
 * Turns a frame-to-frame analysis into a timeline entry, or null when the
 * frame is unremarkable. `causes` are the things known to move content
 * legitimately in this frame (an imperative scroll, the keyboard, new rows at
 * the end while following); movement with none of them is flagged.
 */
export function judgeShift(
  analysis: ShiftAnalysis,
  context: { phase: ScrollPhase; hidden: boolean; causes: string[] }
): ShiftVerdict | null {
  const {
    kind,
    layoutDelta,
    corrected,
    uncorrected,
    otherScroll,
    scrollDelta,
    spread,
  } = analysis;
  const explained = context.causes.length > 0;
  const because = explained ? ` (${context.causes.join(', ')})` : '';
  const hiddenNote = context.hidden ? ' [hidden]' : '';
  const flagUnlessExplained = (
    flag: ScrollDiagFlag
  ): ScrollDiagFlag | undefined =>
    context.hidden || explained ? undefined : flag;

  switch (kind) {
    case 'stable':
      return null;

    case 'scroll':
      if (context.phase !== 'idle') {
        return null;
      }
      return {
        type: 'auto-scroll',
        flag: flagUnlessExplained('jump'),
        message: `offset moved ${px(otherScroll)} with no gesture${because}${hiddenNote}`,
      };

    case 'compensated':
      return {
        type: 'adjust',
        message: `rows moved ${px(layoutDelta)} and the list corrected the offset by ${px(corrected)}${because}${hiddenNote}`,
      };

    case 'shift':
      return {
        type: 'shift',
        flag: flagUnlessExplained('jump'),
        message: `rows moved ${px(uncorrected)} on screen with no offset correction (layout ${px(layoutDelta)}, corrections ${px(corrected)}, offset ${px(scrollDelta)}) during ${context.phase}${because}${hiddenNote}`,
      };

    case 'reflow':
      // Unflagged here: the row that resized is reported by itself, with
      // whether it was a first measurement or a change to a settled row.
      return {
        type: 'reflow',
        message: `rows in view moved ${px(spread)} relative to each other, so one of them changed height (uncorrected ${px(uncorrected)}, offset ${px(scrollDelta)}) during ${context.phase}${because}${hiddenNote}`,
      };

    case 'replaced':
      return {
        type: 'shift',
        flag: context.hidden
          ? undefined
          : explained || context.phase !== 'idle'
            ? 'warn'
            : 'jump',
        message: `every row in view replaced between frames (offset ${px(scrollDelta)}) during ${context.phase}${because}${hiddenNote}`,
      };
  }
}

// --- Native offset tracking -------------------------------------------------

export type PendingAdjust = { t: number; amount: number };
export type LandedAdjust = PendingAdjust & { latency: number };

// A fling's speed changes by a few percent between events; a finger's can
// change by much more, so corrections are matched more loosely during a drag.
const MATCH_TOLERANCE: Record<ScrollPhase, { min: number; ratio: number }> = {
  idle: { min: 2, ratio: 0.05 },
  momentum: { min: 6, ratio: 0.15 },
  drag: { min: 10, ratio: 0.3 },
};
const MAX_EVENT_GAP_MS = 120;

/**
 * The list corrects for rows resizing above the viewport by asking the native
 * scroll view to move its offset in the same frame. Whether that lands is the
 * difference between an invisible correction and a visible jump, so each
 * requested correction is matched against the native offsets that follow it.
 *
 * `request` and `nativeScroll` are both given times on the JS clock, and
 * native events may also carry the UI-thread time they happened at. Events
 * can reach JS late and in bursts, so the UI time is what speed is measured
 * with; the smallest delay seen between the two clocks converts it back.
 */
export class AdjustTracker {
  private pending: PendingAdjust[] = [];
  private lastY: number | null = null;
  private lastUiTime: number | null = null;
  private lastDelta = 0;
  /** Gesture speed in px per ms of UI time, from correction-free steps. */
  private velocity: number | null = null;
  private clockOffset = Infinity;

  constructor(private timeoutMs = 150) {}

  request(t: number, amount: number) {
    this.pending.push({ t, amount });
  }

  /**
   * Feed one native scroll offset. Returns corrections that landed with this
   * event, and the part of the step that neither a gesture nor a correction
   * explains.
   */
  nativeScroll(
    t: number,
    y: number,
    phase: ScrollPhase,
    uiTime?: number
  ): { landed: LandedAdjust[]; step: number } {
    let happenedAt = t;
    if (uiTime !== undefined) {
      this.clockOffset = Math.min(this.clockOffset, t - uiTime);
      happenedAt = uiTime + this.clockOffset;
    }
    if (this.lastY === null) {
      this.lastY = y;
      this.lastUiTime = uiTime ?? null;
      return { landed: [], step: 0 };
    }

    const delta = y - this.lastY;
    const elapsed =
      uiTime !== undefined && this.lastUiTime !== null
        ? uiTime - this.lastUiTime
        : null;
    const canPredict =
      elapsed !== null && elapsed > 0 && elapsed < MAX_EVENT_GAP_MS;
    // What the gesture alone would have moved the offset by.
    const predicted =
      canPredict && this.velocity !== null ? this.velocity * elapsed : null;
    const expected = phase === 'idle' ? 0 : (predicted ?? this.lastDelta);
    let residual = delta - expected;

    const landed = this.match(residual, phase).map((adjust) => ({
      ...adjust,
      latency: Math.max(0, happenedAt - adjust.t),
    }));
    const landedTotal = landed.reduce((sum, adjust) => sum + adjust.amount, 0);
    residual -= landedTotal;

    let step = 0;
    if (phase === 'idle') {
      step = residual;
    } else if (
      phase === 'momentum' &&
      predicted !== null &&
      Math.abs(residual) > Math.max(16, Math.abs(expected) * 0.5)
    ) {
      // A fling slows smoothly, so an abrupt change stands out. A finger can
      // change speed at will, so drags are left alone.
      step = residual;
    }

    if (step === 0 || phase === 'idle') {
      const gestureDelta = delta - landedTotal;
      this.lastDelta = gestureDelta;
      this.velocity = canPredict ? gestureDelta / elapsed : null;
    } else {
      // An abrupt step says nothing about how fast the gesture is going.
      // Forget the speed and take it afresh from the next event, rather than
      // judging everything that follows against a stale one.
      this.velocity = null;
    }
    this.lastY = y;
    this.lastUiTime = uiTime ?? null;
    return { landed, step };
  }

  /**
   * Corrections requested in one frame usually land together, so try the
   * oldest ones as a group before trying any one of them alone.
   */
  private match(residual: number, phase: ScrollPhase): PendingAdjust[] {
    const { min, ratio } = MATCH_TOLERANCE[phase];
    const fits = (amount: number) =>
      Math.abs(residual - amount) <= Math.max(min, Math.abs(amount) * ratio);

    for (let count = this.pending.length; count > 1; count--) {
      const group = this.pending.slice(0, count);
      if (fits(group.reduce((sum, adjust) => sum + adjust.amount, 0))) {
        this.pending = this.pending.slice(count);
        return group;
      }
    }
    const index = this.pending.findIndex((adjust) => fits(adjust.amount));
    if (index === -1) {
      return [];
    }
    return this.pending.splice(index, 1);
  }

  /** Corrections that were requested but never showed up in the offset. */
  expire(t: number): PendingAdjust[] {
    const expired = this.pending.filter(
      (adjust) => t - adjust.t > this.timeoutMs
    );
    if (expired.length > 0) {
      this.pending = this.pending.filter(
        (adjust) => t - adjust.t <= this.timeoutMs
      );
    }
    return expired;
  }

  hasPending() {
    return this.pending.length > 0;
  }
}

/** Describes which watched values changed, e.g. `isNearEnd true→false`. */
export function describeChanges(
  prev: Record<string, unknown>,
  next: Record<string, unknown>
) {
  const changes: string[] = [];
  for (const key of Object.keys(next)) {
    if (!Object.is(prev[key], next[key])) {
      changes.push(`${key} ${String(prev[key])}→${String(next[key])}`);
    }
  }
  return changes;
}

// --- Frame pacing -----------------------------------------------------------

/** A display frame that arrived later than the one before it allowed for. */
export type LateFrame = {
  /** When it arrived, on the recorder's clock. */
  t: number;
  /** Time since the frame before it. */
  gap: number;
  /** What that time should have been at the display's refresh rate. */
  interval: number;
};

/** A stall this long is worth a flag even when nothing was moving. */
const LONG_STALL_MS = 100;

/** How many frames the display went without between two it did get. */
export function missedFrames({ gap, interval }: Omit<LateFrame, 't'>) {
  return Math.max(1, Math.round(gap / interval) - 1);
}

export type FrameSummary = {
  seconds: number;
  frames: number;
  lateFrames: number;
  missedFrames: number;
  /** Total time frames arrived late by. */
  hitchMs: number;
  worstGapMs: number;
  /**
   * Late time per second watched, the figure Apple grades scrolling and
   * transitions by: under 5 reads as smooth, over 10 as plainly stuttering.
   */
  hitchMsPerSecond: number;
};

/** Running totals of what the UI thread's frame clock reported. */
export class FrameTally {
  private elapsedMs = 0;
  private frames = 0;
  private late = 0;
  private missed = 0;
  private hitchMs = 0;
  private worstGapMs = 0;

  add(frames: number, elapsedMs: number, late: Omit<LateFrame, 't'>[]) {
    this.frames += frames;
    this.elapsedMs += elapsedMs;
    for (const frame of late) {
      this.late += 1;
      this.missed += missedFrames(frame);
      this.hitchMs += frame.gap - frame.interval;
      this.worstGapMs = Math.max(this.worstGapMs, frame.gap);
    }
  }

  summary(): FrameSummary {
    const seconds = this.elapsedMs / 1000;
    const round = (value: number) => Math.round(value * 10) / 10;
    return {
      seconds: round(seconds),
      frames: this.frames,
      lateFrames: this.late,
      missedFrames: this.missed,
      hitchMs: round(this.hitchMs),
      worstGapMs: round(this.worstGapMs),
      hitchMsPerSecond: seconds > 0 ? round(this.hitchMs / seconds) : 0,
    };
  }

  reset() {
    this.elapsedMs = 0;
    this.frames = 0;
    this.late = 0;
    this.missed = 0;
    this.hitchMs = 0;
    this.worstGapMs = 0;
  }
}

const ACTIVITY_LOOKBACK_MS = 30_000;

/**
 * What was on the move at `t`, read back from the timeline: a conversation
 * being scrolled, a screen sliding in, or a conversation still being put in
 * place before it is shown. Null when nothing was, which is when a late frame
 * cannot be seen.
 */
export function activityAt(events: ScrollDiagEvent[], t: number) {
  const decided = new Map<string, string | null>();
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.t > t) {
      continue;
    }
    if (t - event.t > ACTIVITY_LOOKBACK_MS) {
      break;
    }
    const key = `${event.type === 'nav' ? 'nav' : 'list'}:${event.list}`;
    if (decided.has(key)) {
      continue;
    }
    const name = conversationOf(event.list);
    if (event.type === 'gesture') {
      decided.set(
        key,
        /^(drag|momentum) began/.test(event.message)
          ? `scrolling ${name}`
          : null
      );
    } else if (event.type === 'nav') {
      decided.set(
        key,
        event.message.endsWith('began') ? 'a screen was sliding in' : null
      );
    } else if (event.type === 'lifecycle') {
      decided.set(
        key,
        event.message.startsWith('list mounted') ? `opening ${name}` : null
      );
    } else if (
      event.type === 'visibility' &&
      event.message.startsWith('list first shown')
    ) {
      decided.set(key, null);
    }
  }
  const activities = [...decided.values()].filter(
    (activity): activity is string => activity !== null
  );
  // What the eye is on first: a list under a finger, then a moving screen.
  return (
    activities.find((activity) => activity.startsWith('scrolling')) ??
    activities.find((activity) => !activity.startsWith('opening')) ??
    activities[0] ??
    null
  );
}

/** A late frame as a timeline entry. */
export function describeLateFrame(
  frame: LateFrame,
  activity: string | null
): { message: string; flag?: ScrollDiagFlag } {
  const missed = missedFrames(frame);
  const visible = activity !== null && missed >= 2;
  return {
    message: `UI thread missed ${missed} frame${missed === 1 ? '' : 's'} (${Math.round(frame.gap)}ms between frames) ${activity ? `while ${activity}` : 'with nothing moving'}`,
    flag: visible || frame.gap >= LONG_STALL_MS ? 'hitch' : undefined,
  };
}
