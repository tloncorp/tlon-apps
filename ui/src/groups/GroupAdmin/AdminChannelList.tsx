import React from 'react';
import { Channel } from '@/types/groups';
import { useGroup, useRouteGroup } from '../../state/groups';
import AdminChannelListDropContext from './AdminChannelListDropContext';

interface ChannelListItem {
  key: string;
  channel: Channel;
}

interface SectionListItem {
  title: string;
  channels: ChannelListItem[];
}

type SectionList = SectionListItem[]

export default function AdminChannelList() {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const sectionedChannels : SectionList = [{
    title: "Sectionless",
    channels: []
  }];

  if (!group) {
    return null;
  }

  Object.entries(group.channels).forEach(([key, channel]) => {
    sectionedChannels.forEach(sectionListItem => {
      if (sectionListItem.title === "Sectionless" && channel.zone === "" || channel.zone === null) {
        sectionListItem.channels.push({key, channel});
      } else if (sectionListItem.title === channel.zone) {
        sectionListItem.channels.push({key, channel});
      } else {
        sectionedChannels.push({
          title: channel.zone,
          channels: [{key, channel}]
        });
      }
    });
  });

  return <AdminChannelListDropContext sectionedChannels={sectionedChannels} />;
}
