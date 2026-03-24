import { Activity } from './activity';
import { ChannelHeadsResponse, Channels, Posts } from './channel';
import { ContactBookEntry } from './contact';
import { ChatHeadsResponse, DMInit2, Writs } from './dms';
import { Foreigns, GroupV7, Groups, GroupsV7 } from './groups';

export interface GroupsInit7 {
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

export type GroupsInit6 = GroupsInit7;

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

export interface ChangesV8 {
  groups: GroupsV7;
  channels: Record<string, Posts | null>;
  chat: Record<string, Writs | null>;
  contacts: Record<string, ContactBookEntry>;
  activity: Activity;
}

export type ChangesV7 = ChangesV8;

export interface PostsInit {
  channels: Record<string, Posts | null>;
  chat: Record<string, Writs | null>;
}
