import { type LegendListRef } from '@legendapp/list/react-native';
import * as React from 'react';
import { AppState, Keyboard, type KeyboardEvent } from 'react-native';
import {
  runOnJS,
  useAnimatedScrollHandler,
  useComposedEventHandler,
} from 'react-native-reanimated';

import {
  type ScrollDiagNoteOptions,
  type ScrollDiagRowEvent,
  isScrollDiagnosticsEnabled,
  noteScrollDiagnostics,
  recordNativeScroll,
  scrollDiagRecorder,
  shortListLabel,
  subscribeToScrollDiagRows,
} from './scrollDiagnostics';
import {
  AdjustTracker,
  type FrameSample,
  SHIFT_TOLERANCE,
  type ScrollPhase,
  analyzeShift,
  describeChanges,
  describeKeyDiff,
  diffKeys,
  judgeShift,
  px,
} from './scrollDiagnosticsCore';

type ScrollHandler = ReturnType<typeof useAnimatedScrollHandler>;

type SizeChange = {
  index: number;
  inView: boolean;
  /**
   * How long the row's component had been mounted when it was measured, or
   * undefined when the measurement came first.
   */
  mountedFor: number | undefined;
  key: string;
  size: number;
  previous: number;
};

type WatchedValues = Record<string, string | number | boolean | undefined>;

/** Where the conversation is meant to open. */
export type LandingTarget =
  | 'end'
  | { index: number; viewPosition: number; viewOffset: number };

type LandingExpectation = {
  target: LandingTarget;
  /** The row the conversation opened on, which may change index later. */
  key: string | null;
  /** Where that row's top sat on screen when the list was shown. */
  shownAt: number | null;
};

type ListSignalListener = (
  signal: string,
  callback: (value: number) => void
) => () => void;

const MAX_SAMPLED_ROWS = 40;
// Native scroll events keep arriving briefly after a gesture reports its end.
const GESTURE_SETTLE_MS = 120;
const ROW_REMOUNT_WINDOW_MS = 500;
/** Where a row sat on screen at the moment it mounted or unmounted. */
type RowSighting = 'in view' | 'under the header' | 'off screen';
// Long enough that the scroll view visibly ran ahead of what JS had rendered.
const JS_STALL_MS = 120;
// A stall this recent makes the order of native events and corrections too
// uncertain to call a correction missed.
const STALL_AFTERMATH_MS = 600;
// Smaller height changes than this are not worth a flag.
const VISIBLE_RESIZE_PX = 4;
// A row that returns to its earlier height this quickly was re-rendered from
// scratch, or is waiting on content it already had.
const HEIGHT_OSCILLATION_MS = 1000;
const NO_KEYS: string[] = [];
type ListProps = {
  onItemSizeChanged?: (info: {
    index: number;
    itemKey: string;
    previous: number;
    size: number;
  }) => void;
};
const NO_LIST_PROPS: ListProps = {};
// A list with rows to show that is still invisible this long after mounting
// reads as a blank screen.
const HIDDEN_TOO_LONG_MS = [2000, 5000];
// When, after the list is shown, to check that it is still where it opened.
const LANDING_CHECKS_MS = [400, 1600];
const LANDING_TOLERANCE = 8;
// A rebuild swaps the list within one or two commits; anything slower is the
// user leaving and coming back.
const LIST_REBUILD_WINDOW_MS = 250;
// Longer than the tracker's own timeout, so the check finds it expired.
const ADJUST_EXPIRY_CHECK_MS = 200;
// The list places rows from where it believes the scroll view is. The two can
// differ for a moment around any scroll; apart for this long, at rest, they
// are not going to meet.
const OFFSET_DISAGREEMENT_PX = 2;
const OFFSET_DISAGREEMENT_MS = 400;
// How far the newest message may reach under the input before it counts as
// covered, and how long it has to stay there: a keyboard on its way up or down
// covers it for the length of its animation.
const END_COVERED_PX = 8;
const END_COVERED_MS = 600;

let instanceCount = 0;
function nextInstanceLabel(channelId: string) {
  instanceCount += 1;
  return `${shortListLabel(channelId)}#${instanceCount}`;
}
// When a list the user could see was last unmounted, by channel.
const shownListTornDownAt = new Map<string, number>();

type DiagnosticsState = ReturnType<typeof createDiagnosticsState>;

