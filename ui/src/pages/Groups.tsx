import React, { useEffect } from 'react';
import { Outlet } from 'react-router';
import { Link } from 'react-router-dom';
import { useGroup, useGroupState, useRouteGroup } from '../state/groups';
import { Group } from '../types/groups';
import api from '../api';
import SidebarLink from '../components/Sidebar/SidebarLink';
import Divider from '../components/Divider';
import { channelHref } from '../utils';

function ChannelList({ group, flag }: { group: Group; flag: string }) {
  return (
    <ul>
      {Object.entries(group.channels).map(([key, channel]) => (
        <li key={key}>
          <SidebarLink to={channelHref(flag, key)}>
            {channel.meta.title || key}
          </SidebarLink>
        </li>
      ))}
    </ul>
  );
}

function Groups() {
  const flag = useRouteGroup();
  const group = useGroup(flag);

  useEffect(() => {
    let id = null as number | null;
    useGroupState
      .getState()
      .initialize(flag)
      .then((i) => {
        id = i;
      });
    return () => {
      if (id) {
        api.unsubscribe(id);
      }
    };
  }, [flag]);
  if (!group) {
    return null;
  }
  return (
    <div className="flex grow">
      <nav className="w-64 border-r-2 border-gray-50 p-2">
        <div className="p-2">
          <h1 className="mb-2 font-semibold">{group.meta.title}</h1>
          <p>{group.meta.description}</p>
        </div>
        <ul>
          <SidebarLink to={`/groups/${flag}/channels/new`}>
            New Channel
          </SidebarLink>
          <SidebarLink to={`/groups/${flag}/members`}>Members</SidebarLink>
          <SidebarLink to={`/groups/${flag}/roles`}>Roles</SidebarLink>
        </ul>
        <Divider>Channels</Divider>
        <ChannelList group={group} flag={flag} />
      </nav>
      <Outlet />
    </div>
  );
}

export default Groups;
