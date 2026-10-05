/**
 * The channels this ship has joined, per `%channels`: seeded from the init
 * snapshot and kept current from the `/v4` firehose's join/create/leave facts.
 * It may only suppress onboarding scans of channels known not to be joined;
 * while it is unknown, nothing is suppressed.
 */
export function createJoinedChannels() {
  let nests = new Set<string>();
  let known = false;
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

  return {
    beginSync(): number {
      pending.add(++nextToken);
      return nextToken;
    },
    applySync(token: number, snapshot: Set<string> | null): void {
      pending.delete(token);
      if (token > appliedToken) {
        appliedToken = token;
        known = snapshot !== null;
        nests = new Set(snapshot);
        for (const delta of deltas) {
          if (delta.token < token) continue;
          if (delta.joined) nests.add(delta.nest);
          else nests.delete(delta.nest);
        }
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
        return 'left';
      }
      if ('join' in response || 'create' in response) {
        const wasJoined = nests.has(nest);
        record(nest, true);
        return wasJoined ? null : 'became-joined';
      }
      return null;
    },
    isKnownNotJoined(nest: string): boolean {
      return known && !nests.has(nest);
    },
  };
}

export type JoinedChannels = ReturnType<typeof createJoinedChannels>;
