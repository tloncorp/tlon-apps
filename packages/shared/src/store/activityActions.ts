import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';

const logger = createDevLogger('activityActions', true);

export async function muteChat(channel: db.Channel) {
  const existingSettings = await db.getVolumeSettings();

  const { source, sourceId } = api.getRootSourceFromChannel(channel);
  const volume = ub.getVolumeMap('soft', true);

  // optimistic update
  db.mergeVolumeSettings([{ sourceId, volume }]);
  if (channel.groupId) {
    db.setGroupVolumes([
      { groupId: channel.groupId, isMuted: true, isNoisy: false },
    ]);
  } else {
    db.setChannelVolumes([
      { channelId: channel.id, isMuted: true, isNoisy: false },
    ]);
  }

  try {
    await api.adjustVolumeSetting(source, volume);
  } catch (e) {
    logger.log(`failed to mute group ${channel.id}`, e);
    // revert the optimistic update
    db.mergeVolumeSettings([
      { sourceId, volume: existingSettings[sourceId] ?? null },
    ]);
    if (channel.groupId) {
      db.setGroupVolumes([
        {
          groupId: channel.groupId,
          isMuted: channel.isMuted ?? undefined,
          isNoisy: channel.isNoisy ?? undefined,
        },
      ]);
    } else {
      db.setChannelVolumes([
        {
          channelId: channel.id,
          isMuted: channel.isMuted ?? undefined,
          isNoisy: channel.isNoisy ?? undefined,
        },
      ]);
    }
  }
}

export async function unmuteChat(channel: db.Channel) {
  const { source, sourceId } = api.getRootSourceFromChannel(channel);
  const existingSettings = await db.getVolumeSettings();

  // optimistic update
  db.mergeVolumeSettings([{ sourceId, volume: null }]);

  if (channel.groupId) {
    db.setGroupVolumes([
      { groupId: channel.groupId, isMuted: false, isNoisy: false },
    ]);
  } else {
    db.setChannelVolumes([
      { channelId: channel.id, isMuted: false, isNoisy: false },
    ]);
  }

  try {
    await api.adjustVolumeSetting(source, null);
  } catch (e) {
    logger.log(`failed to unmute chat ${channel.id}`, e);
    // revert the optimistic update
    db.mergeVolumeSettings([
      { sourceId, volume: existingSettings[sourceId] ?? null },
    ]);

    if (channel.groupId) {
      db.setGroupVolumes([
        {
          groupId: channel.groupId,
          isMuted: channel.isMuted ?? undefined,
          isNoisy: channel.isNoisy ?? undefined,
        },
      ]);
    } else {
      db.setChannelVolumes([
        {
          channelId: channel.id,
          isMuted: channel.isMuted ?? undefined,
          isNoisy: channel.isNoisy ?? undefined,
        },
      ]);
    }
  }
}

export async function muteThread({
  channel,
  thread,
}: {
  channel: db.Channel;
  thread: db.Post;
}) {
  const { source, sourceId } = api.getThreadSource({ channel, post: thread });
  const volume = ub.getVolumeMap('soft', true);

  // optimistic update
  // db.mergeVolumeSettings([{ sourceId, volume }]);
  db.setThreadVolumes([{ postId: thread.id, isMuted: true, isNoisy: false }]);

  try {
    await api.adjustVolumeSetting(source, volume);
  } catch (e) {
    logger.log(`failed to mute thread ${channel.id}/${thread.id}`, e);
    // revert the optimistic update
    db.mergeVolumeSettings([{ sourceId, volume: null }]);
    db.setThreadVolumes([
      {
        postId: thread.id,
        isMuted: thread.isMuted ?? false,
        isNoisy: thread.isNoisy ?? false,
      },
    ]);
  }
}

export async function unmuteThread({
  channel,
  thread,
}: {
  channel: db.Channel;
  thread: db.Post;
}) {
  const existingSettings = await db.getVolumeSettings();
  const { source, sourceId } = api.getThreadSource({ channel, post: thread });

  // optimistic update
  // db.mergeVolumeSettings([{ sourceId, volume: null }]);
  db.setThreadVolumes([{ postId: thread.id, isMuted: true, isNoisy: false }]);

  try {
    await api.adjustVolumeSetting(source, null);
  } catch (e) {
    logger.log(`failed to unmute thread ${channel.id}/${thread.id}`, e);
    // revert the optimistic update
    // db.mergeVolumeSettings([
    //   { sourceId, volume: existingSettings[sourceId] ?? null },
    // ]);
    db.setThreadVolumes([
      {
        postId: thread.id,
        isMuted: thread.isMuted ?? false,
        isNoisy: thread.isNoisy ?? false,
      },
    ]);
  }
}

export async function setDefaultNotificationLevel(level: ub.NotificationLevel) {
  const existingSettings = await db.getVolumeSettings();
  const source: ub.Source = { base: null };
  const sourceId = 'base';
  const volumeMap = ub.getVolumeMap(level, true);

  // optimistic update
  db.mergeVolumeSettings([{ sourceId, volume: ub.getVolumeMap(level, true) }]);

  try {
    await api.adjustVolumeSetting(source, volumeMap);
  } catch (e) {
    logger.log(`failed to set default notification level`, e);
    // revert the optimistic update
    db.mergeVolumeSettings([
      { sourceId, volume: existingSettings.base ?? null },
    ]);
  }
}

export async function advanceActivitySeenMarker(timestamp: number) {
  const existingMarker = await db.getActivitySeenMarker();
  if (timestamp > existingMarker) {
    db.storeActivitySeenMarker(timestamp);
  }
}
