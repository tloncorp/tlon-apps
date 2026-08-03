import { Activity } from './activity';
import { ChannelHeadsResponse, Channels, Posts } from './channel';
import { ContactBookEntry } from './contact';
import { ChatHeadsResponse, DMInit2, Writs } from './dms';
import { Foreigns, GroupV7, Groups, GroupsV7 } from './groups';

// v9 init is v7 plus the group blob, which rides along inside GroupV7.
export interface GroupsInit9 {
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

export type GroupsInit7 = GroupsInit9;
export type GroupsInit6 = GroupsInit9;

export interface CombinedHeads {
  dms: ChatHeadsResponse;
  channels: ChannelHeadsResponse;
}

export interface Changes {
  groups: Groups;
  channels: Record<string, Posts | null>;
  chat: Record<string, Writs | null>;
  contacts: Record<string, ContactBookEntry>;
  activity: Activity;
}

// v10 changes is v8 plus the group blob, which rides along inside GroupV7.
export interface ChangesV10 {
  groups: GroupsV7;
  channels: Record<string, Posts | null>;
  chat: Record<string, Writs | null>;
  contacts: Record<string, ContactBookEntry>;
  activity: Activity;
}

export type ChangesV8 = ChangesV10;
export type ChangesV7 = ChangesV10;

export interface PostsInit {
  channels: Record<string, Posts | null>;
  chat: Record<string, Writs | null>;
}
