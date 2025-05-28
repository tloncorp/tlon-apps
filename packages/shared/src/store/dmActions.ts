import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';
import * as logic from '../logic';
import * as sync from './sync';

const logger = createDevLogger('dmActions', true);

export async function respondToDMInvite({
  channel,
  accept,
}: {
  channel: db.Channel;
  accept: boolean;
}) {
  logger.log(`responding to dm invite`, `accept? ${accept}`, channel.id);
  logger.trackEvent(
    AnalyticsEvent.ActionRespondToDMInvite,
    logic.getModelAnalytics({ channel })
  );
  // optimistic update
  if (accept) {
    await db.updateChannel({
      id: channel.id,
      isDmInvite: false,
      currentUserIsMember: true,
    });
  } else {
    logger.log(`deleting channel`, channel.id);
    await db.deleteChannels([channel.id]);
  }

  try {
    await api.respondToDMInvite({ channel, accept });
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
  logger.trackEvent(AnalyticsEvent.ActionBlockUser);
  // optimistic update
  const existingContact = await db.getContact({ id: userId });
  if (existingContact) {
    await db.updateContact({ id: userId, isBlocked: true });
  }

  try {
    await api.blockUser(userId);
    await sync.syncBlockedUsers();
  } catch (e) {
    console.error('Failed to block user', e);
    // rollback optimistic update
    if (existingContact) {
      await db.updateContact({ id: userId, isBlocked: false });
    }
  }
}

export async function unblockUser(userId: string) {
  logger.log(`unblocking user`, userId);
  logger.trackEvent(AnalyticsEvent.ActionUnblockUser);
  // optimistic update
  const existingContact = await db.getContact({ id: userId });
  if (existingContact) {
    await db.updateContact({ id: userId, isBlocked: false });
  }

  try {
    await api.unblockUser(userId);
    await sync.syncBlockedUsers();
  } catch (e) {
    console.error('Failed to unblock user', e);
    // rollback optimistic update
    if (existingContact) {
      await db.updateContact({
        id: userId,
        isBlocked: existingContact.isBlocked,
      });
    }
  }
}

export async function updateDMMeta(channelId: string, meta: db.ClientMeta) {
  logger.log('updating channel', channelId, meta);
  logger.trackEvent(
    AnalyticsEvent.ActionCustomizeDM,
    logic.getModelAnalytics({ channel: { id: channelId } })
  );

  const existingChannel = await db.getChannel({ id: channelId });

  // optimistic update
  await db.updateChannel({ id: channelId, ...meta });

  try {
    await api.updateDMMeta({
      channelId,
      meta,
    });
  } catch (e) {
    console.error('Failed to update channel', e);
    // rollback optimistic update
    await db.updateChannel({
      id: channelId,
      ...existingChannel,
    });
  }
}
