/**
 * Role mention scope: which group roles a model-authored message may
 * mention as `@role-id`.
 *
 * A channel message converts `@all` and the role ids of the channel's
 * group; a DM converts `@all` only. Nothing is ever refused: an `@word`
 * that is not a role, or whose group cannot be read, goes out as text.
 * Roles are looked up only when the text names an `@token` other than
 * `@all`.
 *
 * The monitor creates one resolver per account and publishes it through a
 * shared map, because the outbound adapter and the message tool load in
 * other module contexts. A group's role ids are cached for a minute; a
 * failed read is cached for ten seconds, so a group that cannot be read is
 * not refetched for every message.
 */
import { sharedMap } from './shared-state.js';
import {
  ALL_ONLY,
  type RoleMentionScope,
  roleMentionCandidates,
} from './urbit/story.js';

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_FAILURE_TTL_MS = 10_000;

export type RoleMentionResolver = {
  /** The role ids of the nest's group, or null when they can't be read. */
  roleIdsForNest(nest: string): Promise<ReadonlySet<string> | null>;
};

export function createRoleMentionResolver(deps: {
  /** The monitor's live channel nest → group flag index. */
  channelToGroup: ReadonlyMap<string, string>;
  /** Re-read the channel → group index; rate-limited by the monitor. */
  refreshChannelGroups: () => Promise<void>;
  fetchRoleIds: (flag: string) => Promise<string[]>;
  ttlMs?: number;
  failureTtlMs?: number;
  now?: () => number;
  log?: (msg: string) => void;
}): RoleMentionResolver {
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;
  const failureTtlMs = deps.failureTtlMs ?? DEFAULT_FAILURE_TTL_MS;
  const now = deps.now ?? Date.now;
  const cache = new Map<
    string,
    { at: number; ids: ReadonlySet<string> | null }
  >();
  const inFlight = new Map<string, Promise<ReadonlySet<string> | null>>();

  // Targets may arrive in any case; the index holds canonical nests, whose
  // channel names keep their case.
  const groupForNest = (nest: string): string | null => {
    const exact = deps.channelToGroup.get(nest);
    if (exact) return exact;
    const lower = nest.toLowerCase();
    for (const [candidate, flag] of deps.channelToGroup) {
      if (candidate.toLowerCase() === lower) return flag;
    }
    return null;
  };

  const readRoleIds = (flag: string): Promise<ReadonlySet<string> | null> => {
    const cached = cache.get(flag);
    if (cached && now() - cached.at < (cached.ids ? ttlMs : failureTtlMs)) {
      return Promise.resolve(cached.ids);
    }
    const pending = inFlight.get(flag);
    if (pending) return pending;
    const task = deps
      .fetchRoleIds(flag)
      .then(
        (ids): ReadonlySet<string> => new Set(ids),
        (error) => {
          deps.log?.(
            `[tlon] Failed to read roles of ${flag} for role mentions: ${String(error)}`
          );
          return null;
        }
      )
      .then((ids) => {
        cache.set(flag, { at: now(), ids });
        return ids;
      })
      .finally(() => inFlight.delete(flag));
    inFlight.set(flag, task);
    return task;
  };

  return {
    async roleIdsForNest(nest) {
      let flag = groupForNest(nest);
      if (!flag) {
        try {
          await deps.refreshChannelGroups();
        } catch {
          return null;
        }
        flag = groupForNest(nest);
      }
      return flag ? readRoleIds(flag) : null;
    },
  };
}

// ── Cross-context publication ───────────────────────────────────────────

const resolvers = sharedMap<string, RoleMentionResolver>(
  'roleMentions.resolvers'
);

export function publishRoleMentionResolver(
  accountId: string,
  resolver: RoleMentionResolver
): void {
  resolvers.set(accountId, resolver);
}

/** Reference-checked so a replacement monitor's resolver is never dropped. */
export function unpublishRoleMentionResolver(
  accountId: string,
  resolver: RoleMentionResolver
): void {
  if (resolvers.get(accountId) === resolver) {
    resolvers.delete(accountId);
  }
}

export function getRoleMentionResolver(
  accountId: string
): RoleMentionResolver | null {
  return resolvers.get(accountId) ?? null;
}

export type RoleMentionTarget =
  | { kind: 'dm' }
  | { kind: 'channel'; nest: string };

/**
 * The scope to send `text` to `target` with. Falls back to `@all` only
 * when no lookup is needed, no monitor has published a resolver for the
 * account, or the roles can't be read.
 */
export async function roleMentionScopeFor(
  accountId: string,
  target: RoleMentionTarget,
  text: string
): Promise<RoleMentionScope> {
  if (target.kind === 'dm' || roleMentionCandidates(text).size === 0) {
    return ALL_ONLY;
  }
  const roleIds = await getRoleMentionResolver(accountId)
    ?.roleIdsForNest(target.nest)
    .catch(() => null);
  return roleIds ? { roleIds } : ALL_ONLY;
}

export const _testing = {
  clearResolvers: () => resolvers.clear(),
};
