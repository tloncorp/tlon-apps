import * as api from '../api';
import * as db from '../db';

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
  } catch (e) {
    console.error('Failed to respond to dm invite', e);
    // rollback optimistic update
    await db.updateChannel({ id: channel.id, isDmInvite: true });
  }
}
