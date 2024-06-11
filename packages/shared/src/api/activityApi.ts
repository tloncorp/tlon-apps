import { backOff } from 'exponential-backoff';

import * as db from '../db';
import { createDevLogger } from '../debug';
import { extractClientVolume } from '../logic/activity';
import * as ub from '../urbit';
import { getCanonicalPostId, udToDate } from './apiUtils';
import { poke, scry, subscribe } from './urbit';

const logger = createDevLogger('activityApi', true);

export async function getUnreads() {
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

export async function getActivityEvents() {
  const activity = await scry<ub.Stream>({
    app: 'activity',
    path: '/all',
  });

  return toActivityEvents(activity);
}

export async function getPagedActivity() {
  // const activity = await scry<ub.Stream>({
  //   app: 'activity',
  //   path: '/all',
  // });

  return [];
}

function toActivityEvents(stream: ub.Stream): db.ActivityEvent[] {
  return Object.entries(stream)
    .map(([id, event]) => toActivityEvent(id, event))
    .filter(Boolean) as db.ActivityEvent[];
}

function toActivityEvent(
  id: string | number,
  event: ub.ActivityEvent
): db.ActivityEvent | null {
  const timestamp = typeof id === 'number' ? id : udToDate(id);
  const shouldNotify = event.notified;
  const baseFields = { id: id.toString(), timestamp, shouldNotify };

  if ('post' in event) {
    const postEvent = event.post;
    const { authorId, postId } = getInfoFromMessageKey(postEvent.key);
    return {
      ...baseFields,
      type: 'post',
      postId,
      authorId,
      channelId: postEvent.channel,
      groupId: postEvent.group,
      content: postEvent.content,
      isMention: postEvent.mention,
    };
  }

  if ('reply' in event) {
    const replyEvent = event.reply;
    const { authorId, postId } = getInfoFromMessageKey(replyEvent.key);
    const { postId: parentId, authorId: parentAuthorId } =
      getInfoFromMessageKey(replyEvent.parent);
    return {
      ...baseFields,
      type: 'reply',
      postId,
      parentId,
      authorId,
      parentAuthorId,
      channelId: replyEvent.channel,
      groupId: replyEvent.group,
      content: replyEvent.content,
      isMention: replyEvent.mention,
    };
  }

  if ('dm-post' in event) {
    const dmEvent = event['dm-post'];
    const { authorId, postId } = getInfoFromMessageKey(dmEvent.key, true);
    return {
      ...baseFields,
      type: 'post',
      postId,
      authorId,
      channelId: 'ship' in dmEvent.whom ? dmEvent.whom.ship : dmEvent.whom.club,
      content: dmEvent.content,
      isMention: dmEvent.mention,
    };
  }

  if ('dm-reply' in event) {
    const replyEvent = event['dm-reply'];
    const { authorId, postId } = getInfoFromMessageKey(replyEvent.key, true);
    const { postId: parentId, authorId: parentAuthorId } =
      getInfoFromMessageKey(replyEvent.parent);
    return {
      ...baseFields,
      type: 'reply',
      authorId,
      postId,
      parentId,
      parentAuthorId,
      channelId:
        'ship' in replyEvent.whom ? replyEvent.whom.ship : replyEvent.whom.club,
      content: replyEvent.content,
      isMention: replyEvent.mention,
    };
  }

  return null;
}

function getInfoFromMessageKey(
  key: { id: string; time: string },
  isDm?: boolean
) {
  const authorId = key.id.split('/')[0];
  const postId = getCanonicalPostId(isDm ? key.id : key.time);
  return { authorId, postId };
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
    }
  | {
      type: 'updateGroupVolume';
      volumeUpdate: db.GroupVolume;
    }
  | {
      type: 'updateThreadVolume';
      volumeUpdate: db.ThreadVolume;
    }
  | { type: 'updateChannelVolume'; volumeUpdate: db.ChannelVolume }
  | { type: 'addActivityEvent'; event: db.ActivityEvent };

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

        if ('group' in source) {
          const clientVolume = extractClientVolume(volume);
          return handler({
            type: 'updateGroupVolume',
            volumeUpdate: {
              groupId: source.group,
              ...clientVolume,
            },
          });
        }

        if ('channel' in source || 'dm' in source) {
          const clientVolume = extractClientVolume(volume, 'channel' in source);
          const channelId =
            'channel' in source
              ? source.channel.nest
              : 'ship' in source.dm
                ? source.dm.ship
                : source.dm.club;
          return handler({
            type: 'updateChannelVolume',
            volumeUpdate: {
              channelId,
              ...clientVolume,
            },
          });
        }

        if ('thread' in source || 'dm-thread' in source) {
          const clientVolume = extractClientVolume(volume);
          const postId = getPostIdFromSource(source);
          return handler({
            type: 'updateThreadVolume',
            volumeUpdate: {
              postId,
              ...clientVolume,
            },
          });
        }

        // keep handling threads as they were
        return handler({
          type: 'updateVolumeSetting',
          update: { sourceId, volume },
        });
      }

      if ('add' in update) {
        const rawEvent = update.add.event;
        const activityEvent = toActivityEvent(update.add.time, rawEvent);
        if (activityEvent) {
          return handler({ type: 'addActivityEvent', event: activityEvent });
        }
      }

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

  // simple retry logic to avoid failed read leading to lingering unread state
  return backOff(() => poke(action), {
    delayFirstAttempt: false,
    startingDelay: 2000, // 4 seconds
    numOfAttempts: 4,
  });
};

