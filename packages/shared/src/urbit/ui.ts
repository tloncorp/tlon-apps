import { Activity } from './activity';
import { ChannelHeadsResponse, Channels } from './channel';
import { ChatHeadsResponse, DMInit, DMInit2 } from './dms';
import { Gangs, Groups } from './groups';

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

export interface CombinedHeads {
  dms: ChatHeadsResponse;
  channels: ChannelHeadsResponse;
}
