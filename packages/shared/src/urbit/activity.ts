import { da } from '@urbit/aura';
import _ from 'lodash';

import type { UnionToIntersection } from '../utils';
import { Kind, Story } from './channel';
import { ContactBookProfile } from './contact';
import { nestToFlag, whomIsDm, whomIsFlag, whomIsMultiDm } from './utils';
import { parseIdNumber } from '../api/apiUtils';

export type Whom = { ship: string } | { club: string };

export type ExtendedEventType =
  | 'post'
  | 'post-mention'
  | 'reply'
  | 'reply-mention'
  | 'dm-invite'
  | 'dm-post'
  | 'dm-post-mention'
  | 'dm-reply'
  | 'dm-reply-mention'
  | 'group-ask'
  | 'group-join'
  | 'group-kick'
  | 'group-invite'
  | 'group-role'
  | 'flag-post'
  | 'flag-reply'
  | 'contact';

export type NotificationLevel = 'hush' | 'soft' | 'default' | 'medium' | 'loud';

export enum NotificationNames {
  loud = 'Notify for all activity',
  default = 'Posts, mentions and replies',
  medium = 'Posts, mentions and replies ',
  soft = 'Only mentions and replies',
  hush = 'Do not notify for any activity',
}

export enum NotificationNamesShort {
  loud = 'All posts and replies',
  default = 'All posts',
  medium = 'All posts ',
  soft = 'Mentions and replies',
  hush = 'No notifications',
}

export interface VolumeLevel {
  notify: NotificationLevel;
  unreads: boolean;
}

export type Volume = {
  unreads: boolean;
  notify: boolean;
};

export interface MessageKey {
  id: string;
  time: string;
}

export interface DmInviteEvent {
  'dm-invite': Whom;
}

export interface GroupKickEvent {
  'group-kick': {
    ship: string;
    group: string;
  };
}

export interface GroupAskEvent {
  'group-ask': {
    ship: string;
    group: string;
  };
}

export interface GroupJoinEvent {
  'group-join': {
    ship: string;
    group: string;
  };
}

export interface GroupRoleEvent {
  'group-role': {
    ship: string;
    group: string;
    roles: string[];
  };
}

export interface GroupInviteEvent {
  'group-invite': {
    ship: string;
    group: string;
  };
}

export interface FlagPostEvent {
  'flag-post': {
    key: MessageKey;
    channel: string;
    group: string;
  };
}

export interface FlagReplyEvent {
  'flag-reply': {
    key: MessageKey;
    parent: MessageKey;
    channel: string;
    group: string;
  };
}

export interface DmPostEvent {
  'dm-post': {
    key: MessageKey;
    whom: Whom;
    content: Story;
    mention: boolean;
  };
}

export interface DmReplyEvent {
  'dm-reply': {
    parent: MessageKey;
    key: MessageKey;
    whom: Whom;
    content: Story;
    mention: boolean;
  };
}

export interface PostEvent {
  post: {
    key: MessageKey;
    group: string;
    channel: string;
    content: Story;
    mention: boolean;
  };
}

export interface ReplyEvent {
  reply: {
    parent: MessageKey;
    key: MessageKey;
    group: string;
    channel: string;
    content: Story;
    mention: boolean;
  };
}

export interface ContactEvent {
  contact: {
    who: string;
    update: ContactBookProfile;
  };
}

export type ActivityIncomingEvent =
  | GroupKickEvent
  | GroupJoinEvent
  | GroupRoleEvent
  | GroupInviteEvent
  | GroupAskEvent
  | FlagPostEvent
  | FlagReplyEvent
  | DmInviteEvent
  | DmPostEvent
  | DmReplyEvent
  | PostEvent
  | ReplyEvent
  | ContactEvent;

export type ActivityEvent = {
  notified: boolean;
} & ActivityIncomingEvent;

export interface PostRead {
  seen: boolean;
  floor: string;
}

export interface Reads {
  floor: number;
  items: Record<string, PostRead>;
}

export interface IndexData {
  stream: Stream;
  reads: Reads;
}

export interface DmSource {
  dm: Whom;
}

export interface ChannelSource {
  channel: { nest: string; group: string };
}

