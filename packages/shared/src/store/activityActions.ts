import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';

const logger = createDevLogger('activityActions', false);

export async function muteChat(channel: db.Channel) {
  const initialSettings = await getChatVolumeSettings(channel);

  db.setVolumes([
    {
      itemId: channel.groupId ?? channel.id,
      itemType: channel.groupId ? 'group' : 'channel',
      isMuted: true,
      isNoisy: false,
    },
  ]);

  try {
    const { source } = api.getRootSourceFromChannel(channel);
    const volume = ub.getVolumeMap('soft', true);
    await api.adjustVolumeSetting(source, volume);
  } catch (e) {
    logger.log(`failed to mute group ${channel.id}`, e);
    // revert the optimistic update
    if (initialSettings) {
      await db.setVolumes([initialSettings]);
    }
  }
}

export async function unmuteChat(channel: db.Channel) {
  const initialSettings = await getChatVolumeSettings(channel);

  db.setVolumes([
    {
      itemId: channel.groupId ?? channel.id,
      itemType: channel.groupId ? 'group' : 'channel',
      isMuted: false,
      isNoisy: false,
    },
  ]);

  try {
    const { source } = api.getRootSourceFromChannel(channel);
    await api.adjustVolumeSetting(source, null);
  } catch (e) {
    logger.log(`failed to unmute chat ${channel.id}`, e);
    // revert the optimistic update
    if (initialSettings) {
      await db.setVolumes([initialSettings]);
    }
  }
}

async function getChatVolumeSettings(chat: db.Channel) {
  if (chat.groupId) {
    return (
      chat.group?.volumeSettings ?? (await db.getVolumeSetting(chat.groupId))
    );
  } else {
    return chat.volumeSettings ?? (await db.getVolumeSetting(chat.id));
  }
}

export async function muteThread({
  channel,
  thread,
}: {
  channel: db.Channel;
  thread: db.Post;
}) {
  const initialSettings = await db.getVolumeSetting(thread.id);

  db.setVolumes([
    { itemId: thread.id, itemType: 'thread', isMuted: true, isNoisy: false },
  ]);

  try {
    const { source } = api.getThreadSource({ channel, post: thread });
    const volume = ub.getVolumeMap('soft', true);
    await api.adjustVolumeSetting(source, volume);
  } catch (e) {
    logger.log(`failed to mute thread ${channel.id}/${thread.id}`, e);
    if (initialSettings) {
      db.setVolumes([initialSettings]);
    } else {
      db.clearVolumeSetting(thread.id);
    }
  }
}

export async function unmuteThread({
  channel,
  thread,
}: {
  channel: db.Channel;
  thread: db.Post;
}) {
  const initialSettings = await db.getVolumeSetting(thread.id);

  db.setVolumes([
    { itemId: thread.id, itemType: 'thread', isMuted: false, isNoisy: false },
  ]);

  try {
    const { source } = api.getThreadSource({ channel, post: thread });
    await api.adjustVolumeSetting(source, null);
  } catch (e) {
    logger.log(`failed to unmute thread ${channel.id}/${thread.id}`, e);
    if (initialSettings) {
      db.setVolumes([initialSettings]);
    } else {
      db.clearVolumeSetting(thread.id);
    }
  }
}

export async function setDefaultNotificationLevel(
  level: ub.PushNotificationsSetting
) {
  const currentSetting = await db.getPushNotificationsSetting();

  // optimistic update
  await db.setPushNotificationsSetting(level);

  try {
    await api.setPushNotificationsSetting(level);
  } catch (e) {
    logger.log(`failed to set default notification level`, e);
    await db.setPushNotificationsSetting(currentSetting);
  }
}

export async function advanceActivitySeenMarker(timestamp: number) {
  const existingMarker = await db.getActivitySeenMarker();
  if (timestamp > existingMarker) {
    db.storeActivitySeenMarker(timestamp);
  }
}
