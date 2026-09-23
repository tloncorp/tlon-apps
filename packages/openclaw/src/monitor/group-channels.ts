/**
 * `%groups` fact parsing and the `groupChannels` journal, extracted from the
 * monitor closure so they are unit-testable.
 *
 * Ownership of `%settings` `moltbot`/`tlon`/`groupChannels`: the key is the
 * union of the channels the bot should know at boot. Its writers are solaris
 * (the whole list = the `channelRules` keys, on every hosted save, followed by
 * a gateway restart), the `tlon settings add-channel`/`remove-channel` CLI
 * (the whole list, from a fresh scry), and this plugin (an append-only journal
 * of the channels of groups the bot has joined).
 *
 * Conflict rule: last write wins — `%settings` has no compare-and-swap. A
 * hosted save therefore drops journaled nests that have no channel rule; the
 * Tlon app promotes a journaled nest into an explicit rule only when its open
 * draft already listed it, and horizon never does. This plugin never removes
 * from the key, and it re-journals a group's channels whenever the host
 * re-sends its state (join, admin promotion, resync), so a nest an operator
 * removed can reappear after such an event.
 *
 * The file list (`openclaw.json` `groupChannels`, env-seeded on hosted bots)
 * is a third source, unioned at boot and immune to settings removal; channel
 * discovery, while `autoDiscoverChannels` is on, is a fourth and likewise
 * immune.
 *
 * On openclaw the known-set does not gate message handling (the `/v4` firehose
 * auto-watches any member channel on its first event); it seeds the boot
 * onboarding scan, approval display names, and telemetry counts. The same key
 * does gate handling on hermes, which is why the persisted contract is kept
 * identical across the two runtimes.
 */
import { createCatchUpRunner } from './group-invites.js';

/** Nests the plugin journals; other channel kinds are not monitored. */
const JOURNALED_NEST_PREFIXES = ['chat/', 'heap/', 'diary/'];

