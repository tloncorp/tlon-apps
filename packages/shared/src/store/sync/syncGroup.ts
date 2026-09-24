import * as api from '@tloncorp/api';

import * as db from '../../db';
import { batchEffects } from '../../db/query';
import { getClientGeneration, getSession } from '../session';
import { SyncCtx, syncQueue } from '../syncQueue';
import { logger } from './logger';
import { updateLastActivityTime } from './updateLastActivityTime';

// Keyed by client generation too: a previous account's sync of the same group
// is abandoned once the client changes, so it mustn't swallow the new one.
const groupSyncsInProgress = new Set<string>();

export async function syncGroup(
  id: string,
  ctx?: SyncCtx,
  config?: { force?: boolean }
) {
  const generation = getClientGeneration();
  const syncKey = `${generation}:${id}`;
  if (groupSyncsInProgress.has(syncKey)) {
    return;
  }
  groupSyncsInProgress.add(syncKey);
  try {
    const group = await db.getGroup({ id });
    const session = getSession();
    if (
      group &&
      session &&
      (session.startTime ?? 0) < (group.syncedAt ?? 0) &&
      !config?.force
    ) {
      return;
    }
    const response = await syncQueue.add('syncGroup', ctx, () =>
      api.getGroup(id)
    );
    // If the account changed (logout, ship switch) since we started, this group
    // belongs to the previous client: check before every write, since the
    // database follows the current client.
    const clientChanged = () => getClientGeneration() !== generation;
    if (clientChanged()) return;
    await batchEffects('syncGroup', async (ctx) => {
      const candidateIds =
        group?.members?.map((member) => member.contactId) ?? [];
      // Seats a live removal event cleared while the fetch was in flight: the
      // older snapshot must not bring them back.
      const stored = new Set(await db.getGroupMemberIds({ groupId: id }, ctx));
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
      const rosterIds = keepIds.filter((contactId) => !removed.has(contactId));
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
      if (!rosterIds.every((contactId) => storedIds.has(contactId))) {
        logger.trackError('group sync stored an incomplete roster', {
          missing: rosterIds.filter((contactId) => !storedIds.has(contactId))
            .length,
        });
        return;
      }
      await db.updateGroup({ id, syncedAt: Date.now() }, ctx);
      updateLastActivityTime();
    });
  } catch (e) {
    logger.trackError('group sync failed', e);
    console.error(e);
    throw e;
  } finally {
    groupSyncsInProgress.delete(syncKey);
  }
}
