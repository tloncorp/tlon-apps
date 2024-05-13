import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import * as sync from './sync';

const logger = createDevLogger('groupActions', true);

export async function createGroup({
  currentUserId,
  title,
  shortCode,
}: {
  currentUserId: string;
  title: string;
  shortCode: string;
}): Promise<{ group: db.Group; channel: db.Channel }> {
  logger.log(`${shortCode}: creating group`);
  try {
    await api.createGroup({
      title,
      shortCode,
    });

    logger.log(
      `${shortCode}: api.createGroup succeeded, creating default channel`
    );
    const groupId = `${currentUserId}/${shortCode}`;

    await api.createDefaultChannel({
      groupId,
      currentUserId,
    });

    logger.log(`${shortCode}: api.createDefaultChannel succeeded`);

    await sync.syncNewGroup(groupId);
    await sync.syncUnreads(); // ensure current user gets registered as a member of the channel
    const group = await db.getGroup({ id: groupId });

    logger.log(`got group?`, group);

    if (group && group.channels.length) {
      const channel = group.channels[0];
      return { group, channel };
    }

    // TODO: should we have a UserFacingError type?
    throw new Error('Something went wrong');
  } catch (e) {
    console.error(`${shortCode}: failed to create group`, e);
    throw new Error('Something went wrong');
  }
}
