import React, { useMemo } from 'react';
import { useGroup, useRouteGroup } from '@/state/groups';
import { SectionMap } from './types';
import AdminChannelListDropContext from './AdminChannelListDropContext';

export default function AdminChannelList() {
  const flag = useRouteGroup();
  const group = useGroup(flag);

  const getSectionedChannels = useMemo(() => {
    const sectionedChannels: SectionMap = {
      sectionless: {
        title: 'Sectionless',
        channels: [],
      },
    };

    if (group) {
      Object.entries(group.zones).forEach(([key, zone]) => {
        sectionedChannels[key] = {
          title: zone.title,
          channels: [],
        };
      });
      Object.entries(group.channels).forEach(([key, channel]) => {
        if (channel.zone !== null && sectionedChannels[channel.zone]) {
          sectionedChannels[channel.zone].channels.push({ key, channel });
        } else {
          sectionedChannels.sectionless.channels.push({ key, channel });
        }
      });
    }

    return sectionedChannels;
  }, [group]);

  return (
    <AdminChannelListDropContext sectionedChannels={getSectionedChannels} />
  );
}
