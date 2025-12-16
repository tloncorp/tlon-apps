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

export interface GroupChannelV7 {
  added: number;
  meta: GroupMeta;
  section: string;
  readers: string[];
  join: boolean;
}

export interface Channels {
  [nest: string]: GroupChannel;
}

export interface GroupChannelsV7 {
  [nest: string]: GroupChannelV7;
}

export type Zone = string;

export interface Zones {
  [key: Zone]: {
    meta: GroupMeta;
    idx: string[];
  };
}

export interface SectionV7 {
  meta: GroupMeta;
  order: string[];
}

export interface SectionsV7 {
  [key: string]: SectionV7;
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

// v9 Group Response (r-groups)
export interface V1GroupResponse {
  flag: string;
  ['r-group']: GroupResponseData;
}

export type GroupResponseData =
  | { create: GroupV7 }
  | { meta: GroupMeta }
  | { entry: GroupResponseEntry }
  | { seat: { ships: string[]; 'r-seat': GroupResponseSeat } }
  | { role: { roles: string[]; 'r-role': GroupResponseRole } }
  | { channel: { nest: string; 'r-channel': GroupResponseChannel } }
  | { section: { 'section-id': string; 'r-section': GroupResponseSection } }
  | { 'section-order': { order: string[] } }
  | {
      'flag-content': {
        nest: string;
        'post-key': {
          post: string;
          reply: string | null;
        };
        src: string;
      };
    }
  | { delete: null };

export type GroupResponseEntry =
  | { privacy: PrivacyType }
  | { ban: GroupResponseBan }
  | { token: GroupResponseToken }
  | { pending: GroupResponsePending }
  | { ask: GroupResponseAsk };

export type GroupResponseBan =
  | { set: { ships: string[]; ranks: string[] } }
  | { 'add-ships': string[] }
  | { 'del-ships': string[] }
  | { 'add-ranks': string[] }
  | { 'del-ranks': string[] };

export type GroupResponseToken =
  | { add: { token: string; meta: TokenMeta } }
  | { del: string }; // token

export type GroupResponsePending =
  | { add: { ships: string[]; roles: string[] } }
  | { edit: { ships: string[]; roles: string[] } }
  | { del: { ships: string[] } };

export type GroupResponseAsk =
  | {
      add: { ship: string; requestedAt: number; note: Story | null };
    }
  | {
      del: { ships: string[] };
    };

export type GroupResponseSeat =
  | { add: Seat }
  | { del: null }
  | { 'add-roles': string[] }
  | { 'del-roles': string[] };

export type GroupResponseRole =
  | { add: GroupMeta }
  | { edit: GroupMeta }
  | { del: null }
  | { 'set-admin': null }
  | { 'del-admin': null };

export type GroupResponseChannel =
  | { add: GroupChannelV7 }
  | { edit: GroupChannelV7 }
  | { del: null }
  | { 'add-readers': string[] }
  | { 'del-readers': string[] }
  | { section: string }
  | { join: boolean };

export type GroupResponseSection =
  | { add: GroupMeta }
  | { edit: GroupMeta }
  | { del: null }
  | { move: { idx: number } }
  | { 'move-nest': { idx: number; nest: string } }
  | { set: string[] };

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

export interface GroupsV7 {
  [flag: string]: GroupV7;
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
  requests: Record<string, AdmissionRequest>;
  tokens: Record<string, TokenMeta>; // token (@uv) -> token-meta
  referrals: Record<string, string[]>; // ship -> tokens (jug ship token)
  invited: Record<string, { at: number; token: string | null }>; // ship -> [at token]
}

export interface AdmissionRequest {
  note?: Story | null; // optional request message for admins
  requestedAt?: number;
}

export interface GroupV7 {
  meta: GroupMeta;
  admissions: Admissions;
  seats: Record<string, Seat>; // fleet in v6 is now seats in v7, uses 'roles' not 'sects'
  roles: Record<string, GroupMeta>; // v7 roles ARE the metadata, not Cabals with nested meta
  admins: string[]; // just an array of role-ids
  channels: GroupChannelsV7;
  'active-channels': string[];
  sections: SectionsV7;
  'section-order': string[];
  'flagged-content': FlaggedContent;
  'member-count': number;
  init: boolean;
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

// v8/v9 Group Actions (a-groups)
export type GroupActionV4 =
  | {
      group: {
        flag: string;
        'a-group': GroupAction;
      };
    }
  | {
      invite: { flag: string; ships: string[]; 'a-invite': GroupInviteAction };
    }
  | {
      leave: string; // flag
    };

export type GroupAction =
  | { meta: GroupMeta }
  | { entry: GroupEntryAction }
  | { seat: { ships: string[]; 'a-seat': GroupSeatAction } }
  | { role: { roles: string[]; 'a-role': GroupRoleAction } }
  | { channel: { nest: string; 'a-channel': GroupChannelAction } }
  | { section: { 'section-id': string; 'a-section': GroupSectionAction } }
  | { navigation: GroupNavigationAction }
  | {
      'flag-content': {
        nest: string;
        plan: [number, number | null]; // [post-time, reply-time?]
        src: string; // ship
      };
    }
  | { delete: null };

export type GroupEntryAction =
  | { privacy: PrivacyType }
  | { ban: GroupBanAction }
  | { token: GroupTokenAction }
  | { pending: { ships: string[]; 'a-pending': GroupPendingAction } }
  | { ask: { ships: string[]; 'a-ask': 'approve' | 'deny' } };

export type GroupBanAction =
  | { set: { ships: string[]; ranks: string[] } }
  | { 'add-ships': string[] }
  | { 'del-ships': string[] }
  | { 'add-ranks': string[] }
  | { 'del-ranks': string[] };

export type GroupTokenAction = { add: GroupTokenAddAction } | { del: string }; // token

export type GroupTokenAddAction = {
  scheme: ClaimScheme;
  expiry: number | null; // @dr duration
  label: string | null;
  referral: boolean;
};

export type GroupPendingAction =
  | { add: string[] } // role-ids
  | { edit: string[] } // role-ids
  | { del: null };

export type GroupSeatAction =
  | { add: null }
  | { del: null }
  | { 'add-roles': string[] } // role-ids
  | { 'del-roles': string[] }; // role-ids

export type GroupRoleAction =
  | { add: GroupMeta }
  | { edit: GroupMeta }
  | { del: null }
  | { 'set-admin': null }
  | { 'del-admin': null };

export type GroupChannelAction =
  | { add: GroupChannelV7 }
  | { edit: GroupChannelV7 }
  | { del: null }
  | { 'add-readers': string[] } // role-ids
  | { 'del-readers': string[] } // role-ids
  | { section: string }; // section-id

export type GroupSectionAction =
  | { add: GroupMeta }
  | { edit: GroupMeta }
  | { del: null }
  | { move: number } // idx
  | { 'move-nest': { nest: string; idx: number } }
  | { set: string[] }; // order of nests

export type GroupNavigationAction = {
  sections: Record<string, GroupNavigationSectionData>;
  order: string[];
};

// Foreign Group Actions (a-foreigns) - v9
export type ForeignGroupActions =
  | {
      foreign: {
        flag: string;
        'a-foreign': ForeignGroupAction;
      };
    }
  | {
      invite: ForeignInvite;
    }
  | {
      revoke: {
        flag: string;
        token: string | null;
      };
    }
  | {
      reject: string; // flag
    };

export type ForeignGroupAction =
  | { join: { token: string | null } }
  | { ask: { story: Story | null } }
  | { cancel: null }
  | { decline: { token: string | null } };

// Types for batch navigation updates (group-action-4)
export interface GroupNavigationSectionData {
  meta: GroupMeta;
  order: string[];
}

export interface GroupNavigationUpdate {
  sections: Record<string, GroupNavigationSectionData>;
  order: string[];
}

export interface GroupNavigationBatchUpdate {
  group: {
    flag: string;
    'a-group': {
      navigation: GroupNavigationUpdate;
    };
  };
}
