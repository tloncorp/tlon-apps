import { unixToDa } from '@urbit/api';
import { backOff } from 'exponential-backoff';

import * as db from '../db';
import { createDevLogger } from '../debug';
import { extractClientVolume } from '../logic/activity';
import * as ub from '../urbit';
import {
  formatUd,
  getCanonicalPostId,
  getChannelIdType,
  parseGroupChannelId,
  parseGroupId,
  udToDate,
} from './apiUtils';
import { poke, scry, subscribe } from './urbit';

const logger = createDevLogger('activityApi', false);

export async function getGroupAndChannelUnreads() {
  const activity = await scry<ub.Activity>({
    app: 'activity',
    path: '/v4/activity',
  });
  const deserialized = toClientUnreads(activity);
  return deserialized;
}

export async function getThreadUnreadsByChannel(channel: db.Channel) {
  let scryPath = '';
  if (getChannelIdType(channel.id) === 'channel' && channel.groupId) {
    const groupParts = parseGroupId(channel.groupId);
    const channelParts = parseGroupChannelId(channel.id);
    const pathParts = [
      'v4',
      'activity',
      'threads',
      groupParts.host,
      groupParts.name,
      channelParts.kind,
      channelParts.host,
      channelParts.name,
    ].join('/');
    scryPath = `/${pathParts}/`;
  } else {
    scryPath = `/v4/activity/dm-threads/${channel.id}/`;
  }
  const activity = await scry<ub.Activity>({
    app: 'activity',
    path: scryPath,
  });

  const deserialized = toClientUnreads(activity);
  return deserialized.threadActivity;
}
export async function getVolumeSettings(): Promise<ub.VolumeSettings> {
  const settings = await scry<ub.VolumeSettings>({
    app: 'activity',
    path: '/volume-settings',
  });
  return settings;
}

export const ACTIVITY_SOURCE_PAGESIZE = 30;
export async function getInitialActivity() {
  const response = await scry<ub.InitActivityFeeds>({
    app: 'activity',
    path: `/v5/feed/init/${ACTIVITY_SOURCE_PAGESIZE}`,
  });

  const events = fromInitFeedToBucketedActivityEvents(response);
  const relevantUnreads = toClientUnreads(response.summaries);
  return {
    events,
    relevantUnreads,
  };
}

export function fromInitFeedToBucketedActivityEvents(
  feeds: Omit<ub.InitActivityFeeds, 'summaries'>
) {
  return [
    ...fromFeedToActivityEvents(feeds.all, 'all'),
    ...fromFeedToActivityEvents(feeds.mentions, 'mentions'),
    ...fromFeedToActivityEvents(feeds.replies, 'replies'),
  ];
}

// Whereas the initial feed scry returns all, mentions, and replies, for paginated
// fetching of more data, we grab by particular bucket
export async function getPagedActivityByBucket({
  cursor,
  bucket,
}: {
  cursor: number;
  bucket: db.ActivityBucket;
}): Promise<{
  events: db.ActivityEvent[];
  nextCursor: number | null;
  relevantUnreads: ActivityInit;
}> {
  logger.log(
    `fetching next activity page for bucket ${bucket} with cursor`,
    cursor
  );
  const urbitCursor = formatUd(unixToDa(cursor).toString());
  const path = `/v5/feed/${bucket}/${ACTIVITY_SOURCE_PAGESIZE}/${urbitCursor}/`;
  const { feed, summaries } = await scry<ub.ActivityFeed>({
    app: 'activity',
    path,
  });

  const events = fromFeedToActivityEvents(feed, bucket);
  const relevantUnreads = toClientUnreads(summaries);
  const nextCursor = extractNextCursor(feed);

  return { events, nextCursor, relevantUnreads };
}

export function fromFeedToActivityEvents(
  feed: ub.ActivityBundle[],
  bucket: db.ActivityBucket
): db.ActivityEvent[] {
  const stream: EnhancedStream = {};
  feed.forEach((feedItem) => {
    const sourceId = feedItem['source-key'];
    feedItem.events.forEach(({ time, event }) => {
      stream[time] = { sourceId, ...event };
    });
  });

  return toActivityEvents(stream, bucket);
}

function extractNextCursor(feed: ub.ActivityBundle[]): number | null {
  if (feed.length === 0) {
    return null;
  }

  const lastItem = feed[feed.length - 1];
  const lastEvent = lastItem.events[0];
  return udToDate(lastEvent.time);
}

