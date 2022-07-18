import { Channel } from '@/types/groups';

export interface SectionMap {
  [key: string]: SectionListItem;
}

export interface ChannelListItem {
  key: string;
  channel: Channel;
}

export interface SectionListItem {
  title: string;
  channels: ChannelListItem[];
}
