import { ChatBriefs, ChatInit, Chats, Clubs } from './chat';
import { Groups, Gangs } from './groups';

export interface GroupsInit {
  groups: Groups;
  gangs: Gangs;
  chat: ChatInit;
}

export interface TalkInit {
  groups: Groups;
  gangs: Gangs;
  briefs: ChatBriefs;
  chats: Chats;
  clubs: Clubs;
  dms: string[];
  invited: string[];
  pins: string[];
}