function createDiagnosticsState(keys: string[], initialTopPadding: number) {
  return {
    adjusts: new AdjustTracker(),
    blankSince: null as number | null,
    causes: new Map<string, number>(),
    expiryTimer: null as ReturnType<typeof setTimeout> | null,
    // Offset corrections the list requested since the last frame compared.
    corrected: 0,
    endAlignDelta: 0,
    flushRequestedAt: 0,
    flushScheduled: false,
    lastSizeChange: new Map<string, { t: number; from: number; to: number }>(),
    landing: null as LandingExpectation | null,
    lastStallAt: -Infinity,
    // Lists start out transparent while their initial position settles.
    hidden: true,
    hiddenAt: null as number | null,
    keys,
    measuredKeys: new Set<string>(),
    mountedAt: 0,
    // The last offset the scroll view itself reported, as distinct from the
    // one the list is working from.
    nativeOffset: null as number | null,
    offsetsApartSince: null as number | null,
    offsetsApartNoted: false,
    offsetsApartTimer: null as ReturnType<typeof setTimeout> | null,
    endCoveredSince: null as number | null,
    endCoveredNoted: false,
    endCoveredTimer: null as ReturnType<typeof setTimeout> | null,
    // How far under the input the last gesture left the newest message. A
    // reader may rest the list there; only something else doing so is news.
    endCoverLeftByGesture: null as number | null,
    gestureSinceEndCheck: false,
    endCoverLastNoted: null as number | null,
    // The scroll view's own account of its content, from its last event.
    nativeContentHeight: null as number | null,
    nativeViewportHeight: null as number | null,
    nativeInsetBottom: 0,
    phase: 'idle' as ScrollPhase,
    phaseChangedAt: -Infinity,
    prevSample: null as FrameSample | null,
    remounts: [] as Array<{
      key: string;
      gap: number;
      left: RowSighting;
      back: RowSighting;
    }>,
    revealed: false,
    rowMounts: new Map<string, number>(),
    rowUnmounts: new Map<string, { t: number; seen: RowSighting }>(),
    scrollAdjust: 0,
    sizeChanges: [] as SizeChange[],
    timers: [] as ReturnType<typeof setTimeout>[],
    userScrolled: false,
    topPad: {
      alignItemsAtEndPadding: 0,
      headerSize: 0,
      stylePaddingTop: initialTopPadding,
    },
    watch: null as WatchedValues | null,
  };
}

/**
 * Runs work that the list or the scroll view triggers from inside its own
 * callbacks. Diagnostics must never be the reason a conversation breaks, so a
 * failure is recorded once and that piece of work stops running.
 */
function createGuard(note: (type: string, message: string) => void) {
  const failed = new Set<string>();
  return (name: string, work: () => void) => {
    if (failed.has(name)) {
      return;
    }
    try {
      work();
    } catch (error) {
      failed.add(name);
      note('error', `${name} failed and was turned off: ${String(error)}`);
    }
  };
}

/**
 * Feeds the scroll diagnostics timeline from a LegendList conversation. When
 * diagnostics are off this returns the caller's own scroll handler and
 * attaches nothing to the list.
 */
