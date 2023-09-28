import { Briefs, Channels } from './channel';
import { DMBriefs, Clubs } from './dms';
import { Groups, Gangs } from './groups';

export interface GroupsInit {
  groups: Groups;
  gangs: Gangs;
  channels: Channels;
  briefs: Briefs;
  pins: string[];
}

export interface TalkInit {
  groups: Groups;
  gangs: Gangs;
  briefs: DMBriefs;
  clubs: Clubs;
  dms: string[];
  invited: string[];
  pins: string[];
}
