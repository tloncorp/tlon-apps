import { Story, UnreadPoint } from "./channel";

export type Whom = { ship: string } | { club: string };

export interface MessageKey {
  id: string;
  time: string;
}

export interface DmInviteEvent {
  'dm-invite': Whom;
}

export interface KickEvent {
  kick: {
    ship: string;
    group: string;
  };
}

export interface JoinEvent {
  join: {
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
  }
}

export interface DmReplyEvent {
  'dm-reply': {
    parent: MessageKey;
    key: MessageKey;
    whom: Whom;
    content: Story[];
    mention: boolean;
  }
}

export interface PostEvent {
  post: {
    key: MessageKey;
    group: string;
    channel: string;
    content: Story[];
    mention: boolean;
  }
}

export interface ReplyEvent {
  reply: {
    parent: MessageKey;
    key: MessageKey;
    group: string;
    channel: string;
    content: Story[];
    mention: boolean;
  }
}

export type ActivityEvent =
  | DmInviteEvent
  | KickEvent
  | JoinEvent
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

export interface Index {
  stream: Stream;
  reads: Reads;
}

export interface ThreadUnread {
  last: string;
  count: number;
}

export interface Unread {
  recency: number;
  count: number;
  unread: UnreadPoint | null;
  threads: Record<string, UnreadPoint>;
}

export type Unreads = Record<string, Unread>;

export type Indices = Record<string, Index>;

export type Stream = Record<string, ActivityEvent>;

export interface FullActivity {
  stream: Stream;
  indices: Indices;
  unreads: Unreads;
}