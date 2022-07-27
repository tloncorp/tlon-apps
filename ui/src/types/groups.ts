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
  added: number;
  meta: GroupMeta;
  zone: Zone | null;
  readers: string[];
  join: boolean;
}

export type Zone = string;

export interface Zones {
  [key: Zone]: GroupMeta;
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
  zones: Zones;
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

interface ChannelDiffAddZone {
  'add-zone': string;
}

interface ChannelDiffDelZone {
  'del-zone': null;
}

interface ChannelDiffAddSects {
  'add-sects': string[];
}

interface ChannelDiffDelSects {
  'del-sects': string[];
}

interface ChannelDiffJoin {
  join: boolean;
}

interface ChannelDiff {
  channel: {
    flag: string;
    diff:
      | ChannelDiffAdd
      | ChannelDiffDel
      | ChannelDiffAddZone
      | ChannelDiffDelZone
      | ChannelDiffAddSects
      | ChannelDiffDelSects
      | ChannelDiffJoin;
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

interface ZoneAdd {
  zone: Zone;
  delta: { add: GroupMeta };
}

interface ZoneDelete {
  zone: Zone;
  delta: { del: null };
}

interface ZoneDiff {
  zone: ZoneAdd | ZoneDelete;
}

export interface MetaDiff {
  meta: GroupMeta;
}

export interface GroupCreateDiff {
  create: Group;
}

export interface GroupDelDiff {
  del: null;
}

// TODO: elaborate
export type GroupDiff =
  | GroupDelDiff
  | GroupCreateDiff
  | MetaDiff
  | FleetDiff
  | CabalDiff
  | ChannelDiff
  | CordonDiff
  | ZoneDiff;

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
  time: number;
}

export interface GroupIndex {
  [flag: string]: GroupPreview;
}

export interface Invite {
  flag: string;
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

export type PrivacyType = 'public' | 'private' | 'secret';

export type ChannelPrivacyType = 'public' | 'read-only' | 'secret';

export interface GroupFormSchema extends GroupMeta {
  privacy: PrivacyType;
}

export interface ChannelFormSchema extends Channel {
  privacy: ChannelPrivacyType;
}
