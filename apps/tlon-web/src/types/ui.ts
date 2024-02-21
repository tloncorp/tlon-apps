import { Channels, Unreads } from './channel';
import { DMInit } from './dms';
import { Gangs, Groups } from './groups';

export interface GroupsInit {
  groups: Groups;
  gangs: Gangs;
  channels: Channels;
  unreads: Unreads;
  pins: string[];
  chat: DMInit;
}
