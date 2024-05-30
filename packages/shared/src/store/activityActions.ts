import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';

const logger = createDevLogger('activityActions', true);

export async function muteChat(channel: db.Channel) {
  const { source, sourceId } = api.getRootSourceFromChannel(channel);
  const volume = ub.getVolumeMap('soft', true);

  // optimistic update
  db.mergeVolumeSettings([{ sourceId, volume }]);

  try {
    // await api.adjustVolumeSetting(source, volume);
  } catch (e) {
    logger.log(`failed to mute group ${channel.id}`, e);
    // revert the optimistic update
    db.mergeVolumeSettings([{ sourceId, volume: null }]);
  }
}

export async function unmuteChat(channel: db.Channel) {
  const { source, sourceId } = api.getRootSourceFromChannel(channel);
  const existingSettings = await db.getVolumeSettings();

  // optimistic update
  db.mergeVolumeSettings([{ sourceId, volume: null }]);

  try {
    // await api.adjustVolumeSetting(source, null);
  } catch (e) {
    logger.log(`failed to unmute chat ${channel.id}`, e);
    // revert the optimistic update
    db.mergeVolumeSettings([
      { sourceId, volume: existingSettings[sourceId] ?? null },
    ]);
  }
}

export async function muteThread({
  channel,
  thread,
}: {
  channel: db.Channel;
  thread: db.Post;
}) {
  // TODO: check with hunter on message keys
  let source: ub.Source;
  if (channel.type === 'dm' || channel.type === 'groupDm') {
    source = {
      'dm-thread': {
        whom:
          channel.type === 'dm' ? { ship: channel.id } : { club: channel.id },
        key: {
          id: `${thread.authorId}/${thread.id}`,
          time: thread.sentAt.toString(),
        },
      },
    };
  } else {
    source = {
      thread: {
        channel: channel.id,
        group: channel.groupId!,
        key: {
          id: `${thread.authorId}/${thread.id}`,
          time: thread.sentAt.toString(),
        },
      },
    };
  }
  const sourceId = ub.sourceToString(source);
  const volume = ub.getVolumeMap('soft', true);

  // optimistic update
  db.mergeVolumeSettings([{ sourceId, volume }]);

  try {
    await api.adjustVolumeSetting(source, volume);
  } catch (e) {
    logger.log(`failed to mute thread ${channel.id}/${thread.id}`, e);
    // revert the optimistic update
    db.mergeVolumeSettings([{ sourceId, volume: null }]);
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

  let source: ub.Source;
  if (channel.type === 'dm' || channel.type === 'groupDm') {
    source = {
      'dm-thread': {
        whom:
          channel.type === 'dm' ? { ship: channel.id } : { club: channel.id },
        key: {
          id: `${thread.authorId}/${thread.id}`,
          time: thread.sentAt.toString(),
        },
      },
    };
  } else {
    source = {
      thread: {
        channel: channel.id,
        group: channel.groupId!,
        key: {
          id: `${thread.authorId}/${thread.id}`,
          time: thread.sentAt.toString(),
        },
      },
    };
  }
  const sourceId = ub.sourceToString(source);

  // optimistic update
  db.mergeVolumeSettings([{ sourceId, volume: null }]);

  try {
    await api.adjustVolumeSetting(source, null);
  } catch (e) {
    logger.log(`failed to unmute thread ${channel.id}/${thread.id}`, e);
    // revert the optimistic update
    db.mergeVolumeSettings([
      { sourceId, volume: existingSettings[sourceId] ?? null },
    ]);
  }
}
