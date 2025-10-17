import { Activity } from './activity';
import { ChannelHeadsResponse, Channels, Posts } from './channel';
import { ContactBookProfile } from './contact';
import { ChatHeadsResponse, DMInit, DMInit2, Writs } from './dms';
import { Foreigns, ForeignsV8, Gangs, GroupV7, Groups } from './groups';

// v4
export interface GroupsInit {
  groups: Groups;
  gangs: Gangs;
  channel: Channels;
  activity: Activity;
  pins: string[];
  chat: DMInit;
}

export interface GroupsInit4 {
  groups: Groups;
  gangs: Gangs;
  channel: {
    channels: Channels;
    'hidden-posts': string[];
  };
  activity: Activity;
  pins: string[];
  chat: DMInit2;
}

export interface GroupsInit5 {
  groups: Record<string, GroupV7>;
  foreigns: Foreigns;
  channel: {
    channels: Channels;
    'hidden-posts': string[];
  };
  activity: Activity;
  pins: string[];
  chat: DMInit2;
}

// v6 - adds v8 foreigns with invite revocation support (PR #5138)
export interface GroupsInit6 {
  groups: Record<string, GroupV7>;
  foreigns: ForeignsV8; // v8 foreigns with valid field on invites
  channel: {
    channels: Channels;
    'hidden-posts': string[];
  };
  activity: Activity;
  pins: string[];
  chat: DMInit2;
}

export interface CombinedHeads {
  dms: ChatHeadsResponse;
  channels: ChannelHeadsResponse;
}

export interface Changes {
  groups: Groups;
  channels: Record<string, Posts | null>;
  chat: Record<string, Writs | null>;
  contacts: Record<string, ContactBookProfile>;
  activity: Activity;
}

export interface PostsInit {
  channels: Record<string, Posts | null>;
  chat: Record<string, Writs | null>;
}
