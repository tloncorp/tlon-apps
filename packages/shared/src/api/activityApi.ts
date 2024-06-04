import * as db from '../db';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';
import { getCanonicalPostId, udToDate } from './apiUtils';
import { poke, scry, subscribe } from './urbit';

const logger = createDevLogger('activityApi', true);

export async function getActivity() {
  const activity = await scry<ub.Activity>({
    app: 'activity',
    path: '/activity',
  });
  const deserialized = toClientActivity(activity);
  return deserialized;
}

export async function getVolumeSettings(): Promise<ub.VolumeSettings> {
  const settings = await scry<ub.VolumeSettings>({
    app: 'activity',
    path: '/volume-settings',
  });
  return settings;
}

export type VolumeUpdate = { sourceId: string; volume: ub.VolumeMap | null };
export type ActivityEvent =
  | {
      type: 'updateChannelActivity';
      activity: db.Unread;
    }
  | { type: 'updateThreadActivity'; activity: db.ThreadUnreadState }
  | {
      type: 'updateVolumeSetting';
      update: VolumeUpdate;
    };

export function subscribeToActivity(handler: (event: ActivityEvent) => void) {
  subscribe<ub.ActivityUpdate>(
    { app: 'activity', path: '/' },
    async (update: ub.ActivityUpdate) => {
      logger.log(`raw activity sub event`, update);
      // a 'read' update corresponds to any change in an activity summary
      if ('read' in update) {
        const { source, activity: summary } = update.read;
        if ('dm' in source) {
          const channelId = getChannelIdFromSource(source);
          return handler({
            type: 'updateChannelActivity',
            activity: toChannelActivity(channelId, summary, 'dm'),
          });
        }

        if ('channel' in source) {
          const channelId = getChannelIdFromSource(source);
          return handler({
            type: 'updateChannelActivity',
            activity: toChannelActivity(channelId, summary, 'channel'),
          });
        }

        if ('dm-thread' in source || 'thread' in source) {
          const channelId = getChannelIdFromSource(source);
          const threadId = getPostIdFromSource(source);
          return handler({
            type: 'updateThreadActivity',
            activity: toThreadActivity(
              channelId,
              threadId,
              summary,
              'dm-thread' in source ? 'dm' : 'channel'
            ),
          });
        }
      }

      if ('adjust' in update) {
        const { source, volume } = update.adjust;
        const sourceId = ub.sourceToString(source);
        return handler({
          type: 'updateVolumeSetting',
          update: { sourceId, volume },
        });
      }

      // add
      // TODO: we have the resource but not a summary here

      // delete
      // TODO: straightforward
    }
  );
}

function getChannelIdFromSource(source: ub.Source): string {
  if ('dm' in source) {
    return 'ship' in source.dm ? source.dm.ship : source.dm.club;
  }

  if ('channel' in source) {
    return source.channel.nest;
  }

  if ('thread' in source) {
    return source.thread.channel;
  }

  if ('dm-thread' in source) {
    return 'ship' in source['dm-thread'].whom
      ? source['dm-thread'].whom.ship
      : source['dm-thread'].whom.club;
  }

  return '';
}

function getPostIdFromSource(source: ub.Source): string {
  if ('thread' in source) {
    return getCanonicalPostId(source.thread.key.time);
  }

  if ('dm-thread' in source) {
    return getCanonicalPostId(source['dm-thread'].key.id);
  }

  return '';
}

export function activityAction(action: ub.ActivityAction) {
  return {
    app: 'activity',
    mark: 'activity-action',
    json: action,
  };
}

export const readChannel = async (channel: db.Channel) => {
  let source: ub.Source;
  if (channel.type === 'dm') {
    source = { dm: { ship: channel.id } };
  } else if (channel.type == 'groupDm') {
    source = { dm: { club: channel.id } };
  } else {
    source = { channel: { nest: channel.id, group: channel.groupId! } };
  }

  const action = activityAction({ read: { source, action: { all: null } } });
  logger.log(`reading channel ${channel.id}`, action);
  return poke(action);
};

