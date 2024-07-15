import { Activity } from './activity';
import { Channels } from './channel';
import { DMInit, DMInit2 } from './dms';
import { Gangs, Groups } from './groups';

export interface GroupsInit {
  groups: Groups;
  gangs: Gangs;
  channels: Channels;
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
