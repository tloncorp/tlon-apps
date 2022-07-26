import {
  Gangs,
  Group,
  Rank,
  GroupMeta,
  Channel,
  GroupIndex,
} from '../../types/groups';

export interface GroupState {
  set: (fn: (sta: GroupState) => void) => void;
  batchSet: (fn: (sta: GroupState) => void) => void;
  initialized: boolean;
  groups: {
    [flag: string]: Group;
  };
  pinnedGroups: string[];
  pinGroup: (flag: string) => Promise<void>;
  unpinGroup: (flag: string) => Promise<void>;
  gangs: Gangs;
  initialize: (flag: string) => Promise<number>;
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
  }) => Promise<void>;
  leave: (flag: string) => Promise<void>;
  edit: (flag: string, metadata: GroupMeta) => Promise<void>;
  delete: (flag: string) => Promise<void>;
  start: () => Promise<void>;
  search: (flag: string) => Promise<void>;
  index: (ship: string) => Promise<GroupIndex>;
  join: (flag: string, joinAll: boolean) => Promise<void>;
  createZone: (flag: string, zone: string, meta: GroupMeta) => Promise<void>;
  deleteZone: (flag: string, zone: string) => Promise<void>;
  addOrEditChannel: (
    groupFlag: string,
    flag: string,
    channel: Channel
  ) => Promise<void>;
  deleteChannel: (groupFlag: string, flag: string) => Promise<void>;
  addChannelToZone: (
    zone: string,
    groupFlag: string,
    channelFlag: string
  ) => Promise<void>;
  removeChannelFromZone: (
    groupFlag: string,
    channelFlag: string
  ) => Promise<void>;
  setChannelPerm: (
    flag: string,
    channelFlag: string,
    sects: string[]
  ) => Promise<void>;
  setChannelJoin: (
    flag: string,
    channelFlag: string,
    join: boolean
  ) => Promise<void>;
}
