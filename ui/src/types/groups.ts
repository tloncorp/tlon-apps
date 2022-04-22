
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

export interface Group {
  fleet: string[];
  cabals: {
    [sect: string]: Cabal;
  };
  channels: {
    [flag: string]: Channel;
  }
  cordon: any;
  meta: GroupMeta;
}