export function useLegendListScrollDiagnostics({
  channelId,
  getBottomCover,
  getKeys,
  initialTopPadding,
  listRef,
  mountInfo,
  scrollHandler,
}: {
  channelId: string;
  /**
   * How much of the bottom of the list's frame the input and the keyboard
   * cover right now. Asked for on its own, not taken from the list's insets:
   * the point is to catch the list working from the wrong ones.
   */
  getBottomCover: () => number;
  /** Row keys in visual order; memoize it on the data it reads. */
  getKeys: () => string[];
  /**
   * The content's top padding when the list mounts. The list only announces
   * later changes to it, and row positions on screen are worked out from it.
   */
  initialTopPadding: number;
  listRef: React.RefObject<LegendListRef | null>;
  /** Why this list instance exists, for its mount entry. */
  mountInfo: string;
  scrollHandler: ScrollHandler;
}) {
  const [enabled] = React.useState(isScrollDiagnosticsEnabled);
  const [label] = React.useState(() => nextInstanceLabel(channelId));
  const keys = React.useMemo(
    () => (enabled ? getKeys() : NO_KEYS),
    [enabled, getKeys]
  );
  // Mutable bookkeeping for the life of the list; never read during render.
  const stateRef = React.useRef<DiagnosticsState | null>(null);
  if (stateRef.current === null) {
    stateRef.current = createDiagnosticsState(keys, initialTopPadding);
  }
  const getState = React.useCallback(() => {
    if (stateRef.current === null) {
      throw new Error('scroll diagnostics state read before initialization');
    }
    return stateRef.current;
  }, []);
  const [mountedWith] = React.useState(mountInfo);

  const note = React.useCallback(
    (type: string, message: string, options?: ScrollDiagNoteOptions) => {
      if (enabled) {
        noteScrollDiagnostics(label, type, message, options);
      }
    },
    [enabled, label]
  );

  const guard = React.useMemo(() => createGuard(note), [note]);

  /** Where the row with `key` currently sits on screen, if it is laid out. */
  const rowScreenTop = React.useCallback(
    (key: string) => {
      const st = getState();
      const listState = listRef.current?.getState();
      const index = st.keys.indexOf(key);
      const position =
        index === -1 ? undefined : listState?.positionAtIndex(index);
      if (!listState || position === undefined) {
        return null;
      }
      const topPad =
        st.topPad.alignItemsAtEndPadding +
        st.topPad.headerSize +
        st.topPad.stylePaddingTop;
      return {
        index,
        size: listState.sizeAtIndex(index) ?? 0,
        top: position + topPad - listState.scroll,
        // By the scroll view's own account of where it is, when it has
        // given one.
        reportedTop: position + topPad - (st.nativeOffset ?? listState.scroll),
        viewport: listState.scrollLength,
      };
    },
    [getState, listRef]
  );

  /**
   * How far the newest message reaches under the input, while the list
   * counts itself at the end. `null` when it does not, or nothing is known.
   */
  const endUnderInput = React.useCallback(() => {
    const st = getState();
    const listState = listRef.current?.getState();
    const lastKey = st.keys[st.keys.length - 1];
    const row = lastKey === undefined ? null : rowScreenTop(lastKey);
    if (
      !listState?.isAtEnd ||
      row === null ||
      st.nativeOffset === null ||
      st.nativeContentHeight === null ||
      st.nativeViewportHeight === null
    ) {
      return null;
    }
    const cover = getBottomCover();
    return {
      cover,
      // Where the list itself puts its end, relative to where it is now. Its
      // end includes the bottom inset it has been told about.
      listEndAhead:
        listState.contentLength - listState.scrollLength - st.nativeOffset,
      coveredBy: row.reportedTop + row.size - (row.viewport - cover),
      canScrollFurtherBy:
        st.nativeContentHeight -
        st.nativeViewportHeight +
        st.nativeInsetBottom -
        st.nativeOffset,
    };
  }, [getBottomCover, getState, listRef, rowScreenTop]);

  const takeSample = React.useCallback(
    (countBlank: boolean): FrameSample | null => {
      const list = listRef.current;
      if (!list) {
        return null;
      }
      const st = getState();
      const listState = list.getState();
      const rows: FrameSample['rows'] = [];
      let blank = 0;
      const first = Math.max(0, listState.start ?? 0);
      const last = Math.min(st.keys.length - 1, listState.end ?? -1);
      for (let i = first; i <= last && rows.length < MAX_SAMPLED_ROWS; i++) {
        const position = listState.positionAtIndex(i);
        if (position === undefined) {
          continue;
        }
        rows.push({
          key: st.keys[i],
          position,
          size: listState.sizeAtIndex(i) ?? 0,
        });
        if (countBlank && !listState.elementAtIndex(i)) {
          blank++;
        }
      }
      return {
        atEnd: listState.isAtEnd,
        blank,
        content: listState.contentLength,
        nearEnd: listState.isWithinMaintainScrollAtEndThreshold,
        rows,
        scroll: listState.scroll,
        topPad:
          st.topPad.alignItemsAtEndPadding +
          st.topPad.headerSize +
          st.topPad.stylePaddingTop,
        viewport: listState.scrollLength,
      };
    },
    [getState, listRef]
  );

  const currentPhase = React.useCallback((): ScrollPhase => {
    const st = getState();
    if (
      st.phase === 'idle' &&
      scrollDiagRecorder.time() - st.phaseChangedAt < GESTURE_SETTLE_MS
    ) {
      return 'momentum';
    }
    return st.phase;
  }, [getState]);

  const activeCauses = React.useCallback(() => {
    const st = getState();
    const now = scrollDiagRecorder.time();
    const causes: string[] = [];
    st.causes.forEach((expiresAt, cause) => {
      if (expiresAt < now) {
        st.causes.delete(cause);
      } else {
        causes.push(cause);
      }
    });
    return causes;
  }, [getState]);

  const noteSizeChanges = React.useCallback(() => {
    const st = getState();
    const changes = st.sizeChanges;
    if (changes.length === 0) {
      return;
    }
    st.sizeChanges = [];
    const listState = listRef.current?.getState();
    const firstVisible = listState?.start ?? 0;
    const lastVisible = listState?.end ?? 0;
    let above = 0;
    let visible = 0;
    let below = 0;
    let firstMeasures = 0;
    const now = scrollDiagRecorder.time();
    if (st.lastSizeChange.size > 300) {
      st.lastSizeChange.clear();
    }
    for (const change of changes) {
      const delta = change.size - change.previous;
      const isFirstMeasure = !st.measuredKeys.has(change.key);
      if (isFirstMeasure) {
        st.measuredKeys.add(change.key);
        firstMeasures++;
      }
      const last = st.lastSizeChange.get(change.key);
      if (
        last &&
        now - last.t < HEIGHT_OSCILLATION_MS &&
        Math.abs(delta) >= VISIBLE_RESIZE_PX &&
        Math.abs(change.size - last.from) < VISIBLE_RESIZE_PX
      ) {
        note(
          'resize',
          `row ${change.key} (index ${change.index}) height went ${Math.round(last.from)}→${Math.round(last.to)}→${Math.round(change.size)} within ${Math.round(now - last.t)}ms${change.inView ? ' while in the viewport' : ''}`,
          st.hidden ? { quiet: true } : { flag: 'warn' }
        );
      }
      st.lastSizeChange.set(change.key, {
        from: change.previous,
        t: now,
        to: change.size,
      });
      if (change.index < firstVisible) {
        above += delta;
      } else if (change.index > lastVisible) {
        below += delta;
      } else {
        visible += delta;
      }
      if (change.inView && Math.abs(delta) >= VISIBLE_RESIZE_PX) {
        const sizes = `${Math.round(change.previous)}→${Math.round(change.size)}`;
        if (!isFirstMeasure) {
          note(
            'resize',
            `row ${change.key} (index ${change.index}) changed height while in the viewport: ${sizes}`,
            st.hidden ? { quiet: true } : { flag: 'warn' }
          );
        } else if (change.mountedFor === undefined) {
          // Measured in the same pass that mounted it, so the estimate was
          // never on screen.
          note(
            'resize',
            `row ${change.key} (index ${change.index}) was measured in the viewport before its first paint: ${sizes}`,
            { quiet: true }
          );
        } else {
          // Until it is measured a row is laid out at the estimate, so it
          // overlaps its neighbour or leaves a gap, and then snaps.
          note(
            'resize',
            `row ${change.key} (index ${change.index}) sat in the viewport at its estimated height for ${Math.round(change.mountedFor)}ms before being measured: ${sizes}`,
            st.hidden ? { quiet: true } : { flag: 'flicker' }
          );
        }
      }
    }
    note(
      'size',
      `${changes.length} rows measured (${firstMeasures} for the first time): above viewport ${px(above)}, visible ${px(visible)}, below ${px(below)}`,
      { quiet: true }
    );
  }, [getState, listRef, note]);

  /**
   * Compares the list's bookkeeping with the last time it was sampled and
   * records what moved. Runs inside the list's own position updates as well
   * as once a frame, so that each update is judged against exactly the
   * corrections it made.
   */
  const compare = React.useCallback(
    (sample: FrameSample | null, phase: ScrollPhase) => {
      const st = getState();
      const corrected = st.corrected;
      const endAlignDelta = st.endAlignDelta;
      st.corrected = 0;
      st.endAlignDelta = 0;
      const previous = st.prevSample;
      st.prevSample = sample;
      if (!sample || !previous) {
        return;
      }
      const analysis = analyzeShift(previous, sample, corrected);
      if (analysis.kind === 'stable') {
        return;
      }
      const causes = activeCauses();
      if (Math.abs(analysis.viewportDelta) > SHIFT_TOLERANCE) {
        causes.push(`viewport ${px(analysis.viewportDelta)}`);
      }
      // Short conversations are padded so their rows sit at the end; that
      // padding shrinks, and the rows move up, as content is added.
      if (Math.abs(endAlignDelta) > SHIFT_TOLERANCE) {
        causes.push(`end-alignment padding ${px(endAlignDelta)}`);
      }
      if (analysis.kind === 'scroll' && sample.atEnd && previous.nearEnd) {
        causes.push('kept at the end');
      }
      const verdict = judgeShift(analysis, {
        causes,
        hidden: st.hidden,
        phase,
      });
      if (verdict) {
        note(verdict.type, verdict.message, {
          data: { ...analysis },
          flag: verdict.flag,
          quiet: !verdict.flag,
        });
      }
    },
    [activeCauses, getState, note]
  );

  // `flush` and `schedule` call each other; this breaks the cycle.
  const scheduleRef = React.useRef(() => {});
  const flush = React.useCallback(() => {
    const st = getState();
    st.flushScheduled = false;
    const sample = takeSample(true);
    const phase = currentPhase();
    const now = scrollDiagRecorder.time();

    noteSizeChanges();

    const stalledFor = now - st.flushRequestedAt;
    if (stalledFor > JS_STALL_MS) {
      st.lastStallAt = now;
      note(
        'stall',
        `JS was busy for ${Math.round(stalledFor)}ms during ${phase}; the scroll view kept moving without new rows or corrections`,
        phase === 'idle' || st.hidden ? { quiet: true } : { flag: 'warn' }
      );
    }

    compare(sample, phase);

    if (sample && !st.hidden) {
      if (sample.blank > 0 && st.blankSince === null) {
        st.blankSince = now;
        note(
          'blank',
          `${sample.blank} of ${sample.rows.length} rows in the viewport have no view during ${phase}`,
          { flag: 'flicker' }
        );
      } else if (sample.blank === 0 && st.blankSince !== null) {
        note(
          'blank',
          `viewport filled again after ${Math.round(now - st.blankSince)}ms`,
          { quiet: true }
        );
        st.blankSince = null;
      }
    }

    if (st.remounts.length > 0) {
      const remounts = st.remounts;
      st.remounts = [];
      for (const { key, gap, left, back } of remounts) {
        // Rows in the margin drawn outside the screen come and go as a fling
        // moves it. One that was in view both before and after left a hole
        // on screen; one seen at only one end was crossing an edge.
        const wasHole = left === 'in view' && back === 'in view';
        const wasAtEdge = left !== 'off screen' || back !== 'off screen';
        note(
          'row',
          `row ${key} remounted ${Math.round(gap)}ms after unmounting; it was ${left} when it went and ${back} when it came back`,
          st.hidden || !wasAtEdge
            ? { quiet: true }
            : { flag: wasHole ? 'flicker' : 'warn' }
        );
      }
    }

    const believedOffset = listRef.current?.getState().scroll;
    const apart =
      believedOffset === undefined || st.nativeOffset === null
        ? 0
        : believedOffset - st.nativeOffset;
    if (
      Math.abs(apart) <= OFFSET_DISAGREEMENT_PX ||
      phase !== 'idle' ||
      st.adjusts.hasPending()
    ) {
      st.offsetsApartSince = null;
      st.offsetsApartNoted = false;
    } else if (st.offsetsApartSince === null) {
      st.offsetsApartSince = now;
      // Nothing else is due to look again once the list has come to rest.
      if (st.offsetsApartTimer === null) {
        st.offsetsApartTimer = setTimeout(() => {
          st.offsetsApartTimer = null;
          scheduleRef.current();
        }, OFFSET_DISAGREEMENT_MS + 50);
      }
    } else if (
      !st.offsetsApartNoted &&
      now - st.offsetsApartSince >= OFFSET_DISAGREEMENT_MS
    ) {
      st.offsetsApartNoted = true;
      note(
        'offset',
        `the list is placing rows for offset ${Math.round(believedOffset ?? 0)} but the scroll view last reported ${Math.round(st.nativeOffset ?? 0)}; what is on screen is ${px(apart)} from where the list thinks`,
        st.hidden ? { quiet: true } : { flag: 'warn' }
      );
    }

    // The list calls itself at the end from anywhere within its bottom inset
    // of it, which is to say with the newest message anywhere from clear of
    // the input to wholly under it. So this measures the message itself.
    if (phase !== 'idle' || st.hidden) {
      st.gestureSinceEndCheck ||= phase !== 'idle';
      st.endCoveredSince = null;
      st.endCoveredNoted = false;
      // Nothing else is due to look again once the list has come to rest.
      if (st.endCoveredTimer === null) {
        st.endCoveredTimer = setTimeout(() => {
          st.endCoveredTimer = null;
          scheduleRef.current();
        }, GESTURE_SETTLE_MS + 80);
      }
    } else {
      const end = endUnderInput();
      if (st.gestureSinceEndCheck) {
        st.gestureSinceEndCheck = false;
        st.endCoverLeftByGesture = end?.coveredBy ?? null;
      }
      if (
        end !== null &&
        (st.endCoverLastNoted === null ||
          Math.abs(end.coveredBy - st.endCoverLastNoted) > END_COVERED_PX)
      ) {
        st.endCoverLastNoted = end.coveredBy;
        note(
          'end',
          `at the end: the newest message ends ${Math.round(Math.abs(end.coveredBy))} ${end.coveredBy > 0 ? 'below' : 'above'} the top of the input (which covers ${Math.round(end.cover)}); the list puts its own end ${Math.round(Math.abs(end.listEndAhead))} ${end.listEndAhead >= 0 ? 'further on' : 'back'}, the scroll view ${Math.round(end.canScrollFurtherBy)} further on`,
          { quiet: true }
        );
      }
      const leftThereByGesture =
        end !== null &&
        st.endCoverLeftByGesture !== null &&
        Math.abs(end.coveredBy - st.endCoverLeftByGesture) <= END_COVERED_PX;
      const isCovered =
        end !== null &&
        end.coveredBy > END_COVERED_PX &&
        // Where a reader stopped is theirs, unless they could go no further.
        (end.canScrollFurtherBy <= 1 || !leftThereByGesture);
      if (!isCovered) {
        st.endCoveredSince = null;
        st.endCoveredNoted = false;
      } else if (st.endCoveredSince === null) {
        st.endCoveredSince = now;
        if (st.endCoveredTimer === null) {
          st.endCoveredTimer = setTimeout(() => {
            st.endCoveredTimer = null;
            scheduleRef.current();
          }, END_COVERED_MS + 50);
        }
      } else if (
        !st.endCoveredNoted &&
        now - st.endCoveredSince >= END_COVERED_MS
      ) {
        st.endCoveredNoted = true;
        note(
          'end',
          `the list counts itself at the end, but the newest message ends ${Math.round(end.coveredBy)} below the top of the input (which covers ${Math.round(end.cover)}); ${
            end.canScrollFurtherBy <= 1
              ? 'the scroll view is at its own end and cannot bring it up'
              : `the scroll view could go ${Math.round(end.canScrollFurtherBy)} further`
          }`,
          { flag: 'jump' }
        );
      }
    }

    for (const missed of st.adjusts.expire(now)) {
      const listState = listRef.current?.getState();
      const atEdge =
        listState &&
        (listState.isAtStart ||
          listState.isAtEnd ||
          listState.contentLength <= listState.scrollLength);
      note(
        'adjust-missed',
        `the list asked the scroll view to move ${px(missed.amount)} ${Math.round(now - missed.t)}ms ago and the native offset never showed it${atEdge ? ' (list is at an edge, where the offset is clamped)' : ''}`,
        // An imperative scroll or inset change moves the offset itself, so
        // the correction cannot be told apart from it.
        st.hidden || activeCauses().length > 0
          ? { quiet: true }
          : {
              // Only at rest, with JS keeping up, is the order of events
              // certain enough to call this a jump outright.
              flag:
                atEdge ||
                phase !== 'idle' ||
                now - st.lastStallAt < STALL_AFTERMATH_MS
                  ? 'warn'
                  : 'jump',
            }
      );
    }

    // A correction that never lands produces no further event to notice it.
    if (st.adjusts.hasPending() && st.expiryTimer === null) {
      st.expiryTimer = setTimeout(() => {
        st.expiryTimer = null;
        scheduleRef.current();
      }, ADJUST_EXPIRY_CHECK_MS);
    }
  }, [
    activeCauses,
    compare,
    currentPhase,
    endUnderInput,
    getState,
    listRef,
    note,
    noteSizeChanges,
    takeSample,
  ]);

  const schedule = React.useCallback(() => {
    const st = getState();
    if (!enabled || st.flushScheduled) {
      return;
    }
    st.flushScheduled = true;
    st.flushRequestedAt = scrollDiagRecorder.time();
    requestAnimationFrame(flush);
  }, [enabled, flush, getState]);
  React.useLayoutEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  /**
   * Declares a legitimate reason for content to move over the next `ms`, so
   * the movement is recorded with that reason instead of flagged.
   */
  const expect = React.useCallback(
    (cause: string, ms = 300) => {
      if (!enabled) {
        return;
      }
      getState().causes.set(cause, scrollDiagRecorder.time() + ms);
      schedule();
    },
    [enabled, getState, schedule]
  );

  const setPhase = React.useCallback(
    (phase: ScrollPhase, reason: string) => {
      const st = getState();
      st.phase = phase;
      st.phaseChangedAt = scrollDiagRecorder.time();
      note('gesture', reason, { quiet: true });
      schedule();
    },
    [getState, note, schedule]
  );

  const onNativeScroll = React.useCallback(
    (
      y: number,
      contentHeight: number,
      viewportHeight: number,
      insetBottom: number,
      uiTime: number
    ) => {
      const st = getState();
      const phase = currentPhase();
      st.nativeOffset = y;
      st.nativeContentHeight = contentHeight;
      st.nativeViewportHeight = viewportHeight;
      st.nativeInsetBottom = insetBottom;
      recordNativeScroll(y, contentHeight, viewportHeight, insetBottom);
      const { landed, step } = st.adjusts.nativeScroll(
        scrollDiagRecorder.time(),
        y,
        phase,
        uiTime
      );
      for (const adjust of landed) {
        note(
          'adjust-landed',
          `native offset took the ${px(adjust.amount)} correction ${Math.round(adjust.latency)}ms after it was requested`,
          { quiet: true }
        );
      }
      const isOverscrolled = y < 0 || y > contentHeight - viewportHeight;
      if (Math.abs(step) > SHIFT_TOLERANCE && !isOverscrolled) {
        note(
          'native-step',
          `native offset stepped ${px(step)} to ${Math.round(y)} ${phase === 'idle' ? 'with no gesture' : 'abruptly, mid-fling'} (content ${Math.round(contentHeight)}, viewport ${Math.round(viewportHeight)})`,
          // Context only: the comparison of the list's own bookkeeping
          // decides what is flagged.
          { quiet: true }
        );
      }
      schedule();
    },
    [currentPhase, getState, note, schedule]
  );

  const diagnosticScrollHandler = useAnimatedScrollHandler((event) => {
    runOnJS(onNativeScroll)(
      event.contentOffset.y,
      event.contentSize.height,
      event.layoutMeasurement.height,
      event.contentInset?.bottom ?? 0,
      // The UI thread's clock: events can reach JS late and in bursts.
      performance.now()
    );
  });
  const composedScrollHandler = useComposedEventHandler([
    scrollHandler,
    diagnosticScrollHandler,
  ]);

  // Declared first so the mount entry precedes the first data and state ones.
  React.useLayoutEffect(() => {
    if (!enabled) {
      return;
    }
    const st = getState();
    st.mountedAt = scrollDiagRecorder.time();
    const tornDownAt = shownListTornDownAt.get(channelId);
    shownListTornDownAt.delete(channelId);
    const rebuiltAfter =
      tornDownAt === undefined ? undefined : st.mountedAt - tornDownAt;
    const wasRebuilt =
      rebuiltAfter !== undefined && rebuiltAfter < LIST_REBUILD_WINDOW_MS;
    note(
      'lifecycle',
      `list mounted with ${st.keys.length} rows (${mountedWith})${wasRebuilt ? `, ${Math.round(rebuiltAfter)}ms after a list that was on screen was torn down` : ''}`,
      // Swapping a list the user was looking at for a new one reads as a flash.
      wasRebuilt ? { flag: 'flicker' } : undefined
    );

    // The list accepts any of its internal signal names here; its public type
    // only lists the ones it documents.
    const listen = listRef.current?.getState().listen as unknown as
      | ListSignalListener
      | undefined;
    const unsubscribers: Array<() => void> = [];
    if (listen) {
      unsubscribers.push(
        listen('scrollAdjust', (value) =>
          guard('correction tracking', () => {
            const amount = (value ?? 0) - st.scrollAdjust;
            st.scrollAdjust = value ?? 0;
            if (Math.abs(amount) > 0.1) {
              st.corrected += amount;
              st.adjusts.request(scrollDiagRecorder.time(), amount);
              note(
                'adjust-request',
                `list asked for a ${px(amount)} offset correction`,
                { quiet: true }
              );
              schedule();
            }
          })
        ),
        listen('lastPositionUpdate', () =>
          guard('per-update sampling', () => {
            schedule();
            compare(takeSample(false), currentPhase());
          })
        ),
        listen('totalSize', (value) =>
          guard('content size tracking', () => {
            note('content', `rows now total ${Math.round(value)}`, {
              quiet: true,
            });
            schedule();
          })
        ),
        listen('footerSize', (value) =>
          guard('footer tracking', () => {
            note('content', `footer is now ${Math.round(value)} tall`);
            st.causes.set('footer resized', scrollDiagRecorder.time() + 300);
            schedule();
          })
        )
      );
      for (const part of [
        'alignItemsAtEndPadding',
        'headerSize',
        'stylePaddingTop',
      ] as const) {
        unsubscribers.push(
          listen(part, (value) =>
            guard('padding tracking', () => {
              note(
                'content',
                `${part} ${Math.round(st.topPad[part])}→${Math.round(value ?? 0)}`,
                { quiet: true }
              );
              if (part === 'alignItemsAtEndPadding') {
                st.endAlignDelta += (value ?? 0) - st.topPad[part];
              }
              st.topPad[part] = value ?? 0;
              schedule();
            })
          )
        );
      }
    }

    const noteKeyboard = (name: string) => (event: KeyboardEvent) => {
      note(
        'keyboard',
        `${name}: height ${Math.round(event.endCoordinates.height)}, ${Math.round(event.duration ?? 0)}ms`
      );
      st.causes.set(
        'keyboard',
        scrollDiagRecorder.time() + (event.duration ?? 0) + 250
      );
      schedule();
    };
    for (const delay of HIDDEN_TOO_LONG_MS) {
      st.timers.push(
        setTimeout(() => {
          if (st.hidden && st.keys.length > 0) {
            note(
              'blank',
              `list is still hidden ${delay}ms after mounting with ${st.keys.length} rows to show`,
              { flag: 'flicker' }
            );
          }
        }, delay)
      );
    }
    const appStateSubscription = AppState.addEventListener(
      'change',
      (appState) => {
        note('app', `app became ${appState}`);
        schedule();
      }
    );

    const keyboardSubscriptions = [
      Keyboard.addListener('keyboardWillShow', noteKeyboard('will show')),
      Keyboard.addListener('keyboardWillHide', noteKeyboard('will hide')),
      Keyboard.addListener('keyboardDidShow', noteKeyboard('did show')),
      Keyboard.addListener('keyboardDidHide', noteKeyboard('did hide')),
    ];

    const unsubscribeRows = subscribeToScrollDiagRows(
      channelId,
      (event: ScrollDiagRowEvent) => {
        if (event.kind === 'mount') {
          st.rowMounts.set(event.key, event.t);
        } else {
          st.rowMounts.delete(event.key);
        }
        const row = rowScreenTop(event.key);
        const seen: RowSighting =
          row === null ||
          row.reportedTop >= row.viewport ||
          row.reportedTop + row.size <= 0
            ? 'off screen'
            : row.reportedTop + row.size <= st.topPad.stylePaddingTop
              ? 'under the header'
              : 'in view';
        if (event.kind === 'unmount') {
          if (st.rowUnmounts.size > 256) {
            st.rowUnmounts.forEach((unmount, key) => {
              if (event.t - unmount.t > ROW_REMOUNT_WINDOW_MS) {
                st.rowUnmounts.delete(key);
              }
            });
          }
          st.rowUnmounts.set(event.key, { t: event.t, seen });
          return;
        }
        const unmount = st.rowUnmounts.get(event.key);
        st.rowUnmounts.delete(event.key);
        if (
          unmount !== undefined &&
          event.t - unmount.t < ROW_REMOUNT_WINDOW_MS
        ) {
          st.remounts.push({
            key: event.key,
            gap: event.t - unmount.t,
            left: unmount.seen,
            back: seen,
          });
          schedule();
        }
      }
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      keyboardSubscriptions.forEach((subscription) => subscription.remove());
      appStateSubscription.remove();
      st.timers.forEach(clearTimeout);
      st.timers = [];
      unsubscribeRows();
      if (st.offsetsApartTimer !== null) {
        clearTimeout(st.offsetsApartTimer);
        st.offsetsApartTimer = null;
      }
      if (st.endCoveredTimer !== null) {
        clearTimeout(st.endCoveredTimer);
        st.endCoveredTimer = null;
      }
      if (st.expiryTimer !== null) {
        clearTimeout(st.expiryTimer);
        st.expiryTimer = null;
      }
      const now = scrollDiagRecorder.time();
      if (st.revealed && !st.hidden) {
        shownListTornDownAt.set(channelId, now);
      }
      note(
        'lifecycle',
        `list unmounted after ${Math.round(now - st.mountedAt)}ms${st.revealed ? '' : ' without ever being shown'}`
      );
    };
  }, [
    channelId,
    compare,
    currentPhase,
    enabled,
    getState,
    guard,
    listRef,
    mountedWith,
    note,
    rowScreenTop,
    schedule,
    takeSample,
  ]);

  React.useLayoutEffect(() => {
    if (!enabled) {
      return;
    }
    const st = getState();
    const previous = st.keys;
    st.keys = keys;
    if (previous === keys) {
      return;
    }
    const diff = diffKeys(previous, keys);
    if (diff.kind === 'none') {
      return;
    }
    const followingEnd =
      listRef.current?.getState().isWithinMaintainScrollAtEndThreshold;
    note(
      'data',
      `${describeKeyDiff(diff)}; ${previous.length}→${keys.length} rows, ${followingEnd ? 'following the end' : 'not following the end'}`,
      diff.reordered ? { flag: 'warn' } : undefined
    );
    const now = scrollDiagRecorder.time();
    if (diff.addedAtEnd > 0 && followingEnd) {
      st.causes.set('new rows while following the end', now + 500);
    }
    if (diff.removed > 0) {
      st.causes.set('rows removed', now + 300);
    }
    if (diff.kind === 'initial' || diff.kind === 'replaced') {
      st.causes.set('rows replaced', now + 300);
    }
    schedule();
  }, [enabled, getState, keys, listRef, note, schedule]);

  /**
   * Call from a layout effect on every render with whether the list is
   * currently invisible and the props and state worth a timeline entry when
   * they change.
   */
  const observe = React.useCallback(
    (hidden: boolean, watch: WatchedValues) => {
      if (!enabled) {
        return;
      }
      const st = getState();
      const now = scrollDiagRecorder.time();
      if (st.hidden !== hidden) {
        if (hidden) {
          st.hiddenAt = now;
          note('visibility', 'list hidden again after it had been shown', {
            flag: 'flicker',
          });
        } else {
          note(
            'visibility',
            st.revealed
              ? `list shown again after ${Math.round(now - (st.hiddenAt ?? now))}ms hidden`
              : `list first shown ${Math.round(now - st.mountedAt)}ms after mounting`
          );
          st.revealed = true;
        }
        st.hidden = hidden;
        // Whatever moved while hidden was never seen; start comparing afresh.
        st.prevSample = null;
        st.corrected = 0;
        st.endAlignDelta = 0;
        schedule();
      }

      if (st.watch === null) {
        note(
          'state',
          Object.entries(watch)
            .map(([key, value]) => `${key}=${String(value)}`)
            .join(', ')
        );
      } else {
        const changes = describeChanges(st.watch, watch);
        if (changes.length > 0) {
          note('state', changes.join(', '));
          schedule();
        }
      }
      st.watch = watch;
    },
    [enabled, getState, note, schedule]
  );

  const listProps = React.useMemo(
    (): ListProps =>
      enabled
        ? {
            onItemSizeChanged: (info: {
              index: number;
              itemKey: string;
              previous: number;
              size: number;
            }) =>
              guard('size tracking', () => {
                const listState = listRef.current?.getState();
                const st = getState();
                const mountedAt = st.rowMounts.get(info.itemKey);
                st.sizeChanges.push({
                  index: info.index,
                  mountedFor:
                    mountedAt === undefined
                      ? undefined
                      : scrollDiagRecorder.time() - mountedAt,
                  inView:
                    listState !== undefined &&
                    info.index >= listState.start &&
                    info.index <= listState.end,
                  key: info.itemKey,
                  previous: info.previous,
                  size: info.size,
                });
                schedule();
              }),
          }
        : NO_LIST_PROPS,
    [enabled, getState, guard, listRef, schedule]
  );

  // The list has its own use for these, so they are handed back to be called
  // from its handlers rather than spread onto it.
  const onScrollEndDrag = React.useCallback(() => {
    if (enabled) {
      setPhase('idle', 'drag released');
    }
  }, [enabled, setPhase]);
  const onMomentumScrollBegin = React.useCallback(() => {
    if (enabled) {
      setPhase('momentum', 'momentum began');
    }
  }, [enabled, setPhase]);
  const onMomentumScrollEnd = React.useCallback(() => {
    if (enabled) {
      setPhase('idle', 'momentum ended');
    }
  }, [enabled, setPhase]);

  const onScrollBeginDrag = React.useCallback(() => {
    if (enabled) {
      getState().userScrolled = true;
      setPhase('drag', 'drag began');
    }
  }, [enabled, getState, setPhase]);

  const checkLanding = React.useCallback(
    (afterMs: number) => {
      const st = getState();
      const landing = st.landing;
      const listState = listRef.current?.getState();
      // Once the user scrolls, where the list sits is theirs to decide.
      if (!landing || !listState || st.hidden || st.userScrolled) {
        return;
      }
      if (landing.target === 'end') {
        const gap =
          listState.contentLength - listState.scrollLength - listState.scroll;
        if (!listState.isAtEnd && gap > LANDING_TOLERANCE) {
          note(
            'landing',
            `${afterMs}ms after opening at the newest message, the conversation sits ${Math.round(gap)} above it`,
            { flag: 'jump' }
          );
        }
        return;
      }
      if (landing.key === null) {
        return;
      }
      const row = rowScreenTop(landing.key);
      if (!row) {
        note(
          'landing',
          `${afterMs}ms after opening, the message it opened on is no longer in the list`,
          { flag: 'warn' }
        );
        return;
      }
      // Judged by where the scroll view says it is: the list's own figure is
      // what goes wrong when a correction is lost on the way to it.
      const top = row.reportedTop;
      if (top + row.size <= 0 || top >= row.viewport) {
        note(
          'landing',
          `${afterMs}ms after opening, the message it opened on is off screen (its top is at ${Math.round(top)} in a ${Math.round(row.viewport)} viewport)`,
          { flag: 'jump' }
        );
        return;
      }
      note(
        'landing',
        `${afterMs}ms after opening, the message it opened on sits at ${Math.round(top)}, with ${Math.round(listState.contentLength - listState.scrollLength - listState.scroll)} of the conversation below the screen`,
        { quiet: true }
      );
      // A post asked for at the top of the list sits there unless the content
      // ends or begins too soon to allow it.
      const misplacedBy = top - landing.target.viewOffset;
      if (
        landing.target.viewPosition === 0 &&
        !listState.isAtEnd &&
        !listState.isAtStart &&
        Math.abs(misplacedBy) > LANDING_TOLERANCE
      ) {
        note(
          'landing',
          `${afterMs}ms after opening, the message it opened on is ${px(misplacedBy)} from where it was asked to be`,
          { flag: 'jump' }
        );
        return;
      }
      const moved = landing.shownAt === null ? 0 : top - landing.shownAt;
      // A list resting at its end moves the post up as messages arrive.
      if (Math.abs(moved) > LANDING_TOLERANCE && !listState.isAtEnd) {
        note(
          'landing',
          `${afterMs}ms after opening, the message it opened on has moved ${px(moved)} on screen with no scrolling`,
          { flag: 'jump' }
        );
      }
    },
    [getState, listRef, note, rowScreenTop]
  );

  /**
   * Call each time the list has been put at its opening position. The
   * position is checked again shortly after, since landing right and then
   * moving is as visible as landing wrong.
   */
  const expectLanding = React.useCallback(
    (target: LandingTarget) => {
      if (!enabled) {
        return;
      }
      const st = getState();
      const key = target === 'end' ? null : (st.keys[target.index] ?? null);
      st.landing = {
        key,
        shownAt: key === null ? null : (rowScreenTop(key)?.top ?? null),
        target,
      };
      for (const delay of LANDING_CHECKS_MS) {
        st.timers.push(setTimeout(() => checkLanding(delay), delay));
      }
    },
    [checkLanding, enabled, getState, rowScreenTop]
  );

  // Stable for the life of the list, so it is safe in dependency arrays.
  const timeline = React.useMemo(
    () => ({ expect, expectLanding, note }),
    [expect, expectLanding, note]
  );

  return {
    enabled,
    listProps,
    observe,
    onMomentumScrollBegin,
    onMomentumScrollEnd,
    onScroll: enabled ? composedScrollHandler : scrollHandler,
    onScrollBeginDrag,
    onScrollEndDrag,
    timeline,
  };
}

export type ScrollDiagnosticsTimeline = ReturnType<
  typeof useLegendListScrollDiagnostics
>['timeline'];