export type Source =
  | DmSource
  | { base: null }
  | { group: string }
  | ChannelSource
  | { thread: { key: MessageKey; channel: string; group: string } }
  | { 'dm-thread': { key: MessageKey; whom: Whom } };

export interface MessageKey {
  id: string;
  time: string;
}

export interface UnreadPoint extends MessageKey {
  count: number;
  notify: boolean;
}

export interface UnreadThread extends UnreadPoint {
  'parent-time': string;
}

export interface ActivitySummary {
  recency: number;
  count: number;
  'notify-count': number;
  notify: boolean;
  unread: UnreadPoint | null;
  'recency-uv'?: string;
}

export interface ActivitySummaryFull extends ActivitySummary {
  reads: Reads;
  children: string[];
}

export interface ActivityBundle {
  source: Source;
  latest: string;
  events: { event: ActivityEvent; time: string }[];
  'source-key': string;
}

export interface ActivityFeed {
  feed: ActivityBundle[];
  summaries: Activity;
}

export type InitActivityFeeds = {
  all: ActivityBundle[];
  mentions: ActivityBundle[];
  replies: ActivityBundle[];
  summaries: Activity;
};

export type Activity = Record<string, ActivitySummary>;

export type Indices = Record<string, IndexData>;

export type Stream = Record<string, ActivityEvent>;

export type VolumeMap = Partial<Record<ExtendedEventType, Volume>>;

export type ReadAction =
  | { event: ActivityIncomingEvent }
  | { item: string }
  | { all: { time: string | null; deep: boolean } };

export interface ActivityReadAction {
  source: Source;
  action: ReadAction;
}

export interface ActivityVolumeAction {
  source: Source;
  volume: VolumeMap | null;
}

export type PushNotificationsSetting = 'all' | 'some' | 'none';

export type ActivityAction =
  | { add: ActivityIncomingEvent }
  | { del: Source }
  | { read: ActivityReadAction }
  | { adjust: ActivityVolumeAction }
  | { 'clear-group-invites': null }
  | { 'allow-notifications': PushNotificationsSetting };

export interface ActivitySummaryUpdate {
  activity: Activity;
}

export interface ActivityReadUpdate {
  read: {
    source: Source;
    activity: ActivitySummary;
  };
}

export interface ActivityVolumeUpdate {
  adjust: {
    source: Source;
    volume: VolumeMap | null;
  };
}

export interface ActivityAddUpdate {
  add: {
    ['source-key']: string;
    source: Source;
    time: string;
    event: ActivityEvent;
  };
}

export interface ActivityDeleteUpdate {
  del: Source;
}

export interface ActivityPushNotificationsSettingUpdate {
  'allow-notifications': PushNotificationsSetting;
}

export type ActivityUpdate =
  | ActivityReadUpdate
  | ActivitySummaryUpdate
  | ActivityVolumeUpdate
  | ActivityDeleteUpdate
  | ActivityAddUpdate
  | ActivityPushNotificationsSettingUpdate;

export interface FullActivity {
  indices: Indices;
  activity: Activity;
}

export type VolumeSettings = Record<string, VolumeMap | null>;

export function sourceToString(source: Source, stripPrefix = false): string {
  if ('thread' in source) {
    const key = `${source.thread.channel}/${source.thread.key.time}`;
    return stripPrefix ? key : `thread/${key}`;
  }

  if ('dm-thread' in source) {
    const prefix = sourceToString({ dm: source['dm-thread'].whom }, true);
    const key = `${prefix}/${source['dm-thread'].key.id}`;
    return stripPrefix ? key : `dm-thread/${key}`;
  }

  if ('channel' in source) {
    return stripPrefix ? source.channel.nest : `channel/${source.channel.nest}`;
  }

  if ('group' in source) {
    return stripPrefix ? source.group : `group/${source.group}`;
  }

  if ('dm' in source) {
    if ('ship' in source.dm) {
      return stripPrefix ? source.dm.ship : `ship/${source.dm.ship}`;
    }

    return stripPrefix ? source.dm.club : `club/${source.dm.club}`;
  }

  if ('base' in source) {
    return 'base';
  }

  throw new Error('Invalid activity source');
}

