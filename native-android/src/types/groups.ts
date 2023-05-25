export interface GroupMeta {
  title: string;
  description: string;
  image: string;
  cover: string;
}

export interface GroupChannel {
  meta: GroupMeta;
}

export interface Channels {
  [nest: string]: GroupChannel;
}

export interface Group {
  channels: Channels;
  meta: GroupMeta;
}

export interface Groups {
  [flag: string]: Group;
}
