import * as api from '@tloncorp/api';

import * as db from '../../db';
import { batchEffects } from '../../db/query';
import { getClientGeneration, getSession } from '../session';
import { SyncCtx, syncQueue } from '../syncQueue';
import { logger } from './logger';
import { fitToLiveChanges, isRosterPaged, snapshotRoster } from './rosterPages';
import { updateLastActivityTime } from './updateLastActivityTime';

// Keyed by client generation too: a previous account's sync of the same group
// is abandoned once the client changes, so it mustn't swallow the new one.
const groupSyncsInProgress = new Set<string>();

// When each big group last synced light, by the same key. A light sync never
// marks the roster complete, so syncedAt can't gate repeats of it.
const lightSyncedAt = new Map<string, number>();

export async function syncGroup(
  id: string,
  ctx?: SyncCtx,
  // wholeRoster: callers that judge membership from the stored roster (role
  // management, bot settings) still get every seat of a big group
  config?: { force?: boolean; wholeRoster?: boolean }
) {
  const generation = getClientGeneration();
  const syncKey = `${generation}:${id}`;
  // a whole sync in flight serves any caller, but a light one can't serve a
  // caller that needs every seat
  const wholeKey = `${syncKey}:whole`;
  if (
    groupSyncsInProgress.has(wholeKey) ||
    (!config?.wholeRoster && groupSyncsInProgress.has(syncKey))
  ) {
    return;
  }
  const inProgressKey = config?.wholeRoster ? wholeKey : syncKey;
  groupSyncsInProgress.add(inProgressKey);
  try {
    const group = await db.getGroup({ id });
    const session = getSession();
    if (group && isRosterPaged(group) && !config?.wholeRoster) {
      if (
        session &&
        (session.startTime ?? 0) < (lightSyncedAt.get(syncKey) ?? 0) &&
        !config?.force
      ) {
        return;
      }
      // the light group still brings metadata, channels, roles and our seat;
      // its members load a page at a time (syncGroupMembersPage), and with
      // no whole roster to compare against, nothing is pruned here. A whole
      // sync or a live event can land while it is in flight, and this older
      // response must not undo either.
      const snapshot = await snapshotRoster(id);
      const response = await syncQueue.add('syncGroup', ctx, () =>
        api.getGroupLight(id)
      );
      if (getClientGeneration() !== generation) return;
      await batchEffects('syncGroup', async (queryCtx) => {
        const members = await fitToLiveChanges(
          id,
          snapshot,
          response.members ?? [],
          queryCtx
        );
        const countNow = await db.getStoredMemberCount(
          { groupId: id },
          queryCtx
        );
        if (getClientGeneration() !== generation) return;
        await db.insertGroups(
          {
            groups: [
              {
                ...response,
                members: [],
                // left out, the stored count stands
                memberCount:
                  countNow === snapshot.count
                    ? response.memberCount
                    : undefined,
              },
            ],
          },
          queryCtx
        );
        // written like a roster page, which fails outright when its write
        // does, so a sync that didn't land isn't counted done below. Each
        // light seat carries all of its roles, as a page's do.
        if (getClientGeneration() !== generation) return;
        await db.insertGroupMembersPage({ groupId: id, members }, queryCtx);
      });
      if (getClientGeneration() !== generation) return;
      lightSyncedAt.set(syncKey, Date.now());
      updateLastActivityTime();
      return;
    }
    if (
      group &&
      session &&
      (session.startTime ?? 0) < (group.syncedAt ?? 0) &&
      !config?.force
    ) {
      return;
    }
    // If the account changed (logout, ship switch) since we started, this group
    // belongs to the previous client: check before every write, since the
    // database follows the current client.
    const clientChanged = () => getClientGeneration() !== generation;
    // The store runs inside the queued job, so a caller's retry also covers a
    // roster that didn't fully land, not only the fetch.
    await syncQueue.add('syncGroup', ctx, async () => {
      const response = await api.getGroup(id);
      if (clientChanged()) return;
      await batchEffects('syncGroup', async (ctx) => {
        // Only joined seats are reconciled: an invite row may be an optimistic
        // write whose request this roster predates.
        const candidateIds =
          group?.members
            ?.filter((member) => member.status !== 'invited')
            .map((member) => member.contactId) ?? [];
        // Seats a live removal event cleared while the fetch was in flight: the
        // older snapshot must not bring them back.
        const stored = new Set(
          await db.getGroupMemberIds({ groupId: id }, ctx)
        );
        const removed = new Set(
          candidateIds.filter((contactId) => !stored.has(contactId))
        );
        if (clientChanged()) return;
        await db.insertGroups({ groups: [response] }, ctx);
        // Unlike init and changes, this fetch carries the group's full roster,
        // so it can also clear out seats removed while we weren't listening.
        const members = response.members ?? [];
        const keepIds = members.some((member) => member.status === 'joined')
          ? members.map((member) => member.contactId)
          : candidateIds;
        const rosterIds = keepIds.filter(
          (contactId) => !removed.has(contactId)
        );
        if (clientChanged()) return;
        await db.deleteAbsentGroupMembers(
          { groupId: id, keepIds: rosterIds, candidateIds },
          ctx
        );
        if (clientChanged()) return;
        // syncedAt marks the stored roster as complete (see
        // buildBotGroupMembershipResolver), and insertMembers logs failed
        // batches rather than throwing, so only claim it once every seat landed.
        const storedIds = new Set(
          await db.getGroupMemberIds({ groupId: id }, ctx)
        );
        const missing = rosterIds.filter(
          (contactId) => !storedIds.has(contactId)
        ).length;
        if (missing > 0) {
          throw new Error(
            `group sync stored an incomplete roster: ${missing} missing`
          );
        }
        await db.updateGroup({ id, syncedAt: Date.now() }, ctx);
        updateLastActivityTime();
      });
    });
  } catch (e) {
    // Callers cancel queued syncs on unmount; that is expected, not a failure.
    if (!ctx?.abortSignal?.aborted) {
      logger.trackError('group sync failed', e);
      console.error(e);
    }
    throw e;
  } finally {
    groupSyncsInProgress.delete(inProgressKey);
  }
}
