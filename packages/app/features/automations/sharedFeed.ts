/**
 * One subscription shared by every screen that reads the same feed. It opens
 * with the first user and closes with the last. While anyone is still using
 * it, a subscription the ship turns down is opened again after a pause.
 */
export interface SharedFeedOptions<Update> {
  /**
   * Opens the subscription and resolves with its id once the ship has the
   * request. `onRejected` hears a refusal that arrives after that.
   */
  open: (
    onUpdate: (update: Update, id?: number) => void,
    onRejected: (error: unknown) => void
  ) => Promise<number>;
  close: (id: number) => unknown;
  onUpdate: (update: Update) => void;
  /** Asked before each new attempt; false leaves the feed closed. */
  shouldReopen?: () => boolean;
  /** The wait before each attempt in a row; the last one repeats. */
  retryDelaysMs?: readonly number[];
}

const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

export function createSharedFeed<Update>({
  open,
  close,
  onUpdate,
  shouldReopen = () => true,
  retryDelaysMs = RETRY_DELAYS_MS,
}: SharedFeedOptions<Update>) {
  let users = 0;
  // The attempt in use. Callbacks from an earlier attempt compare against
  // it, so a late failure cannot take down the subscription that replaced it.
  let current: object | null = null;
  let opened: Promise<number> | null = null;
  // A channel reset replays the watch under a new id, so the id on the
  // latest update is the one to close; the id the open resolved with may by
  // then name another subscription.
  let latestId: number | undefined;
  let failures = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function start() {
    const attempt = {};
    current = attempt;
    latestId = undefined;
    const failed = () => {
      if (current !== attempt) return;
      current = null;
      opened = null;
      latestId = undefined;
      scheduleReopen();
    };
    let opening: Promise<number>;
    try {
      opening = open((update, id) => {
        // A subscription that was released or replaced can still deliver
        // what the ship had already sent; the one in use has newer state.
        if (current !== attempt) return;
        if (id !== undefined) latestId = id;
        failures = 0;
        onUpdate(update);
      }, failed);
    } catch (error) {
      opening = Promise.reject(error);
    }
    opened = opening;
    opening.catch(failed);
  }

  function scheduleReopen() {
    if (users === 0 || retryTimer) return;
    const delay = retryDelaysMs[Math.min(failures, retryDelaysMs.length - 1)];
    failures += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (users > 0 && !current && shouldReopen()) start();
    }, delay);
  }

  /** Use the feed. Returns the function that stops using it. */
  function retain() {
    users += 1;
    if (!current && !retryTimer) start();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      users -= 1;
      if (users > 0) return;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      failures = 0;
      const closing = opened;
      const id = latestId;
      current = null;
      opened = null;
      latestId = undefined;
      void closing?.then((openedId) => close(id ?? openedId)).catch(() => {});
    };
  }

  /**
   * Opens the feed again if it is in use and was left closed, which is what
   * `shouldReopen` answering false does. For when something else has since
   * shown that the ship would now accept it.
   */
  retain.wake = () => {
    if (users > 0 && !current && !retryTimer) start();
  };

  return retain;
}

/**
 * Reads the state a feed keeps current, without letting the read undo the
 * feed. A fact that arrives while a read is out may be newer than what the
 * read saw, and the feed does not send it again. The read is then made
 * again: one sent after the fact arrived reflects it.
 *
 * If facts arrive during every attempt, the last read is no better than the
 * first. What the feed has built by then is the newer state, so that is
 * returned when there is any; the read is the answer only without it.
 */
export async function readAlongsideFeed<T>(
  read: () => Promise<T>,
  /** How many facts the feed has delivered so far. */
  factsSoFar: () => number,
  {
    attempts = 3,
    keptByFeed,
  }: {
    attempts?: number;
    /** The state as the feed has it, if it has delivered one. */
    keptByFeed?: () => T | undefined;
  } = {}
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    const before = factsSoFar();
    const result = await read();
    if (factsSoFar() === before) return result;
    if (attempt >= attempts) return keptByFeed?.() ?? result;
  }
}
