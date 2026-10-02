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
 * A whole-source read is only safe when the plugin has seen everything below
 * the floor it sets. Right after a restart it hasn't: the messages that arrived
 * while the gateway was down are exactly what replay is looking for. So reads
 * wait for `ready` (restart catch-up has finished) and then flush.
 */

/** What `readChannel` needs to address a channel or DM. */
export interface ActivityReadTarget {
  channelId: string;
  channelType: 'chat' | 'dm' | 'groupDm';
  groupId?: string | null;
}

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
  /** Resolves once restart catch-up is done; reads are held until then. */
  ready: Promise<void>;
  onError?: (error: unknown, target: ActivityReadTarget | null) => void;
}) {
  const inFlight = new Map<string, { count: number; failed: boolean }>();
  // Sources that went idle before `ready`. A source is never both held and in
  // flight: a new message clears its held entry, and marks it when it ends.
  const held = new Map<string, ResolveTarget>();
  let isReady = false;

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

  void deps.ready.then(() => {
    isReady = true;
    const pending = [...held.values()];
    held.clear();
    for (const resolve of pending) void send(resolve);
  });

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
      if (!isReady) {
        held.set(key, resolveTarget);
        return;
      }
      void send(resolveTarget);
    };
  };

  return { begin };
}