const onEvents: ExtendedEventType[] = [
  'dm-reply',
  'post-mention',
  'reply-mention',
  'dm-invite',
  'dm-post',
  'dm-post-mention',
  'dm-reply',
  'dm-reply-mention',
  'group-ask',
  'group-invite',
  'flag-post',
  'flag-reply',
];

const notifyOffEvents: ExtendedEventType[] = [
  'reply',
  'group-join',
  'group-kick',
  'group-role',
];

const allEvents: ExtendedEventType[] = [
  'post',
  'post-mention',
  'reply',
  'reply-mention',
  'dm-invite',
  'dm-post',
  'dm-post-mention',
  'dm-reply',
  'dm-reply-mention',
  'group-ask',
  'group-join',
  'group-kick',
  'group-invite',
  'group-role',
  'flag-post',
  'flag-reply',
];

export function getUnreadsFromVolumeMap(vmap: VolumeMap): boolean {
  return _.some(vmap, (v) => !!v?.unreads);
}

export function getLevelFromVolumeMap(vmap: VolumeMap): NotificationLevel {
  const entries = Object.entries(vmap) as [ExtendedEventType, Volume][];
  if (_.every(entries, ([, v]) => v.notify)) {
    return 'loud';
  }

  if (_.every(entries, ([, v]) => !v.notify)) {
    return 'hush';
  }

  let isDefault = true;
  entries.forEach(([k, v]) => {
    if (onEvents.concat('post').includes(k) && !v.notify) {
      isDefault = false;
    }

    if (notifyOffEvents.includes(k) && v.notify) {
      isDefault = false;
    }
  });

  if (isDefault) {
    return 'medium';
  }

  return 'soft';
}

export function getVolumeMap(
  level: NotificationLevel,
  unreads: boolean
): VolumeMap {
  const emptyMap: VolumeMap = {};
  if (level === 'loud') {
    return allEvents.reduce((acc, e) => {
      acc[e] = { unreads, notify: true };
      return acc;
    }, emptyMap);
  }

  if (level === 'hush') {
    return allEvents.reduce((acc, e) => {
      acc[e] = { unreads, notify: false };
      return acc;
    }, {} as VolumeMap);
  }

  return allEvents.reduce((acc, e) => {
    if (onEvents.includes(e)) {
      acc[e] = { unreads, notify: true };
    }

    if (notifyOffEvents.includes(e)) {
      acc[e] = { unreads, notify: false };
    }

    if (e === 'post') {
      acc[e] = { unreads, notify: level === 'medium' || level === 'default' };
    }

    return acc;
  }, emptyMap);
}

export function getDefaultVolumeOption(
  source: Source,
  settings: VolumeSettings,
  group?: string
): { label: string; volume: NotificationLevel } {
  const def = 'Use default setting';
  if ('base' in source) {
    return {
      label: def,
      volume: 'default',
    };
  }

  const base: NotificationLevel = settings.base
    ? getLevelFromVolumeMap(settings.base)
    : 'default';
  if ('group' in source || 'dm' in source) {
    return {
      label: def,
      volume: base,
    };
  }

  if ('channel' in source && group) {
    const groupVolume = settings[`group/${group}`];
    return {
      label: groupVolume ? 'Use group default' : def,
      volume: groupVolume ? getLevelFromVolumeMap(groupVolume) : base,
    };
  }

  if ('thread' in source) {
    const channelVolume = settings[`channel/${source.thread.channel}`];
    return channelVolume
      ? {
          label: 'Use channel default',
          volume: getLevelFromVolumeMap(channelVolume),
        }
      : getDefaultVolumeOption(
          {
            channel: {
              nest: source.thread.channel,
              group: source.thread.group,
            },
          },
          settings,
          group
        );
  }

  if ('dm-thread' in source) {
    const index = sourceToString({ dm: source['dm-thread'].whom });
    const dmVolume = settings[index];
    return dmVolume
      ? { label: 'Use DM default', volume: getLevelFromVolumeMap(dmVolume) }
      : getDefaultVolumeOption({ dm: source['dm-thread'].whom }, settings);
  }

  return {
    label: def,
    volume: 'default',
  };
}

