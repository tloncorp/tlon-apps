import { Briefs, Shelf } from './channel';
import { ChatBriefs, Clubs } from './chat';
import { Groups, Gangs } from './groups';

export interface GroupsInit {
  groups: Groups;
  gangs: Gangs;
  shelf: Shelf;
  briefs: Briefs;
  pins: string[];
}

export interface TalkInit {
  groups: Groups;
  gangs: Gangs;
  briefs: ChatBriefs;
  clubs: Clubs;
  dms: string[];
  invited: string[];
  pins: string[];
}
