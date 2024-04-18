import { Story } from './channel';

export type Whom = { ship: string } | { club: string };

export type Volume = 'hush' | 'soft' | 'default' | 'loud';

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

export type Source = { channel: string } | { dm: Whom };

export interface MessageKey {
  id: string;
  time: string;
}

export interface UnreadPoint extends MessageKey {
  count: number;
}

export interface UnreadThread extends UnreadPoint {
  'parent-time': string;
}

export interface Unread {
  recency: number;
  count: number;
  unread: UnreadPoint | null;
  threads: Record<string, UnreadThread>;
}

export type Unreads = Record<string, Unread>;

export type Indices = Record<string, IndexData>;

export type Stream = Record<string, ActivityEvent>;

export type ReadAction = { post: string } | { thread: string } | { all: null };

export interface ActivityReadAction {
  source: Source;
  action: ReadAction;
}

export interface ActivityVolumeAction {
  source: Source;
  volume: Volume;
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
    volume: Volume;
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
  stream: Stream;
  indices: Indices;
  unreads: Unreads;
}