export type GroupsUiChannelFact = {
  flag: string;
  kind: 'create' | 'channel-add';
  groupTitle?: string;
  /** chat/heap/diary only */
  channels: Array<{ nest: string; title?: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isJournaledNest(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    JOURNALED_NEST_PREFIXES.some((prefix) => value.startsWith(prefix))
  );
}

function extractMetaTitle(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const meta = value.meta;
  const title = isRecord(meta) ? meta.title : undefined;
  return typeof title === 'string' && title.trim() ? title.trim() : undefined;
}

/**
 * Narrow a `/groups/ui` fact to the channel-bearing shapes.
 *
 * The `group-action-3` mark emits `{flag, update: {time, diff: {<tag>: …}}}`
 * (`desk/lib/groups-json.hoon:1215-1245`). A join surfaces as
 * `update.diff.create.channels` (the host's initial group), a later channel as
 * `update.diff.channel.{nest, diff.add}`. Every other tag — `fleet`, `cabal`,
 * `bloc`, `cordon`, `zone`, `meta`, `secret`, `del`, `flag-content`, and the
 * non-additive channel diffs — carries no channel to journal.
 */
export function parseGroupsUiChannelFact(
  event: unknown
): GroupsUiChannelFact | null {
  if (!isRecord(event)) {
    return null;
  }
  const { flag, update } = event;
  if (typeof flag !== 'string' || !isRecord(update)) {
    return null;
  }
  const diff = update.diff;
  if (!isRecord(diff)) {
    return null;
  }

  const create = diff.create;
  if (isRecord(create)) {
    const channels: GroupsUiChannelFact['channels'] = [];
    const created = create.channels;
    if (isRecord(created)) {
      for (const [nest, channel] of Object.entries(created)) {
        if (!isJournaledNest(nest)) {
          continue;
        }
        const title = extractMetaTitle(channel);
        channels.push(title ? { nest, title } : { nest });
      }
    }
    // A create with no qualifying channels is still a fact: the caller caches
    // the group title from it.
    const groupTitle = extractMetaTitle(create);
    return {
      flag,
      kind: 'create',
      ...(groupTitle ? { groupTitle } : {}),
      channels,
    };
  }

  const channel = diff.channel;
  if (isRecord(channel)) {
    const channelDiff = channel.diff;
    if (!isRecord(channelDiff)) {
      return null;
    }
    // edit/del/join/add-sects/del-sects/zone change a channel this fact does
    // not introduce; only `add` carries one.
    const add = channelDiff.add;
    if (!isRecord(add)) {
      return null;
    }
    const nest = channel.nest;
    if (!isJournaledNest(nest)) {
      return null;
    }
    const title = extractMetaTitle(add);
    return {
      flag,
      kind: 'channel-add',
      channels: [title ? { nest, title } : { nest }],
    };
  }

  return null;
}

export type GroupChannelJournalDeps = {
  /** Startup value of the key (after the config→settings migration apply). */
  initial: readonly string[] | undefined;
  /** Whether the startup load returned fresh. */
  trusted: boolean;
  /** Config sources: the file list ∪ discovered nests (while discovery on). */
  protectedNests: () => ReadonlySet<string>;
  /** settings put-entry groupChannels (api.poke resolves Promise<number>). */
  putEntry: (value: string[]) => Promise<unknown>;
  log?: (msg: string) => void;
  error?: (msg: string) => void;
};

export type GroupChannelJournal = {
  /** Count of key observations; a refresh compares it across its scry to detect a superseded result. */
  readonly observationSeq: number;
  /** Count of known gaps (markUntrusted calls); a refresh compares it across its scry so a pre-gap result cannot re-trust the journal. */
  readonly gapSeq: number;
  /** The key's value as last observed (echo or non-superseded fresh load). */
  readonly lastObserved: readonly string[] | undefined;
  /** Whether the write base may be used: a fresh load has run since the last known gap. */
  readonly trusted: boolean;
  /** A fresh settings load completed (even if unchanged). */
  markTrusted(): void;
  /**
   * The settings subscription errored or ended: echoes may have been missed,
   * so the write base is stale until the next fresh load.
   */
  markUntrusted(): void;
  /**
   * Nests whose put has settled but which no observation has echoed yet.
   * Excludes puts still in flight: a scry started while a put is in flight
   * can overtake it, and judging those would let a later transport rejection
   * find nothing to requeue.
   */
  unconfirmedSnapshot(): Set<string>;
  /**
   * A fresh, non-superseded scry is authoritative for the nests that were
   * already unconfirmed when it began: any of `candidates` absent from `list`
   * is not on the ship (the put was lost, or another writer removed it) and
   * leaves the write base rather than resurrecting a removal. Runs even when
   * the list is unchanged, so it is separate from `observe`.
   */
  pruneUnconfirmed(
    list: readonly string[] | undefined,
    candidates: ReadonlySet<string>
  ): string[];
  /** Reconcile with an observed value of the key. Returns nests to start/stop watching. */
  observe(list: readonly string[] | undefined): {
    added: string[];
    removed: string[];
  };
  /** Accept nests and schedule a drain pass. No-op after close(). */
  persist(nests: readonly string[]): Promise<void>;
  /** Coalesced opportunistic drain (after a fresh refresh). */
  flush(): Promise<void>;
  /** Stop accepting; drain what was accepted. Awaited in teardown before api.close(). */
  close(): Promise<void>;
};

function sameList(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined
): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  return a.every((nest, index) => nest === b[index]);
}

/**
 * Append-only journal of the channels of joined groups.
 *
 * The write base is the union of what the ship was last observed to hold
 * (`observed`) and what this process has put but not yet seen echoed
 * (`unconfirmed`). Observations never drop unconfirmed additions, and a
 * transport failure rolls back only the additions no observation has
 * confirmed — a rejection is delivery-ambiguous, and if the ship did apply the
 * put, its echo confirms the nests and the retry becomes a no-op.
 *
 * Drains are serialized by `createCatchUpRunner` and never abort: accepted
 * work runs to completion, and acceptance is gated by `closed`. A drain that
 * finds the snapshot untrusted defers and keeps `pending`; trust arrives from
 * the next fresh refresh, which also flushes.
 */
