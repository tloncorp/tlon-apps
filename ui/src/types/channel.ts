export interface ChannelCreate {
  group: string;
  name: string;
  title: string;
  description: string;
  readers: string[];
  writers: string[];
}

export interface ChannelPerm {
  writers: string[];
}
