import _ from 'lodash';

import { Story } from './channel';
import { whomIsDm, whomIsFlag, whomIsMultiDm } from './utils';

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
  | 'flag-reply';

export type NotificationLevel = 'hush' | 'soft' | 'default' | 'medium' | 'loud';

export enum NotificationNames {
  loud = 'Notify for all activity',
  default = 'Posts, mentions and replies',
  medium = 'Posts, mentions and replies ',
  soft = 'Only mentions and replies',
  hush = 'Do not notify for any activity',
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

export interface GroupJoinEvent {
  'group-join': {
    ship: string;
    group: string;
  };
}

export interface FlagEvent {
  flag: {
    key: MessageKey;
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

export type ActivityIncomingEvent =
  | DmInviteEvent
  | GroupKickEvent
  | GroupJoinEvent
  | FlagEvent
  | DmPostEvent
  | DmReplyEvent
  | PostEvent
  | ReplyEvent;

export type ActivityEvent = {
  notified: boolean;
} & ActivityIncomingEvent;

export interface PostRead {
  seen: boolean;
  floor: string;
}

export interface Reads {
  floor: string;
  posts: Record<string, PostRead>;
}

export interface IndexData {
  stream: Stream;
  reads: Reads;
}

export type Source =
  | { dm: Whom }
  | { base: null }
  | { group: string }
  | { channel: { nest: string; group: string } }
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
  children: Activity | null;
  reads: Reads | null;
}

export interface ActivityBundle {
  source: Source;
  latest: string;
  events: { event: ActivityEvent; time: string }[];
  'source-key': string;
}

export type ActivityFeed = ActivityBundle[];
export type InitActivityFeeds = {
  all: ActivityBundle[];
  mentions: ActivityBundle[];
  replies: ActivityBundle[];
};

export type Activity = Record<string, ActivitySummary>;

export type Indices = Record<string, IndexData>;

export type Stream = Record<string, ActivityEvent>;

export type VolumeMap = Partial<Record<ExtendedEventType, Volume>>;

export type ReadAction =
  | { event: ActivityIncomingEvent }
  | { item: string }
  | { all: null };

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
  | { 'allow-notifications': PushNotificationsSetting };

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
  if ('base' in source) {
    return stripPrefix ? '' : 'base';
  }

  if ('group' in source) {
    return stripPrefix ? source.group : `group/${source.group}`;
  }

  if ('channel' in source) {
    return stripPrefix ? source.channel.nest : `channel/${source.channel.nest}`;
  }

  if ('dm' in source) {
    if ('ship' in source.dm) {
      return stripPrefix ? source.dm.ship : `ship/${source.dm.ship}`;
    }

    return stripPrefix ? source.dm.club : `club/${source.dm.club}`;
  }

  if ('thread' in source) {
    const key = `${source.thread.channel}/${source.thread.key.time}`;
    return stripPrefix ? key : `thread/${key}`;
  }

  if ('dm-thread' in source) {
    const prefix = sourceToString({ dm: source['dm-thread'].whom }, true);
    const key = `${prefix}/${source['dm-thread'].key.id}`;
    return stripPrefix ? key : `dm-thread/${key}`;
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
  return source.replace(/^[-\w]*\//, '');
}

export function stripPrefixes(unreads: Activity) {
  return _.mapKeys(unreads, (v, k) => stripSourcePrefix);
}

export function onlyChats(unreads: Activity) {
  return _.pickBy(
    unreads,
    (v, k) => k.startsWith('chat/') || whomIsDm(k) || whomIsMultiDm(k)
  );
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
