import * as api from '../api';
import * as db from '../db';
import { BASE_UNREADS_SINGLETON_KEY } from '../db/schema';
import { createDevLogger } from '../debug';
import { isGroupChannelId } from '../logic';
import * as ub from '../urbit';
import { whomIsMultiDm } from '../urbit';

const logger = createDevLogger('activityActions', false);

export async function muteChat(chat: db.Chat) {
  const initialSettings = await getChatVolumeSettings(chat);
  const muteLevel = chat.type === 'group' ? 'soft' : 'hush';

  db.setVolumes({
    volumes: [
      {
        itemId: chat.id,
        itemType: chat.type,
        level: muteLevel,
      },
    ],
  });

  try {
    const { source } = api.getRootSourceFromChat(chat);
    const volume = ub.getVolumeMap(muteLevel, true);
    await api.adjustVolumeSetting(source, volume);
  } catch (e) {
    logger.trackError('ActivityAction: Failed to mute chat', {
      chatId: chat.id,
      chatType: chat.type,
      muteLevel,
      errorMessage: e.message,
    });
    // revert the optimistic update
    if (initialSettings) {
      await db.setVolumes({ volumes: [initialSettings] });
    }
  }
}

export async function unmuteChat(chat: db.Chat) {
  const initialSettings = await getChatVolumeSettings(chat);

  db.setVolumes({
    volumes: [
      {
        itemId: chat.id,
        itemType: chat.type,
        level: 'default',
      },
    ],
  });

  try {
    const { source } = api.getRootSourceFromChat(chat);
    await api.adjustVolumeSetting(source, null);
  } catch (e) {
    logger.trackError('ActivityAction: Failed to unmute chat', {
      chatId: chat.id,
      chatType: chat.type,
      errorMessage: e.message,
    });
    // revert the optimistic update
    if (initialSettings) {
      await db.setVolumes({ volumes: [initialSettings] });
    }
  }
}

async function getChatVolumeSettings(chat: db.Chat) {
  return chat.volumeSettings ?? (await db.getVolumeSetting(chat.id));
}

