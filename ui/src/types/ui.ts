import { Unreads, Channels } from './channel';
import { DMUnreads, Clubs } from './dms';
import { Groups, Gangs } from './groups';

export interface GroupsInit {
  groups: Groups;
  gangs: Gangs;
  channels: Channels;
  unreads: Unreads;
  pins: string[];
}

export interface TalkInit {
  groups: Groups;
  gangs: Gangs;
  unreads: DMUnreads;
  clubs: Clubs;
  dms: string[];
  invited: string[];
  pins: string[];
}
