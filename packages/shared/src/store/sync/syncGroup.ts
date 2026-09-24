import * as api from '@tloncorp/api';

import * as db from '../../db';
import { batchEffects } from '../../db/query';
import { getClientGeneration, getSession } from '../session';
import { SyncCtx, syncQueue } from '../syncQueue';
import { logger } from './logger';
import { updateLastActivityTime } from './updateLastActivityTime';

const groupSyncsInProgress = new Set<string>();

export async function syncGroup(
  id: string,
  ctx?: SyncCtx,
  config?: { force?: boolean }
) {
  if (groupSyncsInProgress.has(id)) {
    return;
  }
  groupSyncsInProgress.add(id);
  try {
    const generation = getClientGeneration();
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
      if (clientChanged()) return;
      await db.deleteAbsentGroupMembers(
        {
          groupId: id,
          keepIds: keepIds.filter((contactId) => !removed.has(contactId)),
          candidateIds,
        },
        ctx
      );
      if (clientChanged()) return;
      await db.updateGroup({ id, syncedAt: Date.now() }, ctx);
      updateLastActivityTime();
    });
  } catch (e) {
    logger.trackError('group sync failed', e);
    console.error(e);
    throw e;
  } finally {
    groupSyncsInProgress.delete(id);
  }
}
