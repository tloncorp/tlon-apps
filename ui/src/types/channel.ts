export interface ChannelCreate {
  group: string;
  name: string;
  title: string;
  description: string;
  readers: string[];
  writers: string[];
}

export interface Channel {
  perms: ChannelPerm;
}

export interface ChannelPerm {
  writers: string[];
}
