import { GroupChannel } from '@tloncorp/shared/urbit/groups';

export interface SectionMap {
  [key: string]: SectionListItem;
}

export interface ChannelListItem {
  key: string;
  channel: GroupChannel;
}

export interface SectionListItem {
  title: string;
  isNew?: boolean;
  channels: ChannelListItem[];
}
