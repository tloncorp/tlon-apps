/**
 * Marks %activity sources read once the bot has finished with the messages it
 * received in them, so restart catch-up (`tlon activity ... --unread`) only
 * sees messages the plugin never got to.
 *
 * %activity keeps one read floor per source and no longer supports marking a
 * single event read, and the floor is compared against the time %activity
 * received each event, which the plugin never sees. So this marks the whole
 * channel or DM (and its threads) read up to its latest event, and only once
 * no other message from that source is still being handled. A graceful
 * shutdown aborts in-flight turns; those are left unread for catch-up.
 *
 * A whole-source read is only safe when the plugin has seen everything below
 * the floor it sets. Right after a restart it hasn't: the messages that arrived
 * while the gateway was down are exactly what catch-up is looking for. So
 * reads wait for `ready` (restart catch-up has finished) and then flush.
 */

export type ActivityReadSource =
  | { channel: { nest: string; group: string } }
  | { dm: { ship: string } | { club: string } };

export function channelReadSource(
  nest: string,
  group: string | undefined
): ActivityReadSource | null {
  // A channel source names its group; without one %activity has no index to
  // read, so skip rather than send a read that silently does nothing.
  if (!group) return null;
  return { channel: { nest, group } };
}

export function dmReadSource(whom: string): ActivityReadSource | null {
  if (!whom) return null;
  return whom.startsWith('~') ? { dm: { ship: whom } } : { dm: { club: whom } };
}

/** The poke that marks `source` (and everything under it) read up to its
 * latest event. `{ base: null }` is every source at once. */
export function activityReadPoke(source: ActivityReadSource | { base: null }) {
  return {
    app: 'activity',
    // The oldest action mark; every %activity version accepts it for base,
    // channel and DM sources.
    mark: 'activity-action',
    json: { read: { source, action: { all: { time: null, deep: true } } } },
  };
}

const READ_ATTEMPTS = 3;
const READ_RETRY_BASE_MS = 1_000;

export function createActivityReadTracker(deps: {
  poke: (params: {
    app: string;
    mark: string;
    json: unknown;
  }) => Promise<unknown>;
  isStopping: () => boolean;
  /** Resolves once restart catch-up is done; reads are held until then. */
  ready: Promise<void>;
  onError?: (error: unknown, source: ActivityReadSource) => void;
  sleep?: (ms: number) => Promise<void>;
}) {
  const sleep =
    deps.sleep ??
    ((ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms).unref?.()));
  const inFlight = new Map<string, number>();
  // Sources handled before `ready`, keyed like inFlight. The resolver runs at
  // flush time, so a group mapping that arrives meanwhile is picked up.
  const held = new Map<string, () => ActivityReadSource | null>();
  let isReady = false;

  const markRead = async (resolve: () => ActivityReadSource | null) => {
    const source = resolve();
    if (!source) return;
    for (let attempt = 1; ; attempt += 1) {
      if (deps.isStopping()) return;
      try {
        await deps.poke(activityReadPoke(source));
        return;
      } catch (error) {
        if (attempt >= READ_ATTEMPTS) {
          deps.onError?.(error, source);
          return;
        }
        await sleep(READ_RETRY_BASE_MS * 2 ** (attempt - 1));
      }
    }
  };

  void deps.ready.then(() => {
    isReady = true;
    const pending = [...held.values()];
    held.clear();
    for (const resolve of pending) void markRead(resolve);
  });

  /**
   * Call when the plugin accepts a new message. `key` names its channel or
   * DM; `resolveSource` builds the %activity source when the read is sent.
   * The returned function must be called once, when the plugin is done.
   */
  const begin = (
    key: string,
    resolveSource: () => ActivityReadSource | null
  ): (() => void) => {
    inFlight.set(key, (inFlight.get(key) ?? 0) + 1);
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      const remaining = (inFlight.get(key) ?? 1) - 1;
      if (remaining > 0) {
        inFlight.set(key, remaining);
        return;
      }
      inFlight.delete(key);
      if (deps.isStopping()) return;
      if (!isReady) {
        held.set(key, resolveSource);
        return;
      }
      void markRead(resolveSource);
    };
  };

  return { begin };
}
