export interface GroupMeta {
  title: string;
  description: string;
  image: string;
}

export interface Cabal {
  meta: GroupMeta;
}

export interface Channel {
  meta: GroupMeta;
}

export interface Vessel {
  sects: string[];
  joined: number;
}

export interface Group {
  fleet: {
    [ship: string]: Vessel;
  };
  cabals: {
    [sect: string]: Cabal;
  };
  channels: {
    [flag: string]: Channel;
  };
  cordon: unknown;
  meta: GroupMeta;
}

interface FleetDiffAdd {
  add: Vessel;
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

interface FleetDiff {
  fleet: {
    ship: string;
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
interface OpenCordon {
  open: {
    ships: string[];
    ranks: string[];
  };
}

interface ShutCordon {
  shut: string[];
}

type Cordon = OpenCordon | ShutCordon;

interface CordonDiff {
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