export function createGroupChannelJournal(
  deps: GroupChannelJournalDeps
): GroupChannelJournal {
  let observed = new Set<string>(deps.initial ?? []);
  // Put sent, HTTP not yet settled. Kept apart from `unconfirmed` so a scry
  // that overtakes an in-flight put cannot prune what the put's own rejection
  // handler still has to requeue.
  const inFlight = new Set<string>();
  // Put settled, not yet seen in an observation (echo or fresh load).
  const unconfirmed = new Set<string>();
  const pending = new Set<string>();
  let lastSeen: readonly string[] | undefined = deps.initial;
  let trusted = deps.trusted;
  let closed = false;
  let observationSeq = 0;
  let gapSeq = 0;

  const pruneUnconfirmed = (
    list: readonly string[] | undefined,
    candidates: ReadonlySet<string>
  ): string[] => {
    const present = new Set(list ?? []);
    const dropped: string[] = [];
    for (const nest of candidates) {
      if (unconfirmed.has(nest) && !present.has(nest)) {
        unconfirmed.delete(nest);
        dropped.push(nest);
      }
    }
    return dropped;
  };

  const observe = (
    list: readonly string[] | undefined
  ): { added: string[]; removed: string[] } => {
    // Same reference: an unrelated fact re-presenting the value already
    // observed; not a key fact, nothing to reconcile or count.
    if (list === lastSeen) {
      return { added: [], removed: [] };
    }
    // A key fact always arrives as a new array (the manager parses it
    // afresh), so it is an observation even when the value is unchanged: it
    // must supersede a scry in flight (an operator restoring the last-seen
    // value while a stale scry is out), and it makes the snapshot
    // trustworthy. Only the watch reconciliation is skipped.
    const changed = !sameList(list, lastSeen);
    lastSeen = list;
    observationSeq += 1;
    trusted = true;
    if (!changed) {
      return { added: [], removed: [] };
    }
    // undefined = a del-entry or a non-list value; hermes writes empty.
    const next = new Set(list ?? []);
    // An echo can land before the HTTP response: confirm in-flight nests too.
    for (const set of [unconfirmed, inFlight]) {
      for (const nest of set) {
        if (next.has(nest)) {
          set.delete(nest);
        }
      }
    }
    const protectedNests = deps.protectedNests();
    const added: string[] = [];
    for (const nest of next) {
      if (!observed.has(nest)) {
        added.push(nest);
      }
    }
    const removed: string[] = [];
    for (const nest of observed) {
      // Unconfirmed and in-flight nests are never in `observed`, so echo lag
      // cannot unwatch an addition this process is still waiting on.
      if (!next.has(nest) && !protectedNests.has(nest)) {
        removed.push(nest);
      }
    }
    observed = next;
    return { added, removed };
  };

  const drain = async (): Promise<void> => {
    if (pending.size === 0) {
      return;
    }
    if (!trusted) {
      deps.log?.(
        `[tlon] groupChannels: deferring ${pending.size} nest(s): settings snapshot untrusted`
      );
      return;
    }
    // Only what the ship has been observed to hold is "already written". An
    // unconfirmed nest stays in the write base but does not satisfy an explicit
    // re-request: if its echo never arrived and another writer dropped it, the
    // re-request must produce a put (redundant puts before the echo are
    // idempotent).
    const missing: string[] = [];
    for (const nest of pending) {
      if (!observed.has(nest)) {
        missing.push(nest);
      }
    }
    // An idempotent re-fired `create` finds everything already written.
    if (missing.length === 0) {
      pending.clear();
      return;
    }
    missing.sort();
    const value = [
      ...new Set([...observed, ...unconfirmed, ...inFlight, ...missing]),
    ].sort();
    // Consume the whole batch before the put: record the additions as in
    // flight so a drain that runs meanwhile counts them as part of the write
    // base, and clear `pending` now — both so a request for the same nest
    // accepted during the put survives the put's completion, and so an
    // already-observed request does not linger and resurrect the nest after
    // an operator removes it.
    for (const nest of missing) {
      inFlight.add(nest);
    }
    pending.clear();
    try {
      await deps.putEntry(value);
    } catch (err) {
      // Roll back and requeue only what is still in flight. A nest no longer
      // there was confirmed by an observation while the put was in flight (a
      // rejection can follow an accepted PUT), and the ship's later state for
      // it — kept, or since removed by another writer — is authoritative;
      // requeueing it would write back an operator's removal.
      for (const nest of missing) {
        if (inFlight.delete(nest)) {
          pending.add(nest);
        }
      }
      deps.error?.(`[tlon] Failed to persist groupChannels: ${String(err)}`);
      return;
    }
    // Settled but not yet echoed; an echo that arrived during the put has
    // already confirmed the nest and taken it out of `inFlight`.
    for (const nest of missing) {
      if (inFlight.delete(nest)) {
        unconfirmed.add(nest);
      }
    }
    deps.log?.(
      `[tlon] Persisted ${missing.length} channel(s) to groupChannels: ${missing.join(', ')}`
    );
  };

  const runner = createCatchUpRunner(drain, {
    error: deps.error,
    label: 'groupChannels journal',
  });

  return {
    get observationSeq() {
      return observationSeq;
    },
    get lastObserved() {
      return lastSeen;
    },
    get trusted() {
      return trusted;
    },
    markTrusted() {
      trusted = true;
    },
    get gapSeq() {
      return gapSeq;
    },
    markUntrusted() {
      trusted = false;
      gapSeq += 1;
    },
    unconfirmedSnapshot() {
      return new Set(unconfirmed);
    },
    pruneUnconfirmed,
    observe,
    persist(nests) {
      if (closed) {
        return Promise.resolve();
      }
      for (const nest of nests) {
        pending.add(nest);
      }
      return runner.enqueue(drain);
    },
    flush() {
      // The runner was built with `drain`, so catchUp() coalesces into the
      // queued-or-running pass — correct here because an opportunistic flush
      // carries no new work of its own.
      return runner.catchUp();
    },
    close() {
      closed = true;
      return runner.enqueue(drain);
    },
  };
}