export function stripSourcePrefix(source: string) {
  if (source === 'base') {
    return source;
  }

  return source.replace(/^[-\w]*\//, '');
}

export function stripPrefixes(unreads: Activity) {
  return _.mapKeys(unreads, (v, k) => stripSourcePrefix(k));
}

export function onlyChats(unreads: Activity) {
  return _.pickBy(
    unreads,
    (v, k) => k.startsWith('chat/') || whomIsDm(k) || whomIsMultiDm(k)
  );
}

export function getChannelSource(group: string, channel: string) {
  return { channel: { nest: channel, group } };
}

export function getDmSource(id: string) {
  return whomIsDm(id) ? { dm: { ship: id } } : { dm: { club: id } };
}

export function getKey(whom: string) {
  return whomIsFlag(whom)
    ? `channel/chat/${whom}`
    : whomIsDm(whom)
      ? `ship/${whom}`
      : `club/${whom}`;
}

export function getThreadKey(whom: string, id: string) {
  const prefix = whomIsFlag(whom) ? 'thread/chat' : 'dm-thread';
  return `${prefix}/${whom}/${id}`;
}

export const isMessage = (event: ActivityEvent) => {
  return (
    'post' in event ||
    'reply' in event ||
    'dm-post' in event ||
    'dm-reply' in event
  );
};

export const isNote = (event: ActivityEvent) => {
  if ('post' in event) {
    return event.post.channel.startsWith('diary');
  }

  return false;
};

export const isGalleryBlock = (event: ActivityEvent) => {
  if ('post' in event) {
    return event.post.channel.startsWith('heap');
  }

  return false;
};

export const isMention = (event: ActivityEvent) => {
  if ('post' in event) {
    return event.post.mention;
  }

  if ('reply' in event) {
    return event.reply.mention;
  }

  if ('dm-post' in event) {
    return event['dm-post'].mention;
  }

  if ('dm-reply' in event) {
    return event['dm-reply'].mention;
  }

  return false;
};

export const isComment = (event: ActivityEvent) => {
  if ('reply' in event) {
    return (
      event.reply.channel.startsWith('heap') ||
      event.reply.channel.startsWith('diary')
    );
  }

  return false;
};

export const isReply = (event: ActivityEvent) => {
  if ('dm-reply' in event) {
    return true;
  }

  if ('reply' in event) {
    return !isComment(event);
  }

  return false;
};

export const isAsk = (event: ActivityEvent) => 'group-ask' in event;

export const isInvite = (event: ActivityEvent) => 'group-invite' in event;

export const isJoin = (event: ActivityEvent) => 'group-join' in event;

export const isLeave = (event: ActivityEvent) => 'group-leave' in event;

export const isRoleChange = (event: ActivityEvent) => 'group-role' in event;

export const isGroupMeta = (event: ActivityEvent) =>
  isJoin(event) || isRoleChange(event) || isLeave(event);

export function getTop(bundle: ActivityBundle): ActivityEvent {
  return bundle.events.find(({ time }) => time === bundle.latest)!.event;
}

export function getSource(bundle: ActivityBundle): Source {
  const top = getTop(bundle);
  return getSourceForEvent(top);
}

export function getSourceForEvent(event: ActivityEvent): Source {
  if ('post' in event) {
    return { channel: { nest: event.post.channel, group: event.post.group } };
  }

  if ('reply' in event) {
    return {
      thread: {
        key: event.reply.parent,
        channel: event.reply.channel,
        group: event.reply.group,
      },
    };
  }

  if ('dm-invite' in event) {
    return { dm: event['dm-invite'] };
  }

  if ('dm-post' in event) {
    return { dm: event['dm-post'].whom };
  }

  if ('dm-reply' in event) {
    return {
      'dm-thread': {
        key: event['dm-reply'].parent,
        whom: event['dm-reply'].whom,
      },
    };
  }

  if ('group-ask' in event) {
    return { group: event['group-ask'].group };
  }

  if ('group-join' in event) {
    return { group: event['group-join'].group };
  }

  if ('group-role' in event) {
    return { group: event['group-role'].group };
  }

  if ('group-kick' in event) {
    return { group: event['group-kick'].group };
  }

  if ('group-invite' in event) {
    return { group: event['group-invite'].group };
  }

  if ('flag-post' in event) {
    return {
      group: event['flag-post'].group,
    };
  }

  if ('flag-reply' in event) {
    return {
      group: event['flag-reply'].group,
    };
  }

  return { base: null };
}

export function getContent(event: ActivityEvent) {
  if ('post' in event) {
    return event.post.content;
  }

  if ('reply' in event) {
    return event.reply.content;
  }

  if ('dm-post' in event) {
    return event['dm-post'].content;
  }

  if ('dm-reply' in event) {
    return event['dm-reply'].content;
  }

  return undefined;
}

export function getIdParts(id: string): { author: string; sent: number } {
  const [author, sentStr] = id.split('/');
  return {
    author,
    sent: da.toUnix(parseIdNumber(sentStr)),
  };
}

export function getAuthor(event: ActivityEvent) {
  if ('post' in event) {
    return getIdParts(event.post.key.id).author;
  }

  if ('reply' in event) {
    return getIdParts(event.reply.key.id).author;
  }

  if ('dm-post' in event) {
    return getIdParts(event['dm-post'].key.id).author;
  }

  if ('dm-reply' in event) {
    return getIdParts(event['dm-reply'].key.id).author;
  }

  if ('flag-post' in event) {
    return getIdParts(event['flag-post'].key.id).author;
  }

  if ('flag-reply' in event) {
    return getIdParts(event['flag-reply'].key.id).author;
  }

  if ('group-ask' in event) {
    return event['group-ask'].ship;
  }

  return undefined;
}

export function getChannelKind(event: PostEvent | ReplyEvent): Kind {
  const channel = 'post' in event ? event.post.channel : event.reply.channel;
  const [channelType] = nestToFlag(channel);
  return channelType;
}

export type ActivityRelevancy =
  | 'mention'
  | 'involvedThread'
  | 'replyToGalleryOrNote'
  | 'replyToChatPost'
  | 'dm'
  | 'groupchat'
  | 'postInYourChannel'
  | 'postToChannel'
  | 'groupMeta'
  | 'flaggedPost'
  | 'flaggedReply'
  | 'groupJoinRequest';

export function getRelevancy(
  event: ActivityEvent,
  us: string
): ActivityRelevancy {
  if (isMention(event)) {
    return 'mention';
  }

  if ('dm-post' in event && 'ship' in event['dm-post'].whom) {
    return 'dm';
  }

  if ('dm-post' in event && 'club' in event['dm-post'].whom) {
    return 'groupchat';
  }

  if ('reply' in event && event.reply.parent.id.includes(us)) {
    const channelType = getChannelKind(event);
    if (channelType === 'heap' || channelType === 'diary') {
      return 'replyToGalleryOrNote';
    }

    return 'replyToChatPost';
  }

  if ('post' in event && event.post.channel.includes(`/${us}/`)) {
    return 'postInYourChannel';
  }

  if ('reply' in event && event.notified) {
    return 'involvedThread';
  }

  if ('post' in event && event.notified) {
    return 'postToChannel';
  }

  if ('flag-post' in event) {
    return 'flaggedPost';
  }

  if ('flag-reply' in event) {
    return 'flaggedReply';
  }

  if ('group-ask' in event) {
    return 'groupJoinRequest';
  }

  console.log(
    'Unknown relevancy type for activity summary. Defaulting to involvedThread.',
    event
  );
  return 'involvedThread';
}

export namespace ActivityIncomingEvent {
  /**
   * Helper for building exhaustive checks:
   * ```ts
   * declare const event: ActivityIncomingEvent;
   * switch (true) {
   * case is(event, "dm-post"):
   *   // `event` is typed as `DmPostEvent`
   *   return event['dm-post'].content;
   *
   * // TS should complain about missing cases until you add all of them
   * }
   * ```
   */
  export function is<
    K extends keyof UnionToIntersection<ActivityIncomingEvent>,
  >(
    poly: ActivityIncomingEvent,
    type: K
  ): // @ts-expect-error - hey, I'm asserting here!
  poly is Pick<UnionToIntersection<ActivityIncomingEvent>, K> {
    return type in poly;
  }
}
