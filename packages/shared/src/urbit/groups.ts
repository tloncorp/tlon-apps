import { Story } from './channel';
import { Metadata } from './meta';

export const allRanks = ['czar', 'king', 'duke', 'earl', 'pawn'] as const;
export type Rank = (typeof allRanks)[number];

export interface ViewProps {
  title?: string;
}

export type PinnedGroupsResponse = string[];

export type GroupMeta = Metadata;

export type OptionalGroupMeta = Partial<GroupMeta>;

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

export interface Seat {
  roles: string[];
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

// represents whether a post or its replies are flagged and by whom
export interface FlagData {
  flagged: boolean;
  flaggers: string[];
  replies: Record<string, string[]>;
}

// values are an object keyed by post id
export interface FlaggedContent {
  [nest: string]: Record<string, FlagData>;
}

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
  saga: Saga | null;
  'flagged-content': FlaggedContent;
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

export interface FlagContentDiff {
  'flag-content': {
    nest: string;
    src: string;
    'post-key': {
      post: string;
      reply: string | null;
    };
  };
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
  | ZoneDiff
  | FlagContentDiff;

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

export interface GroupCreateThreadInput {
  groupId: string;
  meta: OptionalGroupMeta;
  guestList: string[];
  channels: {
    channelId: string;
    meta: OptionalGroupMeta;
  }[];
}

export interface SagaAhead {
  ahead: string;
}

export interface SagaBehind {
  behind: null;
}

export interface SagaSynced {
  synced: null;
}

export type Saga = SagaAhead | SagaBehind | SagaSynced;

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

export interface GroupPreviewV7 {
  flag: string;
  meta: GroupMeta;
  time: number;
  'member-count': number;
  privacy: PrivacyType;
}

export type ClaimScheme =
  | { forever: null }
  | { limited: { count: number } }
  | { personal: { ship: string } };

export interface TokenMeta {
  scheme: ClaimScheme;
  expiry: number; // @da timestamp
  label: string | null; // unit @t
}

export interface Admissions {
  privacy: PrivacyType;
  banned: {
    ships: string[];
    ranks: string[];
  };
  pending: Record<string, string[]>; // ship -> role-ids (jug ship role-id)
  requests: Record<string, string | null>; // ship -> story (optional message with entry request)
  tokens: Record<string, TokenMeta>; // token (@uv) -> token-meta
  referrals: Record<string, string[]>; // ship -> tokens (jug ship token)
  invited: Record<string, { at: number; token: string | null }>; // ship -> [at token]
}

export interface GroupV7 {
  meta: GroupMeta;
  admissions: Admissions;
  seats: Record<string, Seat>; // fleet in v6 is now seats in v7, uses 'roles' not 'sects'
  roles: Record<string, GroupMeta>; // v7 roles ARE the metadata, not Cabals with nested meta
  admins: string[]; // just an array of role-ids
  channels: Channels;
  'active-channels': string[];
  sections: Zones;
  'section-order': Zone[];
  'flagged-content': FlaggedContent;
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

export interface GroupClaim {
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

export type Lookup = 'preview' | 'done' | 'error';

export type Progress = 'ask' | 'join' | 'watch' | 'done' | 'error';

export interface ForeignInvite {
  flag: string;
  time: number;
  from: string;
  token: string | null;
  note: string | null; // story serialized as string
  preview: GroupPreviewV7;
  valid: boolean; // tracks if invite has been revoked
}

export interface Foreign {
  invites: ForeignInvite[];
  lookup: Lookup | null;
  preview: GroupPreviewV7 | null;
  progress: Progress | null;
  token: string | null;
}

export interface Foreigns {
  [flag: string]: Foreign;
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
  sort?: 'time' | 'alpha' | 'arranged';
  view?: 'grid' | 'list';
}

export interface NewChannelFormSchema extends ChannelFormSchema {
  type: ChannelType;
}

export interface ChannelPreview {
  nest: string;
  meta: GroupMeta;
  group: GroupPreview;
}

export function isGroup(obj: any): obj is Group {
  return 'fleet' in obj && 'cabals' in obj;
}

export interface GroupInviteAction {
  token: string | null;
  note: Story | null;
}

export interface GroupSectionV5 {
  meta: GroupMeta;
  order: string[];
}

export interface GroupActionInviteV5 {
  invite: {
    flag: string;
    ships: string[];
    'a-invite': GroupInviteAction;
  };
}

export interface GroupPlanV5 {
  post: string;
  reply: string | null;
}

export type GroupEntryBanActionV5 =
  | { set: { ships: string[]; ranks: string[] } }
  | { 'add-ships': string[] }
  | { 'del-ships': string[] }
  | { 'add-ranks': string[] }
  | { 'del-ranks': string[] };

export type GroupEntryTokenActionV5 =
  | { del: string }
  | {
      add: {
        scheme: ClaimScheme;
        expiry: string | null;
        label: string | null;
        referral: boolean;
      };
    };

export type GroupEntryPendingActionV5 =
  | { add: string[] }
  | { edit: string[] }
  | { del: null };

export type GroupEntryActionV5 =
  | { privacy: PrivacyType }
  | { ban: GroupEntryBanActionV5 }
  | { token: GroupEntryTokenActionV5 }
  | { pending: { ships: string[]; 'a-pending': GroupEntryPendingActionV5 } }
  | { ask: { ships: string[]; 'a-ask': 'approve' | 'deny' } };

export type GroupSeatActionV5 =
  | { add: null }
  | { del: null }
  | { 'add-roles': string[] }
  | { 'del-roles': string[] };

export type GroupRoleActionV5 =
  | { add: GroupMeta }
  | { edit: GroupMeta }
  | { del: null }
  | { 'set-admin': null }
  | { 'del-admin': null };

export type GroupChannelActionV5 =
  | { add: GroupChannel }
  | { edit: GroupChannel }
  | { del: null }
  | { 'add-readers': string[] }
  | { 'del-readers': string[] }
  | { section: string }
  | { join: boolean };

export type GroupSectionActionV5 =
  | { add: GroupMeta }
  | { edit: GroupMeta }
  | { del: null }
  | { move: number }
  | { 'move-nest': { nest: string; idx: number } }
  | { set: string[] };

export interface GroupNavigationActionV5 {
  sections: Record<string, GroupSectionV5>;
  order: string[];
}

export type GroupSubActionV5 =
  | { meta: GroupMeta }
  | { entry: GroupEntryActionV5 }
  | { seat: { ships: string[]; 'a-seat': GroupSeatActionV5 } }
  | { role: { roles: string[]; 'a-role': GroupRoleActionV5 } }
  | { channel: { nest: string; 'a-channel': GroupChannelActionV5 } }
  | { section: { 'section-id': string; 'a-section': GroupSectionActionV5 } }
  | { navigation: GroupNavigationActionV5 }
  | { 'flag-content': { nest: string; plan: GroupPlanV5; src: string } };

export interface GroupActionGroupV5 {
  group: {
    flag: string;
    'a-group': GroupSubActionV5;
  };
}

export interface GroupActionLeaveV5 {
  leave: string;
}

export interface GroupActionV5 {
  id: string;
  'a-groups': GroupActionInviteV5 | GroupActionGroupV5 | GroupActionLeaveV5;
}

export type GroupResponseEntryBanV5 = GroupEntryBanActionV5;

export type GroupResponseEntryTokenV5 =
  | { add: { token: string; meta: TokenMeta } }
  | { del: string };

export type GroupResponseEntryPendingV5 =
  | { add: { ships: string[]; roles: string[] } }
  | { edit: { ships: string[]; roles: string[] } }
  | { del: string[] };

export type GroupResponseEntryAskV5 =
  | { add: { ship: string; story: Story | null } }
  | { del: string[] };

export type GroupResponseEntryV5 =
  | { privacy: PrivacyType }
  | { ban: GroupResponseEntryBanV5 }
  | { token: GroupResponseEntryTokenV5 }
  | { pending: GroupResponseEntryPendingV5 }
  | { ask: GroupResponseEntryAskV5 };

export type GroupResponseSeatV5 =
  | { add: { roles: string[]; joined: number } }
  | { del: null }
  | { 'add-roles': string[] }
  | { 'del-roles': string[] };

export type GroupResponseRoleV5 = GroupRoleActionV5;

export type GroupResponseChannelV5 = GroupChannelActionV5;

export type GroupResponseSectionV5 =
  | { add: GroupMeta }
  | { edit: GroupMeta }
  | { del: null }
  | { move: number }
  | { 'move-nest': { nest: string; idx: number } };

export type GroupResponseV5 =
  | { create: GroupV7 }
  | { meta: GroupMeta }
  | { entry: GroupResponseEntryV5 }
  | { seat: { ships: string[]; 'r-seat': GroupResponseSeatV5 } }
  | { role: { roles: string[]; 'r-role': GroupResponseRoleV5 } }
  | { channel: { nest: string; 'r-channel': GroupResponseChannelV5 } }
  | { section: { 'section-id': string; 'r-section': GroupResponseSectionV5 } }
  | { navigation: GroupSectionV5 }
  | { 'flag-content': { nest: string; plan: GroupPlanV5; src: string } }
  | { delete: null };

export interface GroupResponseOKV5 {
  ok: GroupResponseV5;
}

export interface GroupActionResponseV5 {
  'request-id': string;
  body:
    | GroupResponseOKV5
    | { pending: null }
    | {
        error: {
          type: string;
          message: string;
        };
      };
}
