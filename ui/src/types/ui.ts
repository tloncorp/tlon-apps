import { Unreads, Channels } from './channel';
import { DMInit } from './dms';
import { Groups, Gangs } from './groups';

export interface GroupsInit {
  groups: Groups;
  gangs: Gangs;
  channels: Channels;
  unreads: Unreads;
  pins: string[];
  chat: DMInit;
}
