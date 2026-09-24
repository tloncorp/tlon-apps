import * as api from '@tloncorp/api';

import * as db from '../../db';
import { batchEffects } from '../../db/query';
import { getSession } from '../session';
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
    await batchEffects('syncGroup', async (ctx) => {
      const candidateIds =
        group?.members?.map((member) => member.contactId) ?? [];
      // Seats a live removal event cleared while the fetch was in flight: the
      // older snapshot must not bring them back.
      const stored = new Set(await db.getGroupMemberIds({ groupId: id }, ctx));
      const removed = new Set(
        candidateIds.filter((contactId) => !stored.has(contactId))
      );
      await db.insertGroups({ groups: [response] }, ctx);
      // Unlike init and changes, this fetch carries the group's full roster,
      // so it can also clear out seats removed while we weren't listening.
      const members = response.members ?? [];
      const keepIds = members.some((member) => member.status === 'joined')
        ? members.map((member) => member.contactId)
        : candidateIds;
      await db.deleteAbsentGroupMembers(
        {
          groupId: id,
          keepIds: keepIds.filter((contactId) => !removed.has(contactId)),
          candidateIds,
        },
        ctx
      );
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
