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

interface CordonDiff {
  cordon: {
    change: string;
  };
}
// TODO: elaborate
export type GroupDiff = FleetDiff | CabalDiff | ChannelDiff | CordonDiff;

export interface GroupUpdate {
  time: string;
  diff: GroupDiff;
}

export interface GroupAction {
  flag: string;
  update: GroupUpdate;
}
