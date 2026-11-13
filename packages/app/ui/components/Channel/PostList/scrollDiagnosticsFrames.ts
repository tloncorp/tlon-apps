import { runOnJS, runOnUI } from 'react-native-reanimated';

/**
 * Frame pacing, watched from the UI thread.
 *
 * The rest of the scroll diagnostics run on the JS thread and describe where
 * things are. They cannot see a frame the display never got: a stutter in a
 * fling or in a screen sliding in happens on the UI thread, often while the
 * JS thread is itself too busy to notice anything. This asks for every display
 * frame on the UI thread and reports the ones that came late.
 *
 * A frame's timestamp is the display refresh it was drawn for, so a late one
 * is late by whole refreshes and the count of frames missed is exact. It says
 * the UI thread was held up; it cannot see a frame that was delivered on time
 * with the wrong thing in it.
 */

const CLOCK_SAMPLES = 5;
const REPORT_EVERY_MS = 250;
// A frame counts as late once the gap before it is half a refresh over.
const LATE_FACTOR = 1.5;
// The refresh interval is taken as the median of this many recent gaps, so
// it follows a display that changes rate and ignores the odd long gap.
const RECENT_GAPS = 9;

/**
 * Works out what to add to the UI thread's clock to get `now()`'s, and passes
 * it to `onOffset` each time a better estimate arrives.
 */
export function syncUiClock(
  now: () => number,
  onOffset: (offset: number) => void
) {
  let fastestRoundTrip = Infinity;
  const receive = (uiNow: number, sentAt: number) => {
    const roundTrip = performance.now() - sentAt;
    // The quickest exchange is the one least distorted by a busy thread.
    if (roundTrip < fastestRoundTrip) {
      fastestRoundTrip = roundTrip;
      onOffset(now() - roundTrip / 2 - uiNow);
    }
  };
  const timers = Array.from({ length: CLOCK_SAMPLES }, (_, sample) =>
    setTimeout(() => {
      const sentAt = performance.now();
      runOnUI(() => {
        runOnJS(receive)(performance.now(), sentAt);
      })();
    }, sample * 120)
  );
  return () => timers.forEach(clearTimeout);
}

export type FrameReport = {
  /** Frames seen since the last report, and the time they spanned. */
  frames: number;
  elapsedMs: number;
  /** The late ones, as `uiTime, gap, interval` triples on the UI clock. */
  late: number[];
};

let isWatching = false;

/** Starts watching display frames; `onReport` is called on the JS thread. */
export function watchFrames(onReport: (report: FrameReport) => void) {
  if (isWatching) {
    return;
  }
  isWatching = true;
  runOnUI(() => {
    let previous = -1;
    let lastReport = 0;
    let frames = 0;
    let elapsedMs = 0;
    let late: number[] = [];
    const recent: number[] = [];

    const tick = (timestamp: number) => {
      const now = performance.now();
      if (previous >= 0) {
        const gap = timestamp - previous;
        frames += 1;
        elapsedMs += gap;
        if (recent.length >= 3) {
          const interval = recent.slice().sort((a, b) => a - b)[
            recent.length >> 1
          ];
          if (gap > interval * LATE_FACTOR) {
            late.push(now, gap, interval);
          }
        }
        recent.push(gap);
        if (recent.length > RECENT_GAPS) {
          recent.shift();
        }
      }
      previous = timestamp;
      if (now - lastReport >= REPORT_EVERY_MS) {
        lastReport = now;
        runOnJS(onReport)({ frames, elapsedMs, late });
        frames = 0;
        elapsedMs = 0;
        late = [];
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })();
}