export async function muteThread({
  channel,
  thread,
}: {
  channel: db.Channel;
  thread: db.Post;
}) {
  const initialSettings = await db.getVolumeSetting(thread.id);
  // if we don't have a parent post then we are the parent post
  // note: we don't currently allow users to mute the root/parent post in the UI
  const parentPost = await db.getPost({ postId: thread.parentId ?? thread.id });

  db.setVolumes({
    volumes: [{ itemId: thread.id, itemType: 'thread', level: 'soft' }],
  });

  try {
    const { source } = api.getThreadSource({
      channel,
      post: parentPost ?? thread,
    });
    const volume = ub.getVolumeMap('soft', true);
    await api.adjustVolumeSetting(source, volume);
  } catch (e) {
    logger.trackError('ActivityAction: Failed to mute thread', {
      channelId: channel.id,
      threadId: thread.id,
      errorMessage: e.message,
    });
    if (initialSettings) {
      db.setVolumes({ volumes: [initialSettings] });
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

  db.setVolumes({
    volumes: [{ itemId: thread.id, itemType: 'thread', level: 'default' }],
  });

  try {
    const { source } = api.getThreadSource({ channel, post: thread });
    await api.adjustVolumeSetting(source, null);
  } catch (e) {
    logger.trackError('ActivityAction: Failed to unmute thread', {
      channelId: channel.id,
      threadId: thread.id,
      errorMessage: e.message,
    });
    if (initialSettings) {
      db.setVolumes({ volumes: [initialSettings] });
    } else {
      db.clearVolumeSetting(thread.id);
    }
  }
}

export async function setDefaultNotificationLevel(
  level: ub.PushNotificationsSetting
) {
  const currentSetting = await db.pushNotificationSettings.getValue();

  // optimistic update
  await db.pushNotificationSettings.setValue(level);

  try {
    await api.setPushNotificationsSetting(level);
  } catch (e) {
    logger.trackError(
      'ActivityAction: Failed to set default notification level',
      {
        level,
        errorMessage: e.message,
      }
    );
    await db.pushNotificationSettings.setValue(currentSetting);
  }
}

export async function advanceActivitySeenMarker(timestamp: number) {
  const settings = await db.getSettings();
  const existingMarker = settings?.activitySeenTimestamp ?? 1;
  const base = await db.getBaseUnread();
  if (base) {
    await db.insertBaseUnread({
      ...base,
      id: BASE_UNREADS_SINGLETON_KEY,
      notify: false,
      notifyCount: 0,
    });
  }
  if (timestamp > existingMarker) {
    // optimistic update
    db.insertSettings({
      activitySeenTimestamp: timestamp,
    });

    await api.setSetting('activitySeenTimestamp', timestamp);
  }
}

export async function setBaseVolumeLevel(params: {
  level: ub.NotificationLevel;
}) {
  logger.log(`setting base volume level`, params.level);
  const existingSetting = await db.getVolumeSetting('base');

  // optimistic update
  await db.setVolumes({
    volumes: [{ itemId: 'base', itemType: 'base', level: params.level }],
  });

  try {
    await api.adjustVolumeSetting(
      { base: null },
      ub.getVolumeMap(params.level, true)
    );
  } catch (e) {
    logger.trackError('ActivityAction: Failed to set base volume level', {
      level: params.level,
      errorMessage: e.message,
    });
    if (existingSetting) {
      await db.setVolumes({ volumes: [existingSetting] });
    }
  }
}

export async function setGroupVolumeLevel(params: {
  group: db.Group;
  level: ub.NotificationLevel | null;
}) {
  logger.log(`setting group volume level`, params.group, params.level);
  const existingGroup = await db.getGroup({ id: params.group.id });
  const source: ub.Source = { group: params.group.id };

  // optimistic update
  if (!params.level) {
    await db.removeVolumeLevels({ itemIds: [params.group.id] });
  } else {
    await db.setVolumes({
      volumes: [
        { itemId: params.group.id, itemType: 'group', level: params.level },
      ],
    });
  }

  try {
    await api.adjustVolumeSetting(
      source,
      params.level ? ub.getVolumeMap(params.level, true) : null
    );
  } catch (e) {
    // rollback
    logger.trackError('ActivityAction: Failed to set group volume level', {
      groupId: params.group.id,
      level: params.level ?? 'removed',
      errorMessage: e.message,
    });
    if (existingGroup?.volumeSettings) {
      await db.setVolumes({ volumes: [existingGroup.volumeSettings] });
    }
  }
}

export async function setChannelVolumeLevel(params: {
  channel: db.Channel;
  level: ub.NotificationLevel | null;
}) {
  logger.log(`setting channel volume level`, params.channel, params.level);
  const existingVolumeSetting = await db.getChannelVolumeSetting({
    channelId: params.channel.id,
  });
  const isGroupChannel = isGroupChannelId(params.channel.id);
  const isMultiDm = whomIsMultiDm(params.channel.id);
  const source: ub.Source = isGroupChannel
    ? {
        channel: {
          nest: params.channel.id,
          group: params.channel.groupId ?? '',
        },
      }
    : isMultiDm
      ? {
          dm: {
            club: params.channel.id,
          },
        }
      : {
          dm: {
            ship: params.channel.id,
          },
        };

  // optimistic update
  if (!params.level) {
    await db.removeVolumeLevels({ itemIds: [params.channel.id] });
  } else {
    await db.setVolumes({
      volumes: [
        { itemId: params.channel.id, itemType: 'channel', level: params.level },
      ],
    });
  }

  try {
    await api.adjustVolumeSetting(
      source,
      params.level ? ub.getVolumeMap(params.level, true) : null
    );
  } catch (e) {
    // rollback
    logger.trackError('ActivityAction: Failed to set channel volume level', {
      channelId: params.channel.id,
      channelType: params.channel.type,
      level: params.level ?? 'removed',
      errorMessage: e.message,
    });
    if (existingVolumeSetting) {
      await db.setVolumes({
        volumes: [
          {
            itemId: params.channel.id,
            itemType: 'channel',
            level: existingVolumeSetting,
          },
        ],
      });
    }
  }
}