export type EnhancedStream = Record<
  string,
  ub.ActivityEvent & { sourceId: string }
>;
function toActivityEvents(
  stream: EnhancedStream,
  bucketId: db.ActivityBucket
): db.ActivityEvent[] {
  return Object.entries(stream)
    .map(([id, event]) =>
      toActivityEvent({ id, event, bucketId, sourceId: event.sourceId })
    )
    .filter(Boolean) as db.ActivityEvent[];
}

function toActivityEvent({
  id,
  sourceId,
  bucketId,
  event,
}: {
  id: string | number;
  sourceId: string;
  event: ub.ActivityEvent;
  bucketId: db.ActivityBucket;
}): db.ActivityEvent | null {
  const timestamp = typeof id === 'number' ? id : udToDate(id);
  const shouldNotify = event.notified;
  const baseFields = {
    id: id.toString(),
    timestamp,
    shouldNotify,
    bucketId,
    sourceId,
  };

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
      getInfoFromMessageKey(replyEvent.parent, true);
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

  if ('flag-post' in event) {
    const flagEvent = event['flag-post'];
    const { authorId, postId } = getInfoFromMessageKey(flagEvent.key);
    return {
      ...baseFields,
      type: 'flag-post',
      postId,
      authorId,
      channelId: flagEvent.channel,
      groupId: flagEvent.group,
    };
  }

  if ('flag-reply' in event) {
    const flagEvent = event['flag-reply'];
    const { authorId, postId } = getInfoFromMessageKey(flagEvent.key);
    const { postId: parentId, authorId: parentAuthorId } =
      getInfoFromMessageKey(flagEvent.parent);
    return {
      ...baseFields,
      type: 'flag-reply',
      postId,
      parentId,
      parentAuthorId,
      authorId,
      channelId: flagEvent.channel,
      groupId: flagEvent.group,
    };
  }

  if ('group-ask' in event) {
    return {
      ...baseFields,
      type: 'group-ask',
      groupId: event['group-ask'].group,
      groupEventUserId: event['group-ask'].ship,
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
      type: 'updateChannelUnread';
      activity: db.ChannelUnread;
    }
  | { type: 'updateThreadUnread'; activity: db.ThreadUnreadState }
  | { type: 'updateGroupUnread'; unread: db.GroupUnread }
  | {
      type: 'updateVolumeSetting';
      update: VolumeUpdate;
    }
  | {
      type: 'updateItemVolume';
      volumeUpdate: db.VolumeSettings;
    }
  | {
      type: 'updatePushNotificationsSetting';
      value: ub.PushNotificationsSetting;
    }
  | { type: 'addActivityEvent'; events: db.ActivityEvent[] };

export function subscribeToActivity(handler: (event: ActivityEvent) => void) {
  subscribe<ub.ActivityUpdate>(
    { app: 'activity', path: '/v4' },
    async (update: ub.ActivityUpdate) => {
      // handle unreads
      if ('activity' in update) {
        Object.entries(update.activity).forEach((activityEntry) => {
          const [sourceId, summary] = activityEntry;
          const source = sourceIdToSource(sourceId);

          switch (source.type) {
            case 'group':
              handler({
                type: 'updateGroupUnread',
                unread: toGroupUnread(source.groupId, summary),
              });
              break;
            case 'channel':
              handler({
                type: 'updateChannelUnread',
                activity: toChannelUnread(source.channelId, summary, 'dm'),
              });
              break;
            case 'thread':
              handler({
                type: 'updateThreadUnread',
                activity: toThreadUnread(
                  source.channelId,
                  source.threadId,
                  summary,
                  source.channelType
                ),
              });
              break;
          }
        });
      }

      // handle volume settings
      if ('adjust' in update) {
        const { source, volume } = update.adjust;
        const sourceId = ub.sourceToString(source);

        if ('group' in source) {
          const clientVolume = extractClientVolume(volume);
          return handler({
            type: 'updateItemVolume',
            volumeUpdate: {
              itemId: source.group,
              itemType: 'group',
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
            type: 'updateItemVolume',
            volumeUpdate: {
              itemId: channelId,
              itemType: 'channel',
              ...clientVolume,
            },
          });
        }

        if ('thread' in source || 'dm-thread' in source) {
          const clientVolume = extractClientVolume(volume);
          const postId = getPostIdFromSource(source);
          return handler({
            type: 'updateItemVolume',
            volumeUpdate: {
              itemId: postId,
              itemType: 'thread',
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

      // handle push notification settings
      if ('allow-notifications' in update) {
        const notifsAllowed = update['allow-notifications'];

        return handler({
          type: 'updatePushNotificationsSetting',
          value: notifsAllowed,
        });
      }

      // handle new activity events
      if ('add' in update) {
        const id = update.add.time;
        const sourceId = update.add['source-key'];
        const rawEvent = update.add.event;

        const activityEvent = toActivityEvent({
          id,
          sourceId,
          bucketId: 'all',
          event: rawEvent,
        });

        const events = [];
        if (activityEvent) {
          events.push(activityEvent);
          if (activityEvent?.isMention) {
            events.push({
              ...activityEvent,
              bucketId: 'mentions' as db.ActivityBucket,
            });
          }
          if (activityEvent?.type === 'reply') {
            events.push({
              ...activityEvent,
              bucketId: 'replies' as db.ActivityBucket,
            });
          }
        }

        if (events.length > 0) {
          return handler({ type: 'addActivityEvent', events });
        }
      }
    }
  );
}

export function activityAction(action: ub.ActivityAction) {
  return {
    app: 'activity',
    mark: 'activity-action',
    json: action,
  };
}

export const readGroup = async (group: db.Group) => {
  const source: ub.Source = { group: group.id };
  const action = activityAction({
    read: { source, action: { all: { time: null, deep: false } } },
  });
  logger.log(`reading group ${group.id}`, action);

  return backOff(() => poke(action), {
    delayFirstAttempt: false,
    startingDelay: 2000,
    numOfAttempts: 4,
  });
};

export const readChannel = async (channel: db.Channel) => {
  let source: ub.Source;
  if (channel.type === 'dm') {
    source = { dm: { ship: channel.id } };
  } else if (channel.type == 'groupDm') {
    source = { dm: { club: channel.id } };
  } else {
    source = { channel: { nest: channel.id, group: channel.groupId! } };
  }

  const action = activityAction({
    read: { source, action: { all: { time: null, deep: false } } },
  });
  logger.log(`reading channel ${channel.id}`, action);

  // simple retry logic to avoid failed read leading to lingering unread state
  return backOff(() => poke(action), {
    delayFirstAttempt: false,
    startingDelay: 2000,
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

  const action = activityAction({
    read: { source, action: { all: { time: null, deep: false } } },
  });

  // simple retry logic to avoid failed read leading to lingering unread state
  return backOff(() => poke(action), {
    delayFirstAttempt: false,
    startingDelay: 2000,
    numOfAttempts: 4,
  });
};

// We need to pass a particular data structure to the backend when referencing
// threads. It's subtly different depending on whether it's %chat or %channels based
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

/*
  The following helpers are used to produce "sources" which is what %activity uses to refer
  to particular activity-emitting contexts (groups, channels, threads). They nest under eachother, so
  a thread will have a parent channel source, which in turn will have a parent group source

  Sources can be represented as a string or an object (see urbit/activity.ts for details).
*/

interface ClientGroupSource {
  type: 'group';
  groupId: string;
}

interface ClientChannelSource {
  type: 'channel';
  channelId: string;
}

interface ClientThreadSource {
  type: 'thread';
  channelId: string;
  channelType: db.ChannelUnread['type'];
  threadId: string;
}

interface ClientUnknownSource {
  type: 'unknown'; // for source types we don't care about
}

export type ClientSource =
  | ClientGroupSource
  | ClientChannelSource
  | ClientThreadSource
  | ClientUnknownSource;

export function sourceIdToSource(sourceId: string): ClientSource {
  const parts = sourceId.split('/');
  const sourceType = parts[0];

  if (sourceType === 'group') {
    const host = parts[1];
    const name = parts[2];
    return { type: 'group', groupId: `${host}/${name}` };
  }

  if (sourceType === 'channel') {
    const kind = parts[1];
    const host = parts[2];
    const name = parts[3];
    return { type: 'channel', channelId: `${kind}/${host}/${name}` };
  }

  if (sourceType === 'ship' || sourceType === 'club') {
    const channelId = parts[1];
    return { type: 'channel', channelId };
  }

  if (sourceType === 'thread') {
    const kind = parts[1];
    const host = parts[2];
    const name = parts[3];
    const threadId = getCanonicalPostId(parts[4]);
    return {
      type: 'thread',
      channelType: 'channel',
      channelId: `${kind}/${host}/${name}`,
      threadId,
    };
  }

  if (sourceType === 'dm-thread') {
    const channelId = parts[1];
    const threadId = getCanonicalPostId(`${parts[2]}/${parts[3]}`);
    return { type: 'thread', channelType: 'dm', channelId, threadId };
  }

  return { type: 'unknown' };
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

/*
  Volume settings are %activity's way of managing what kind of activity events should be
  considered "meaningful". These are what's manipulated when you mute a resource for example.
*/

export async function adjustVolumeSetting(
  source: ub.Source,
  volume: ub.VolumeMap | null
) {
  const action = activityAction({ adjust: { source, volume } });
  return poke(action);
}

// This is a global, top level filter for which kinds of activity events are allowed to send
// push notifications to your device. If an activity event has the notify flag set, and passes
// the filter, then a push will be triggered.
export async function setPushNotificationsSetting(
  allow: ub.PushNotificationsSetting
) {
  const action = activityAction({ 'allow-notifications': allow });
  return poke(action);
}

export async function getPushNotificationsSetting(): Promise<ub.PushNotificationsSetting> {
  return scry<ub.PushNotificationsSetting>({
    app: 'activity',
    path: '/notifications-allowed',
  });
}

export type ActivityUpdateQueue = {
  groupUnreads: db.GroupUnread[];
  channelUnreads: db.ChannelUnread[];
  threadUnreads: db.ThreadUnreadState[];
  volumeUpdates: db.VolumeSettings[];
  activityEvents: db.ActivityEvent[];
};

export type ActivityInit = {
  groupUnreads: db.GroupUnread[];
  channelUnreads: db.ChannelUnread[];
  threadActivity: db.ThreadUnreadState[];
};

export const toClientUnreads = (activity: ub.Activity): ActivityInit => {
  const groupUnreads: db.GroupUnread[] = [];
  const channelUnreads: db.ChannelUnread[] = [];
  const threadActivity: db.ThreadUnreadState[] = [];

  Object.entries(activity).forEach(([sourceId, summary]) => {
    const [activityId, ...rest] = sourceId.split('/');
    if (activityId === 'ship' || activityId === 'club') {
      const channelId = rest.join('/');
      channelUnreads.push(toChannelUnread(channelId, summary, 'dm'));
    }

    if (activityId === 'group') {
      const groupId = rest.join('/');
      groupUnreads.push(toGroupUnread(groupId, summary));
    }

    if (activityId === 'channel') {
      const channelId = rest.join('/');
      channelUnreads.push(toChannelUnread(channelId, summary, 'channel'));
    }

    if (activityId === 'thread' || activityId === 'dm-thread') {
      const channelId =
        activityId === 'dm-thread' ? rest[0] : rest.slice(0, 3).join('/');
      const threadId = rest[rest.length - 1];
      threadActivity.push(
        toThreadUnread(
          channelId,
          threadId,
          summary,
          activityId === 'dm-thread' ? 'dm' : 'channel'
        )
      );
    }
  });

  return { channelUnreads, threadActivity, groupUnreads };
};

export const toGroupUnread = (
  groupId: string,
  summary: ub.ActivitySummary
): db.GroupUnread => {
  return {
    groupId,
    count: summary.count,
    notify: summary.notify,
    updatedAt: summary.recency,
    notifyCount: summary['notify-count'],
  };
};

export const toChannelUnread = (
  channelId: string,
  summary: ub.ActivitySummary,
  type: db.ChannelUnread['type']
): db.ChannelUnread => {
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
  };
};

export const toThreadUnread = (
  channelId: string,
  threadId: string,
  summary: ub.ActivitySummary,
  type: db.ChannelUnread['type']
): db.ThreadUnreadState => {
  const summaryKey = type === 'dm' ? 'id' : 'time';
  const firstUnreadPostId =
    summary.unread && summary.unread[summaryKey]
      ? getCanonicalPostId(summary.unread[summaryKey])
      : null;
  return {
    channelId,
    threadId: getCanonicalPostId(threadId),
    updatedAt: summary.recency,
    count: summary.count,
    notify: summary.notify,
    firstUnreadPostId,
    firstUnreadPostReceivedAt: firstUnreadPostId
      ? udToDate(firstUnreadPostId)
      : null,
  };
};
