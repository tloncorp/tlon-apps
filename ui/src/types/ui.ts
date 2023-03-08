import { ChatInit } from './chat';
import { DiaryInit } from './diary';
import { Groups, Gangs } from './groups';
import { HeapInit } from './heap';

export interface Init {
  groups: Groups;
  gangs: Gangs;
  chat: ChatInit;
  heap: HeapInit;
  diary: DiaryInit;
}
