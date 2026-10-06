/**
 * Marks %activity sources read once the bot has finished with the messages it
 * received in them, so restart replay (restart-replay.ts) only picks up
 * messages the plugin never got to.
 *
 * %activity keeps one read floor per source and no longer supports marking a
 * single event read, and the floor is compared against the time %activity
 * received each event, which the plugin never sees. So this marks the whole
 * channel or DM (and its threads) read up to its latest event, and only once
 * no other message from that source is still being handled. Turns that fail,
 * or that a graceful shutdown cuts short, leave the source unread.
 *
 * A whole-source read is only safe once the plugin has seen everything below
 * the floor it sets. Right after a restart it hasn't: the messages that arrived
 * while the gateway was down are what replay is looking for. So reads start
 * gated. Replay opens the gate for every source without backlog as soon as it
 * has its snapshot, and for each backlog source once its last replayed message
 * is done. `releaseAll` (catch-up over, replay failed) and a hard cap make
 * sure a hold never outlasts startup. Holding only defers the read pokes;
 * messages are handled live throughout.
 */

/** Longest reads stay gated after monitor start, whatever replay is doing. */
export const ACTIVITY_READ_HOLD_MAX_MS = 3 * 60 * 1000;

/** What `readChannel` needs to address a channel or DM. */
export interface ActivityReadTarget {
  channelId: string;
  channelType: 'chat' | 'dm' | 'groupDm';
  groupId?: string | null;
}

/** Tracker keys, shared by the firehose handlers and replay. */
export const channelReadKey = (nest: string) => `channel/${nest}`;
export const dmReadKey = (whom: string) => `dm/${whom}`;

export function dmReadTarget(whom: string): ActivityReadTarget {
  return {
    channelId: whom,
    channelType: whom.startsWith('~') ? 'dm' : 'groupDm',
  };
}

type ResolveTarget = () =>
  | ActivityReadTarget
  | null
  | Promise<ActivityReadTarget | null>;

export function createActivityReadTracker(deps: {
  /** Marks the target (and its threads) read; retries are its concern. */
  markRead: (target: ActivityReadTarget) => Promise<unknown>;
  isStopping: () => boolean;
  onError?: (error: unknown, target: ActivityReadTarget | null) => void;
  holdMaxMs?: number;
}) {
  const inFlight = new Map<string, { count: number; failed: boolean }>();
  // Sources that went idle while gated. A source is never both held and in
  // flight: a new message clears its held entry, and marks it when it ends.
  const held = new Map<string, ResolveTarget>();
  // null: everything is gated. Otherwise only these keys still are.
  let gated: Set<string> | null = null;
  const isGated = (key: string) => gated === null || gated.has(key);

  const send = async (resolve: ResolveTarget) => {
    let target: ActivityReadTarget | null = null;
    try {
      target = await resolve();
      if (!target || deps.isStopping()) return;
      await deps.markRead(target);
    } catch (error) {
      deps.onError?.(error, target);
    }
  };

  const flush = () => {
    for (const [key, resolve] of held) {
      if (isGated(key)) continue;
      held.delete(key);
      if (!deps.isStopping()) void send(resolve);
    }
  };

  /** Open the gate for every source except those with replay backlog. */
  const releaseExcept = (backlog: Iterable<string>) => {
    gated = new Set(gated === null ? backlog : [...backlog].filter(isGated));
    flush();
  };
  /** Open the gate for one backlog source, once replay is done with it. */
  const release = (key: string) => {
    if (gated === null) return;
    gated.delete(key);
    flush();
  };
  const releaseAll = () => {
    gated = new Set();
    flush();
  };

  const cap = setTimeout(
    releaseAll,
    deps.holdMaxMs ?? ACTIVITY_READ_HOLD_MAX_MS
  );
  cap.unref?.();

  /**
   * Call when the plugin accepts a new message. `key` names its channel or
   * DM; `resolveTarget` addresses it when the read is sent. The returned
   * function must be called once, when the plugin is done: `handled` false
   * leaves the source unread so a restart's replay can retry it.
   */
  const begin = (
    key: string,
    resolveTarget: ResolveTarget
  ): ((handled?: boolean) => void) => {
    held.delete(key);
    const entry = inFlight.get(key) ?? { count: 0, failed: false };
    entry.count += 1;
    inFlight.set(key, entry);
    let ended = false;
    return (handled = true) => {
      if (ended) return;
      ended = true;
      if (!handled) entry.failed = true;
      entry.count -= 1;
      if (entry.count > 0) return;
      inFlight.delete(key);
      if (entry.failed || deps.isStopping()) return;
      if (isGated(key)) {
        held.set(key, resolveTarget);
        return;
      }
      void send(resolveTarget);
    };
  };

  return { begin, releaseExcept, release, releaseAll };
}
