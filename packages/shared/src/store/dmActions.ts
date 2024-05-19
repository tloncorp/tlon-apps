import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import * as sync from './sync';

const logger = createDevLogger('dmActions', true);

export async function respondToDMInvite({
  channel,
  accept,
  currentUserId,
}: {
  channel: db.Channel;
  accept: boolean;
  currentUserId: string;
}) {
  logger.log(`responding to dm invite`, `accept? ${accept}`, channel.id);
  // optimistic update
  if (accept) {
    await db.updateChannel({
      id: channel.id,
      isDmInvite: false,
      currentUserIsMember: true,
    });
  } else {
    logger.log(`deleting channel`, channel.id);
    await db.deleteChannel(channel.id);
  }

  try {
    await api.respondToDMInvite({ channel, accept, currentUserId });
    if (accept) {
      logger.log(`syncing channel`, channel.id);
      await sync.syncChannel(channel.id, Date.now());
    }
  } catch (e) {
    logger.error('Failed to respond to dm invite', e);
    // rollback optimistic update
    if (accept) {
      await db.updateChannel({
        id: channel.id,
        isDmInvite: true,
        currentUserIsMember: false,
      });
    } else {
      await db.insertChannels([channel]);
    }
  }
}

export async function blockUser(userId: string) {
  logger.log(`blocking user`, userId);
  // optimistic update
  await db.updateContact({ id: userId, isBlocked: true });

  try {
    await api.blockUser(userId);
  } catch (e) {
    console.error('Failed to block user', e);
    // rollback optimistic update
    await db.updateContact({ id: userId, isBlocked: false });
  }
}