export const readThread = async ({
  post,
  parentPost,
  channel,
}: {
  post: db.Post;
  parentPost: db.Post;
  channel: db.Channel;
}) => {
  logger.log('reading thread', channel.id, parentPost.id);
  let source: ub.Source;
  if (channel.type === 'dm') {
    source = {
      'dm-thread': {
        whom: { ship: channel.id },
        key: { id: `${parentPost.authorId}/${parentPost.id}`, time: post.id }, // time on parent
      },
    };
  } else if (channel.type == 'groupDm') {
    source = {
      'dm-thread': {
        whom: { club: channel.id },
        key: { id: `${parentPost.authorId}/${parentPost.id}`, time: post.id }, // time on parent
      },
    };
  } else {
    source = {
      thread: {
        channel: channel.id,
        group: channel.groupId!,
        key: {
          id: `${parentPost.authorId}/${parentPost.id}`,
          time: parentPost.id,
        },
      },
    };
  }

  const action = activityAction({ read: { source, action: { all: null } } });
  return poke(action);
};

export function getRootSourceFromChannel(channel: db.Channel): {
  source: ub.Source;
  sourceId: string;
} {
  let source: ub.Source;
  if (channel.type === 'dm') {
    source = { dm: { ship: channel.id } };
  } else if (channel.type === 'groupDm') {
    source = { dm: { club: channel.id } };
  } else {
    source = { group: channel.groupId! };
  }

  const sourceId = ub.sourceToString(source);

  return { source, sourceId };
}

export async function adjustVolumeSetting(
  source: ub.Source,
  volume: ub.VolumeMap | null
) {
  const action = activityAction({ adjust: { source, volume } });
  return poke(action);
}

export type ActivityUpdateQueue = {
  channelActivity: db.Unread[];
  threadActivity: db.ThreadUnreadState[];
  volumeSettings: VolumeUpdate[];
};

export type ActivityInit = {
  channelActivity: db.Unread[];
  threadActivity: db.ThreadUnreadState[];
};

export const toClientActivity = (activity: ub.Activity): ActivityInit => {
  const channelActivity: db.Unread[] = [];
  const threadActivity: db.ThreadUnreadState[] = [];

  Object.entries(activity).forEach(([id, summary]) => {
    logger.log(`parsing activity: ${id}`, summary);
    const [activityId, ...rest] = id.split('/');
    if (activityId === 'ship' || activityId === 'club') {
      const channelId = rest.join('/');
      channelActivity.push(toChannelActivity(channelId, summary, 'dm'));
    }

    if (activityId === 'channel') {
      const channelId = rest.join('/');
      channelActivity.push(toChannelActivity(channelId, summary, 'channel'));
    }

    if (activityId === 'thread' || activityId === 'dm-thread') {
      const channelId = rest.slice(0, -2).join('/');
      const threadId = rest[rest.length - 1];
      threadActivity.push(
        toThreadActivity(
          channelId,
          threadId,
          summary,
          activityId === 'dm-thread' ? 'dm' : 'channel'
        )
      );
    }

    // discard everything else for now
  });

  return { channelActivity, threadActivity };
};

export const toChannelActivity = (
  channelId: string,
  summary: ub.ActivitySummary,
  type: db.Unread['type']
): db.Unread & { threadUnreads: db.ThreadUnreadState[] } => {
  const summaryKey = type === 'dm' ? 'id' : 'time';
  const firstUnreadPostId =
    summary.unread && summary.unread[summaryKey]
      ? getCanonicalPostId(summary.unread[summaryKey])
      : null;
  return {
    channelId,
    type,
    updatedAt: summary.recency,
    count: summary.count,
    notify: summary.notify,
    countWithoutThreads: summary.unread?.count ?? 0,
    firstUnreadPostId,
    firstUnreadPostReceivedAt: firstUnreadPostId
      ? udToDate(firstUnreadPostId)
      : null,
    threadUnreads: [],
  };
};

export const toThreadActivity = (
  channelId: string,
  threadId: string,
  summary: ub.ActivitySummary,
  type: db.Unread['type']
): db.ThreadUnreadState => {
  const summaryKey = type === 'dm' ? 'id' : 'time';
  const firstUnreadPostId =
    summary.unread && summary.unread[summaryKey]
      ? getCanonicalPostId(summary.unread[summaryKey])
      : null;
  return {
    channelId,
    threadId: getCanonicalPostId(threadId),
    count: summary.count,
    notify: summary.notify,
    firstUnreadPostId,
    firstUnreadPostReceivedAt: firstUnreadPostId
      ? udToDate(firstUnreadPostId)
      : null,
  };
};
