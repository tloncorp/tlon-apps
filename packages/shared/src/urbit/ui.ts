import { Activity } from './activity';
import { Channels } from './channel';
import { DMInit } from './dms';
import { Gangs, Groups } from './groups';

// v4
export interface GroupsInit {
  groups: Groups;
  gangs: Gangs;
  channel: {
    channels: Channels;
    ['hidden-posts']: string[];
  };
  activity: Activity;
  pins: string[];
  chat: DMInit;
}
