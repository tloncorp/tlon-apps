import { Activity } from './activity';
import { Channels } from './channel';
import { DMInit } from './dms';
import { Gangs, Groups } from './groups';

export interface GroupsInit {
  groups: Groups;
  gangs: Gangs;
  channels: Channels;
  activity: Activity;
  pins: string[];
  chat: DMInit;
}
