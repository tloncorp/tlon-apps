/**
 * The channels this ship has joined, per `%channels`: seeded from the init
 * snapshot and kept current from the `/v4` firehose's join/create/leave facts.
 * It may only suppress onboarding scans of channels known not to be joined;
 * while it is unknown, nothing is suppressed.
 */
export function createJoinedChannels({ now = Date.now } = {}) {
  let nests = new Set<string>();
  let known = false;
  // When each nest became joined while the set was known, so a scan the
  // guard skipped before the join can be retried for a while after it.
  const joinedAt = new Map<string, number>();
  let nextToken = 0;
  let appliedToken = 0;
  const pending = new Set<number>();
  // Facts observed while a sync is in flight, tagged with the newest token
  // begun at the time, so a snapshot fetched before a fact cannot undo it.
  let deltas: { token: number; nest: string; joined: boolean }[] = [];

  const record = (nest: string, joined: boolean) => {
    if (pending.size > 0) deltas.push({ token: nextToken, nest, joined });
    if (joined) nests.add(nest);
    else nests.delete(nest);
  };

  const markTransition = (nest: string, joined: boolean) => {
    if (!joined) joinedAt.delete(nest);
    else if (known) joinedAt.set(nest, now());
  };

  return {
    beginSync(): number {
      pending.add(++nextToken);
      return nextToken;
    },
    applySync(token: number, snapshot: Set<string> | null): void {
      pending.delete(token);
      // A failed fetch says nothing about membership; keep what is known.
      if (snapshot !== null && token > appliedToken) {
        appliedToken = token;
        const before = nests;
        nests = new Set(snapshot);
        for (const delta of deltas) {
          if (delta.token < token) continue;
          if (delta.joined) nests.add(delta.nest);
          else nests.delete(delta.nest);
        }
        // A missed join fact shows up only as a snapshot difference.
        for (const nest of nests) {
          if (!before.has(nest)) markTransition(nest, true);
        }
        for (const nest of before) {
          if (!nests.has(nest)) markTransition(nest, false);
        }
        known = true;
      }
      const oldest = Math.min(...pending);
      deltas = deltas.filter((delta) => delta.token >= oldest);
    },
    observe(event: {
      nest?: string;
      response?: unknown;
    }): 'became-joined' | 'left' | null {
      const { nest, response } = event ?? {};
      if (!nest || !response || typeof response !== 'object') return null;
      // `leave` is `{leave: null}` on the wire.
      if ('leave' in response) {
        record(nest, false);
        markTransition(nest, false);
        return 'left';
      }
      if ('join' in response || 'create' in response) {
        const wasJoined = nests.has(nest);
        record(nest, true);
        if (wasJoined) return null;
        markTransition(nest, true);
        return 'became-joined';
      }
      return null;
    },
    /** Nests joined within the last `withinMs`; older entries are dropped. */
    recentlyJoined(withinMs: number): string[] {
      const cutoff = now() - withinMs;
      for (const [nest, at] of joinedAt) {
        if (at < cutoff) joinedAt.delete(nest);
      }
      return [...joinedAt.keys()];
    },
    isKnownNotJoined(nest: string): boolean {
      return known && !nests.has(nest);
    },
  };
}

export type JoinedChannels = ReturnType<typeof createJoinedChannels>;
