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
      await db.insertGroups({ groups: [response] }, ctx);
      // Unlike init and changes, this fetch carries the group's full roster,
      // so it can clear out seats removed while we weren't listening.
      const members = response.members ?? [];
      if (members.some((member) => member.status === 'joined')) {
        await db.deleteAbsentGroupMembers(
          {
            groupId: id,
            keepIds: members.map((member) => member.contactId),
            candidateIds:
              group?.members?.map((member) => member.contactId) ?? [],
          },
          ctx
        );
      }
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
