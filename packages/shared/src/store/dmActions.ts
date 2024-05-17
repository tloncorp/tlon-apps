import * as api from '../api';
import * as db from '../db';
import * as sync from './sync';

export async function respondToDMInvite({
  channel,
  accept,
  currentUserId,
}: {
  channel: db.Channel;
  accept: boolean;
  currentUserId: string;
}) {
  // optimistic update
  await db.updateChannel({ id: channel.id, isDmInvite: false });

  try {
    await api.respondToDMInvite({ channel, accept, currentUserId });
    await sync.syncChannel(channel.id, Date.now());
  } catch (e) {
    console.error('Failed to respond to dm invite', e);
    // rollback optimistic update
    await db.updateChannel({ id: channel.id, isDmInvite: true });
  }
}

export async function blockUser(userId: string) {
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
