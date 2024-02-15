import { BaitCite } from '@/types/channel';
import { GroupsInit } from '@/types/ui';
import { GroupMeta } from '@tloncorp/shared';

import {
  ChannelPreview,
  Cordon,
  Gangs,
  Group,
  GroupChannel,
  GroupIndex,
  Rank,
} from '../../types/groups';

export interface GroupState {
  set: (fn: (sta: GroupState) => void) => void;
  batchSet: (fn: (sta: GroupState) => void) => void;
  initialized: boolean;
  channelPreviews: {
    [nest: string]: ChannelPreview;
  };
  groups: {
    [flag: string]: Group;
  };
  shoal: {
    [flag: string]: string | null;
  };
  fetchShoal: (b: BaitCite['bait']) => Promise<string | null>;
  gangs: Gangs;
  initialize: (flag: string, getMembers?: boolean) => Promise<number>;
  delRole: (flag: string, sect: string) => Promise<void>;
  banShips: (flag: string, ships: string[]) => Promise<void>;
  unbanShips: (flag: string, ships: string[]) => Promise<void>;
  banRanks: (flag: string, ranks: Rank[]) => Promise<void>;
  unbanRanks: (flag: string, ranks: Rank[]) => Promise<void>;
  addMembers: (flag: string, ships: string[]) => Promise<void>;
  delMembers: (flag: string, ships: string[]) => Promise<void>;
  addSects: (flag: string, ship: string, sects: string[]) => Promise<void>;
  delSects: (flag: string, ship: string, sects: string[]) => Promise<void>;
  addRole: (
    flag: string,
    sect: string,
    values: {
      title: string;
      description: string;
    }
  ) => Promise<void>;
  create: (req: {
    name: string;
    title: string;
    description: string;
    members: Record<string, string[]>;
    cordon: Record<string, any>;
    secret: boolean;
  }) => Promise<void>;
  leave: (flag: string) => Promise<void>;
  edit: (flag: string, metadata: GroupMeta) => Promise<void>;
  delete: (flag: string) => Promise<void>;
  updateGroups: () => Promise<void>;
  start: (init: Pick<GroupsInit, 'groups' | 'gangs'>) => Promise<void>;
  channelPreview: (nest: string) => Promise<void>;
  search: (flag: string) => Promise<void>;
  index: (ship: string) => Promise<GroupIndex>;
  join: (flag: string, joinAll: boolean) => Promise<void>;
  knock: (flag: string) => Promise<void>;
  rescind: (flag: string) => Promise<void>;
  invite: (flag: string, ships: string[]) => Promise<void>;
  revoke: (
    flag: string,
    ships: string[],
    kind: 'ask' | 'pending'
  ) => Promise<void>;
  reject: (flag: string) => Promise<void>;
  swapCordon: (flag: string, cordon: Cordon) => Promise<void>;
  setSecret: (flag: string, isSecret: boolean) => Promise<void>;
  cancel: (flag: string) => Promise<void>;
  createZone: (flag: string, zone: string, meta: GroupMeta) => Promise<void>;
  editZone: (flag: string, zone: string, meta: GroupMeta) => Promise<void>;
  moveZone: (flag: string, zone: string, index: number) => Promise<void>;
  deleteZone: (flag: string, zone: string) => Promise<void>;
  editChannel: (
    groupFlag: string,
    flag: string,
    channel: GroupChannel
  ) => Promise<void>;
  deleteChannel: (groupFlag: string, flag: string) => Promise<void>;
  addChannelToZone: (
    zone: string,
    groupFlag: string,
    nest: string
  ) => Promise<void>;
  moveChannel: (
    flag: string,
    zone: string,
    channelFlag: string,
    index: number
  ) => Promise<void>;
  setChannelPerm: (
    flag: string,
    nest: string,
    sects: string[]
  ) => Promise<void>;
  setChannelJoin: (flag: string, nest: string, join: boolean) => Promise<void>;
}
