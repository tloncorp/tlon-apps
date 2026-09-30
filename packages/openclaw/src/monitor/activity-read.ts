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

export function createActivityReadTracker(deps: {
  poke: (params: {
    app: string;
    mark: string;
    json: unknown;
  }) => Promise<unknown>;
  isStopping: () => boolean;
  onError?: (error: unknown, source: ActivityReadSource) => void;
}) {
  const inFlight = new Map<string, number>();

  const markRead = (source: ActivityReadSource) =>
    deps
      .poke(activityReadPoke(source))
      .catch((error) => deps.onError?.(error, source));

  /**
   * Call when the plugin accepts a new message from `source`. The returned
   * function must be called exactly once, when the plugin is done with it.
   */
  const begin = (source: ActivityReadSource | null): (() => void) => {
    if (!source) return () => {};
    const key = JSON.stringify(source);
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
      void markRead(source);
    };
  };

  return { begin };
}
