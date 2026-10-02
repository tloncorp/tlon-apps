import { AppState } from 'react-native';

type AppStateLike = {
  currentState: string | null;
  isAvailable?: boolean;
  addEventListener: (
    type: 'change',
    listener: (state: string) => void
  ) => { remove: () => void };
};

type ForegroundTimeoutOptions = {
  appState?: AppStateLike;
  now?: () => number;
};

export type ForegroundTimeout = {
  cancel: () => void;
  activeElapsedMs: () => number;
};

/**
 * A timeout that only counts time spent in the `active` AppState.
 *
 * iOS freezes JS while the app is suspended, and a plain `setTimeout` whose
 * due time passed during the suspension fires the moment the app resumes. A
 * startup deadline armed before a suspension therefore fires on resume against
 * work that has barely had any foreground time. This one pauses whenever the
 * app leaves `active` and resumes with whatever budget is left, and it doesn't
 * start counting at all until the app is first active, which covers a
 * background launch where no transition is ever observed.
 *
 * It relies on JS seeing the `background` event before the app is suspended.
 * If JS is frozen first, the event is only handled on resume, alongside the
 * now-overdue timer, and either order charges the suspension to the budget:
 * timer first, the overdue timer fires on resume; event first, the pause
 * measures the whole frozen interval as active time, so the next `active`
 * arms a zero-delay timer. Telling a suspension apart from a long foreground
 * JS stall isn't possible from here, so this is left as is.
 *
 * Falls back to a plain timeout where AppState is unavailable.
 */
export function startForegroundTimeout(
  ms: number,
  onFire: () => void,
  {
    appState = AppState as AppStateLike | undefined,
    now = Date.now,
  }: ForegroundTimeoutOptions = {}
): ForegroundTimeout {
  let consumedMs = 0;
  let activeSince: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let finished = false;
  let subscription: { remove: () => void } | null = null;

  function settleActiveTime() {
    if (activeSince !== null) {
      consumedMs += Math.max(0, now() - activeSince);
      activeSince = null;
    }
  }

  function stop() {
    finished = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    settleActiveTime();
    subscription?.remove();
    subscription = null;
  }

  function arm() {
    if (finished || timer !== null) {
      return;
    }
    activeSince = now();
    timer = setTimeout(
      () => {
        timer = null;
        stop();
        onFire();
      },
      Math.max(0, ms - consumedMs)
    );
  }

  function pause() {
    if (timer === null) {
      return;
    }
    clearTimeout(timer);
    timer = null;
    settleActiveTime();
  }

  if (!appState || appState.isAvailable === false) {
    arm();
  } else {
    subscription = appState.addEventListener('change', (state) => {
      if (state === 'active') {
        arm();
      } else {
        pause();
      }
    });
    if (appState.currentState === 'active') {
      arm();
    }
  }

  return {
    cancel: stop,
    activeElapsedMs: () =>
      consumedMs +
      (activeSince === null ? 0 : Math.max(0, now() - activeSince)),
  };
}