export type GroupsUiChannelHandlerDeps = {
  watched: Set<string>;
  channelToGroup: Map<string, string>;
  channelNameCache: Map<string, string>;
  groupNameCache: Map<string, string>;
  persist: (nests: readonly string[]) => Promise<void>;
  /** scanDiscoveredAgentOnboardingNest */
  scan: (nest: string) => Promise<void>;
  log?: (msg: string) => void;
};

/**
 * Apply one parsed `/groups/ui` fact: cache the names, watch what is new, and
 * journal the fact's channels.
 *
 * Every channel of the fact is persisted, not only the newly watched ones: a
 * nest the firehose already auto-watched has never been journaled. The persist
 * runs before the network-bound onboarding scans so durability does not wait
 * on them.
 */
export async function handleGroupsUiChannelFact(
  fact: GroupsUiChannelFact,
  deps: GroupsUiChannelHandlerDeps
): Promise<void> {
  if (fact.groupTitle) {
    deps.groupNameCache.set(fact.flag, fact.groupTitle);
  }

  const newlyWatched: string[] = [];
  for (const channel of fact.channels) {
    deps.channelToGroup.set(channel.nest, fact.flag);
    if (channel.title) {
      deps.channelNameCache.set(channel.nest, channel.title);
    }
    if (!deps.watched.has(channel.nest)) {
      deps.watched.add(channel.nest);
      deps.log?.(
        `[tlon] Auto-detected channel (${fact.kind}): ${channel.nest}`
      );
      newlyWatched.push(channel.nest);
    }
  }

  await deps.persist(fact.channels.map((channel) => channel.nest));

  for (const nest of newlyWatched) {
    await deps.scan(nest);
  }
}
