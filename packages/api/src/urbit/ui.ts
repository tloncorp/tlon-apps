import { Activity } from './activity';
import { ChannelHeadsResponse, Channels, Posts } from './channel';
import { ContactBookEntry } from './contact';
import { ChatHeadsResponse, DMInit2, Writs } from './dms';
import { Foreigns, GroupV11, Groups, GroupsV11 } from './groups';

export interface GroupsInit10 {
  groups: Record<string, GroupV11>;
  foreigns: Foreigns;
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
  contacts: Record<string, ContactBookEntry>;
  activity: Activity;
}

export interface ChangesV11 {
  groups: GroupsV11;
  channels: Record<string, Posts | null>;
  chat: Record<string, Writs | null>;
  contacts: Record<string, ContactBookEntry>;
  activity: Activity;
}

export interface PostsInit {
  channels: Record<string, Posts | null>;
  chat: Record<string, Writs | null>;
}
