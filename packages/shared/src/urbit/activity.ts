import _ from 'lodash';

import { Story } from './channel';
import { whomIsDm, whomIsMultiDm } from './utils';

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

export type VolumeLevel = 'hush' | 'soft' | 'medium' | 'default' | 'loud';

export enum VolumeNames {
  loud = 'Notify for all activity',
  default = 'Posts, mentions and replies',
  medium = 'Only mentions and replies',
  soft = 'Only show unread activity, but do not notify',
  hush = 'Hide all unread activity and do not notify',
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
    content: Story[];
    mention: boolean;
  };
}

export interface DmReplyEvent {
  'dm-reply': {
    parent: MessageKey;
    key: MessageKey;
    whom: Whom;
    content: Story[];
    mention: boolean;
  };
}

export interface PostEvent {
  post: {
    key: MessageKey;
    group: string;
    channel: string;
    content: Story[];
    mention: boolean;
  };
}

export interface ReplyEvent {
  reply: {
    parent: MessageKey;
    key: MessageKey;
    group: string;
    channel: string;
    content: Story[];
    mention: boolean;
  };
}

export type ActivityEvent =
  | DmInviteEvent
  | GroupKickEvent
  | GroupJoinEvent
  | FlagEvent
  | DmPostEvent
  | DmReplyEvent
  | PostEvent
  | ReplyEvent;

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

export interface Unread {
  recency: number;
  count: number;
  notify: boolean;
  unread: UnreadPoint | null;
  children: string[];
}

export type Unreads = Record<string, Unread>;

export type Indices = Record<string, IndexData>;

export type Stream = Record<string, ActivityEvent>;

export type VolumeMap = Partial<Record<ExtendedEventType, Volume>>;

export type ReadAction = { post: string } | { all: null };

export interface ActivityReadAction {
  source: Source;
  action: ReadAction;
}

export interface ActivityVolumeAction {
  source: Source;
  volume: VolumeMap;
}

export type ActivityAction =
  | { add: ActivityEvent }
  | { read: ActivityReadAction }
  | { adjust: ActivityVolumeAction };

export interface ActivityReadUpdate {
  read: {
    source: Source;
    unread: Unread;
  };
}

export interface ActivityVolumeUpdate {
  adjust: {
    source: Source;
    volume: VolumeMap;
  };
}

export interface ActivityAddUpdate {
  add: {
    time: string;
    event: ActivityEvent;
  };
}

export type ActivityUpdate =
  | ActivityReadUpdate
  | ActivityVolumeUpdate
  | ActivityAddUpdate;

export interface FullActivity {
  indices: Indices;
  unreads: Unreads;
}

export type VolumeSettings = Record<string, VolumeMap>;

export function sourceToString(source: Source, stripPrefix = false): string {
  if ('base' in source) {
    return stripPrefix ? '' : 'base';
  }

  if ('group' in source) {
    return stripPrefix ? source.group : `group/${source.group}`;
  }

  if ('channel' in source) {
    return stripPrefix ? source.channel.nest : `channel/${source.channel}`;
  }

  if ('dm' in source) {
    if ('ship' in source.dm) {
      return stripPrefix ? source.dm.ship : `ship/${source.dm.ship}`;
    }

    return stripPrefix ? source.dm.club : `club/${source.dm.club}`;
  }

  if ('thread' in source) {
    const key = `${source.thread.channel}/${source.thread.key.id}`;
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

export function getLevelFromVolumeMap(vmap: VolumeMap): VolumeLevel {
  const entries = Object.entries(vmap) as [ExtendedEventType, Volume][];
  if (_.every(entries, ([, v]) => v.unreads && v.notify)) {
    return 'loud';
  }

  if (_.every(entries, ([, v]) => !v.unreads && !v.notify)) {
    return 'hush';
  }

  if (_.every(entries, ([, v]) => v.unreads && !v.notify)) {
    return 'soft';
  }

  let isDefault = true;
  entries.forEach(([k, v]) => {
    if (onEvents.concat('post').includes(k) && (!v.unreads || !v.notify)) {
      isDefault = false;
    }

    if (notifyOffEvents.includes(k) && v.notify) {
      isDefault = false;
    }
  });

  if (isDefault) {
    return 'default';
  }

  return 'medium';
}

export function getVolumeMapFromLevel(level: VolumeLevel): VolumeMap {
  const emptyMap: VolumeMap = {};
  if (level === 'loud') {
    return allEvents.reduce((acc, e) => {
      acc[e] = { unreads: true, notify: true };
      return acc;
    }, emptyMap);
  }

  if (level === 'hush') {
    return allEvents.reduce((acc, e) => {
      acc[e] = { unreads: false, notify: false };
      return acc;
    }, {} as VolumeMap);
  }

  if (level === 'soft') {
    return allEvents.reduce((acc, e) => {
      acc[e] = { unreads: true, notify: false };
      return acc;
    }, {} as VolumeMap);
  }

  return allEvents.reduce((acc, e) => {
    if (onEvents.includes(e)) {
      acc[e] = { unreads: true, notify: true };
    }

    if (notifyOffEvents.includes(e)) {
      acc[e] = { unreads: true, notify: false };
    }

    if (e === 'post') {
      acc[e] = { unreads: true, notify: level === 'default' };
    }

    return acc;
  }, emptyMap);
}

export function getDefaultVolumeOption(
  source: Source,
  settings: VolumeSettings,
  group?: string
): { label: string; volume: VolumeLevel } {
  const def = 'Use default setting';
  if ('base' in source) {
    return {
      label: def,
      volume: 'default',
    };
  }

  const base: VolumeLevel = settings.base
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

export function stripPrefixes(unreads: Unreads) {
  return _.mapKeys(unreads, (v, k) => k.replace(/^\w*\//, ''));
}

export function onlyChats(unreads: Unreads) {
  return _.pickBy(
    unreads,
    (v, k) => k.startsWith('chat/') || whomIsDm(k) || whomIsMultiDm(k)
  );
}