export const readThread = async ({
  parentPost,
  channel,
}: {
  post: db.Post;
  parentPost: db.Post;
  channel: db.Channel;
}) => {
  logger.log(
    'reading thread',
    channel.id,
    parentPost.id,
    parentPost.backendTime
  );
  let source: ub.Source;
  if (channel.type === 'dm') {
    if (!parentPost.backendTime) {
      throw new Error(
        `Cannot read thread without post.backendTime for message key, ${parentPost.id}`
      );
    }

    source = {
      'dm-thread': {
        whom: { ship: channel.id },
        key: {
          id: `${parentPost.authorId}/${parentPost.id}`,
          time: parentPost.backendTime,
        },
      },
    };
  } else if (channel.type == 'groupDm') {
    if (!parentPost.backendTime) {
      throw new Error(
        `Cannot read thread without post.backendTime for message key, ${parentPost.id}`
      );
    }

    source = {
      'dm-thread': {
        whom: { club: channel.id },
        key: {
          id: `${parentPost.authorId}/${parentPost.id}`,
          time: parentPost.backendTime,
        },
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

  // simple retry logic to avoid failed read leading to lingering unread state
  return backOff(() => poke(action), {
    delayFirstAttempt: false,
    startingDelay: 2000, // 4 seconds
    numOfAttempts: 4,
  });
};

export function getMessageKey(
  channel: db.Channel,
  post: db.Post
): { id: string; time: string } {
  if (channel.type === 'dm' || channel.type === 'groupDm') {
    if (!post.backendTime) {
      throw Error(
        `Cannot get message key without post.backendTime, ${post.id}`
      );
    }
    return {
      id: `${post.authorId}/${post.id}`,
      time: post.backendTime,
    };
  }

  return {
    id: `${post.authorId}/${post.id}`,
    time: post.id,
  };
}

export function getThreadSource({
  channel,
  post,
}: {
  channel: db.Channel;
  post: db.Post;
}): {
  source: ub.Source;
  sourceId: string;
} {
  let source: ub.Source;
  if (channel.type === 'dm') {
    source = {
      'dm-thread': {
        whom: { ship: channel.id },
        key: getMessageKey(channel, post),
      },
    };
  } else if (channel.type === 'groupDm') {
    source = {
      'dm-thread': {
        whom: { club: channel.id },
        key: getMessageKey(channel, post),
      },
    };
  } else {
    source = {
      thread: {
        channel: channel.id,
        group: channel.groupId!,
        key: getMessageKey(channel, post),
      },
    };
  }

  const sourceId = ub.sourceToString(source);

  return { source, sourceId };
}

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
  channelVolumeUpdates: db.ChannelVolume[];
  groupVolumeUpdates: db.GroupVolume[];
  threadVolumeUpdates: db.ThreadVolume[];
  volumeSettings: VolumeUpdate[];
  activityEvents: db.ActivityEvent[];
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
      const channelId =
        activityId === 'dm-thread' ? rest[0] : rest.slice(0, 3).join('/');
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
