import { Unreads, Channels } from './channel';
import { DMInit } from './dms';
import { Groups, Gangs } from './groups';

export interface GroupsInit extends DMInit {
  groups: Groups;
  gangs: Gangs;
  channels: Channels;
  unreads: Unreads;
  pins: string[];
}
