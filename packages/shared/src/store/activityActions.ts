import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { isGroupChannelId } from '../logic';
import * as ub from '../urbit';
import { whomIsMultiDm } from '../urbit';

const logger = createDevLogger('activityActions', false);

export async function muteChat(channel: db.Channel) {
  const initialSettings = await getChatVolumeSettings(channel);
  const muteLevel = channel.groupId ? 'soft' : 'hush';

  db.setVolumes({
    volumes: [
      {
        itemId: channel.groupId ?? channel.id,
        itemType: channel.groupId ? 'group' : 'channel',
        level: muteLevel,
      },
    ],
  });

  try {
    const { source } = api.getRootSourceFromChannel(channel);
    const volume = ub.getVolumeMap(muteLevel, true);
    await api.adjustVolumeSetting(source, volume);
  } catch (e) {
    logger.log(`failed to mute group ${channel.id}`, e);
    // revert the optimistic update
    if (initialSettings) {
      await db.setVolumes({ volumes: [initialSettings] });
    }
  }
}

export async function unmuteChat(channel: db.Channel) {
  const initialSettings = await getChatVolumeSettings(channel);

  db.setVolumes({
    volumes: [
      {
        itemId: channel.groupId ?? channel.id,
        itemType: channel.groupId ? 'group' : 'channel',
        level: 'default',
      },
    ],
  });

  try {
    const { source } = api.getRootSourceFromChannel(channel);
    await api.adjustVolumeSetting(source, null);
  } catch (e) {
    logger.log(`failed to unmute chat ${channel.id}`, e);
    // revert the optimistic update
    if (initialSettings) {
      await db.setVolumes({ volumes: [initialSettings] });
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

  db.setVolumes({
    volumes: [{ itemId: thread.id, itemType: 'thread', level: 'soft' }],
  });

  try {
    const { source } = api.getThreadSource({ channel, post: thread });
    const volume = ub.getVolumeMap('soft', true);
    await api.adjustVolumeSetting(source, volume);
  } catch (e) {
    logger.log(`failed to mute thread ${channel.id}/${thread.id}`, e);
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
    logger.log(`failed to unmute thread ${channel.id}/${thread.id}`, e);
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
    logger.log(`failed to set base volume level`, e);
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
    logger.log(`failed to set volume level`, e);
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
    logger.log(`failed to set volume level`, e);
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
