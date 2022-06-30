import React from 'react';
import { useGroup, useRouteGroup } from '../../state/groups';
import AdminChannelListItem from './AdminChannelListItem';

export default function AdminChannelList() {
  const flag = useRouteGroup();
  const group = useGroup(flag);

  if (!group) {
    return null;
  }

  return (
    <div className="card my-5">
      {Object.entries(group.channels).map(([key, channel]) => (
        <AdminChannelListItem key={key} channel={channel} />
      ))}
    </div>
  );
}
