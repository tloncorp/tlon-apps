export const allRanks = ['czar', 'king', 'duke', 'earl', 'pawn'] as const;
export type Rank = typeof allRanks[number];

export interface ViewProps {
  title?: string;
}

export interface GroupMeta {
  title: string;
  description: string;
  image: string;
  cover: string;
}

export interface Cabal {
  meta: GroupMeta;
}

export interface Cabals {
  [sect: string]: Cabal;
}

export interface GroupChannel {
  added: number;
  meta: GroupMeta;
  zone: Zone;
  readers: string[];
  join: boolean;
}

export interface Channels {
  [nest: string]: GroupChannel;
}

export type Zone = string;

export interface Zones {
  [key: Zone]: {
    meta: GroupMeta;
    idx: string[];
  };
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
  shut: {
    pending: string[];
    ask: string[];
  };
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
  channels: Channels;
  cordon: Cordon;
  meta: GroupMeta;
  zones: Zones;
  'zone-ord': Zone[];
  bloc: string[];
  secret: boolean;
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

interface CabalDiffEdit {
  edit: GroupMeta;
}

interface CabalDiffDel {
  del: null;
}

interface CabalDiff {
  cabal: {
    sect: string;
    diff: CabalDiffAdd | CabalDiffEdit | CabalDiffDel;
  };
}

interface ChannelDiffAdd {
  add: GroupChannel;
}

interface ChannelDiffEdit {
  edit: GroupChannel;
}

interface ChannelDiffDel {
  del: null;
}

interface ChannelDiffAddZone {
  zone: string;
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
    nest: string;
    diff:
      | ChannelDiffAdd
      | ChannelDiffEdit
      | ChannelDiffDel
      | ChannelDiffAddZone
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

type CordonDiffShutKind = 'ask' | 'pending';

interface CordonDiffShutAddShips {
  'add-ships': {
    kind: CordonDiffShutKind;
    ships: string[];
  };
}

interface CordonDiffShutDelShips {
  'del-ships': {
    kind: CordonDiffShutKind;
    ships: string[];
  };
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

interface ZoneEdit {
  zone: Zone;
  delta: { edit: GroupMeta };
}

interface ZoneMoveChannel {
  zone: Zone;
  delta: {
    'mov-nest': {
      nest: string;
      idx: number;
    };
  };
}

interface MoveZone {
  zone: Zone;
  delta: {
    mov: number;
  };
}

interface ZoneDelete {
  zone: Zone;
  delta: { del: null };
}

interface ZoneDiff {
  zone: ZoneAdd | ZoneDelete | ZoneEdit | ZoneMoveChannel | MoveZone;
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

export interface SecretDiff {
  secret: boolean;
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
  | SecretDiff
  | ZoneDiff;

export interface GroupUpdate {
  time: string;
  diff: GroupDiff;
}

export interface GroupAction {
  flag: string;
  update: GroupUpdate;
}

export interface GroupCreate extends GroupMeta {
  name: string;
  cordon: Cordon;
  members: Record<string, string[]>;
  secret: boolean;
}

export interface GroupJoin {
  flag: string;
  'join-all': boolean;
}

export interface Groups {
  [flag: string]: Group;
}

export interface GroupPreview {
  flag: string;
  meta: GroupMeta;
  cordon: Cordon;
  time?: number;
  secret: boolean;
}

export interface GroupIndex {
  [flag: string]: GroupPreview;
}

export interface Invite {
  flag: string;
  ship: string;
}

export type JoinProgress =
  | 'knocking'
  | 'adding'
  | 'watching'
  | 'done'
  | 'error';

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

export type ChannelPrivacyType = 'public' | 'custom';

export type ChannelType = 'chat' | 'heap' | 'diary';

export interface GroupFormSchema extends GroupMeta {
  privacy: PrivacyType;
}

export interface ChannelFormSchema extends GroupChannel {
  privacy: ChannelPrivacyType;
  writers: string[];
}

export interface NewChannelFormSchema extends ChannelFormSchema {
  type: ChannelType;
}

export interface ChannelPreview {
  nest: string;
  meta: GroupMeta;
  group: GroupPreview;
}
