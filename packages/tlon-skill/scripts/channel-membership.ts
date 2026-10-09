// Leave/join a single group channel without touching group membership.

import { canonicalizeNest } from './cli-utils';

export interface ChannelMembershipSnapshot {
  // The %channels joined set (`channelPerms` from init).
  joinedChannelIds: Set<string>;
  groups: Array<{ id: string; channelIds: string[] }>;
}

export interface ChannelMembershipDeps {
  // Leave only; join resolves the group via findGroupIdForChannel so it
  // doesn't load the init.
  getSnapshot: () => Promise<ChannelMembershipSnapshot>;
  findGroupIdForChannel: (nest: string) => Promise<string | null>;
  leaveChannel: (nest: string) => Promise<unknown>;
  joinChannel: (nest: string, groupId: string) => Promise<unknown>;
  log: (line: string) => void;
}

function findGroupId(
  snapshot: ChannelMembershipSnapshot,
  nest: string
): string | null {
  return (
    snapshot.groups.find((group) => group.channelIds.includes(nest))?.id ?? null
  );
}

export async function leaveChannelByNest(
  input: string,
  deps: ChannelMembershipDeps
): Promise<void> {
  const nest = canonicalizeNest(input);
  const snapshot = await deps.getSnapshot();
  const groupId = findGroupId(snapshot, nest);
  // %leave on an unjoined nest crashes %channels and nacks with a generic
  // poke error, so refuse it here with a clear message instead.
  if (!snapshot.joinedChannelIds.has(nest)) {
    throw new Error(
      groupId
        ? `Not a member of ${nest} (group ${groupId}) — nothing to leave.`
        : `Channel ${nest} not found.`
    );
  }
  await deps.leaveChannel(nest);
  deps.log(`✅ Left ${nest}.`);
  if (groupId) deps.log(`Still a member of group ${groupId}.`);
}

// Joins even when already joined: %channels re-asserts the subscriptions,
// which repairs a stale join. There is no read-access pre-check: the backend
// also admits admins and the group host, which the client can't mirror, so a
// channel the ship can't read reports Joined but receives nothing.
export async function joinChannelByNest(
  input: string,
  deps: ChannelMembershipDeps
): Promise<void> {
  const nest = canonicalizeNest(input);
  const groupId = await deps.findGroupIdForChannel(nest);
  if (!groupId) {
    throw new Error(`Channel ${nest} not found in any group you're in.`);
  }
  await deps.joinChannel(nest, groupId);
  deps.log(`✅ Joined ${nest}.`);
}
