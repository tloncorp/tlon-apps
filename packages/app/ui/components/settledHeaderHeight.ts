import { useEffect, useState, useSyncExternalStore } from 'react';

// How far the last native header to report was from the navigator's guess
// for it, for screens whose own header has not reported yet. The guess is off
// by the same amount whatever it is, while the height itself depends on the
// screen's size: a portrait height borrowed in landscape was wrong.
let lastHeaderGuessError: number | null = null;

// What a native header turned out to be, keyed by the navigator's guess for
// it. The guess depends on the screen's size and safe area, so a rotation gets
// its own entry instead of borrowing the other orientation's height.
const reportedHeaderHeightByGuess = new Map<number, number>();
const headerHeightListeners = new Set<() => void>();

function recordReportedHeaderHeight(guess: number, reported: number) {
  lastHeaderGuessError = reported - guess;
  const key = Math.round(guess);
  if (reportedHeaderHeightByGuess.get(key) === reported) {
    return;
  }
  reportedHeaderHeightByGuess.set(key, reported);
  headerHeightListeners.forEach((listener) => listener());
}

function subscribeToReportedHeaderHeights(listener: () => void) {
  headerHeightListeners.add(listener);
  return () => {
    headerHeightListeners.delete(listener);
  };
}

/** Forgets every reported height; for tests. */
export function resetReportedHeaderHeights() {
  lastHeaderGuessError = null;
  reportedHeaderHeightByGuess.clear();
}

// How long a screen's header may take to report its real height. Past this, a
// header still at the navigator's guess is taken to be that height, unless
// another header with the same guess has reported a different one.
export const HEADER_REPORT_WAIT_MS = 500;

/**
 * The header's height, or until this screen's header reports one, the
 * navigator's guess corrected by as much as the last header's was. A
 * conversation used to open with no top inset and
 * gain it a moment later, and the list's correction for that, made while it
 * sat at its top where the offset cannot move, came back as a jump once
 * older posts arrived above.
 *
 * Until the native header reports, the navigator gives each screen its own
 * guess at the height (`guess`), which on iOS 26 is 15 points short. Taking
 * that guess moved every conversation's top inset twice while it opened, each
 * time laying out and measuring its rows again before it could be shown.
 *
 * A screen restored beneath another one (relaunching into a thread) never
 * shows its header, so it never reports. It takes the height another header
 * with the same guess reported, even after it has waited out the guess;
 * otherwise going back to it moved its rows by those 15 points.
 *
 * `reported` is 0 until the navigator has any height, and for good on a
 * screen that hides its header.
 */
export function useSettledHeaderHeight(reported: number, guess: number) {
  const isGuess = reported > 0 && Math.abs(reported - guess) < 0.5;
  const knownHeight = useSyncExternalStore(
    subscribeToReportedHeaderHeights,
    () => reportedHeaderHeightByGuess.get(Math.round(guess))
  );
  const [guessIsFinal, setGuessIsFinal] = useState(false);
  useEffect(() => {
    if (reported > 0 && !isGuess) {
      recordReportedHeaderHeight(guess, reported);
    }
    if (!isGuess) {
      return;
    }
    const timeout = setTimeout(
      () => setGuessIsFinal(true),
      HEADER_REPORT_WAIT_MS
    );
    return () => clearTimeout(timeout);
  }, [guess, isGuess, reported]);
  if (reported > 0 && !isGuess) {
    return reported;
  }
  if (knownHeight !== undefined) {
    return knownHeight;
  }
  if (isGuess && guessIsFinal) {
    return reported;
  }
  return lastHeaderGuessError === null
    ? reported || guess
    : guess + lastHeaderGuessError;
}
