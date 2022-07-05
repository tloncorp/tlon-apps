export const allRanks = ['czar', 'king', 'duke', 'earl', 'pawn'] as const;
export type Rank = typeof allRanks[number];

export interface GroupMeta {
  title: string;
  description: string;
  image: string;
  color: string;
}

export interface Cabal {
  meta: GroupMeta;
}

export interface Cabals {
  [sect: string]: Cabal;
}

export interface Channel {
  meta: GroupMeta;
}

export interface Vessel {
  sects: string[];
  joined: number;
}

export interface OpenCordon {
  open: {
    ships: string[];
    ranks: string[];
  };
}

export interface ShutCordon {
  shut: string[];
}

export interface AfarCordon {
  afar: {
    app: string;
    path: string;
    desc: string;
  };
}

export type Cordon = OpenCordon | ShutCordon | AfarCordon;

export interface Group {
  fleet: Fleet;
  cabals: Cabals;
  channels: {
    [flag: string]: Channel;
  };
  cordon: Cordon;
  meta: GroupMeta;
}

export interface Fleet {
  [ship: string]: Vessel;
}

interface FleetDiffAdd {
  add: null;
}
interface FleetDiffDel {
  del: null;
}

interface FleetDiffAddSects {
  'add-sects': string[];
}

interface FleetDiffDelSects {
  'del-sects': string[];
}

export interface FleetDiff {
  fleet: {
    ships: string[];
    diff: FleetDiffAdd | FleetDiffDel | FleetDiffAddSects | FleetDiffDelSects;
  };
}

interface CabalDiffAdd {
  add: GroupMeta;
}

interface CabalDiffDel {
  del: null;
}

interface CabalDiff {
  cabal: {
    sect: string;
    diff: CabalDiffAdd | CabalDiffDel;
  };
}

interface ChannelDiffAdd {
  add: Channel;
}
interface ChannelDiffDel {
  del: null;
}

interface ChannelDiff {
  channel: {
    flag: string;
    diff: ChannelDiffAdd | ChannelDiffDel;
  };
}

interface CordonDiffOpenAddShips {
  'add-ships': string[];
}

interface CordonDiffOpenDelShips {
  'del-ships': string[];
}

interface CordonDiffOpenAddRanks {
  'add-ranks': string[];
}
interface CordonDiffOpenDelRanks {
  'del-ranks': string[];
}

interface CordonDiffOpen {
  open:
    | CordonDiffOpenAddShips
    | CordonDiffOpenDelShips
    | CordonDiffOpenAddRanks
    | CordonDiffOpenDelRanks;
}

interface CordonDiffShutAddShips {
  'add-ships': string[];
}

interface CordonDiffShutDelShips {
  'del-ships': string[];
}

interface CordonDiffShut {
  shut: CordonDiffShutAddShips | CordonDiffShutDelShips;
}

export interface CordonDiff {
  cordon: CordonDiffShut | CordonDiffOpen | { swap: Cordon };
}

export interface GroupCreateDiff {
  create: Group;
}
// TODO: elaborate
export type GroupDiff =
  | GroupCreateDiff
  | FleetDiff
  | CabalDiff
  | ChannelDiff
  | CordonDiff;

export interface GroupUpdate {
  time: string;
  diff: GroupDiff;
}

export interface GroupAction {
  flag: string;
  update: GroupUpdate;
}

export interface Groups {
  [flag: string]: Group;
}

export interface GroupPreview {
  meta: GroupMeta;
  cordon: Cordon;
}

export interface Invite {
  text: string;
  ship: string;
}

export type JoinProgress = 'adding' | 'watching' | 'done' | 'error';

interface GroupClaim {
  progress: JoinProgress;
  'join-all': boolean;
}

export interface Gang {
  preview: GroupPreview | null;
  invite: Invite | null;
  claim: GroupClaim | null;
}

export interface Gangs {
  [flag: string]: Gang;
}

export interface NewGroupFormSchema {
  title: string;
  description: string;
  image: string;
  color: string;
}
