import { ChatBriefs, ChatInit, Chats, Clubs } from './chat';
import { DiaryInit } from './diary';
import { Groups, Gangs } from './groups';
import { HeapInit } from './heap';

export interface GroupsInit {
  groups: Groups;
  gangs: Gangs;
  chat: ChatInit;
  heap: HeapInit;
  diary: DiaryInit;
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
