import React, { useEffect } from 'react';
import cn from 'classnames';
import { Outlet } from 'react-router';
import { Link, NavLink } from 'react-router-dom';
import { useGroup, useGroupState, useRouteGroup } from '../state/groups';
import { Group } from '../types/groups';
import api from '../api';

function SidebarRow(props: {
  className?: string;
  children?: React.ReactChild | React.ReactChild[];
}) {
  const { children, className = '' } = props;
  return (
    <li className={cn('flex space-x-2 p-2', className)}>
      <div className="h-6 w-6 rounded border border-black" />
      {typeof children === 'string' ? <div>{children}</div> : children}
    </li>
  );
}

function Divider(props: { title: string }) {
  const { title } = props;
  return (
    <div className="flex items-center space-x-2 p-2">
      <div>{title}</div>
      <div className="grow border-b border-black" />
    </div>
  );
}

function ChannelList(props: { group: Group; flag: string }) {
  const { group, flag } = props;
  const channels = Object.keys(group.channels);
  const channelHref = (ch: string) => `/groups/${flag}/channels/chat/${ch}`;
  return (
    <ul className="p-2">
      {channels.map((channel) => (
        <li className="flex justify-between" key={channel}>
          <Link to={channelHref(channel)}>{channel}</Link>
          <Link to={`${channelHref(channel)}/settings`}>⚙️ </Link>
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
      <div className="w-56 border-r border-black p-2">
        <div className="p-2">
          <h1>{group.meta.title}</h1>
          <p>{group.meta.description}</p>
        </div>
        <SidebarRow>
          <NavLink to={`/groups/${flag}/channels/new`}>New Channel</NavLink>
        </SidebarRow>
        <SidebarRow>
          <NavLink to={`/groups/${flag}/members`}>Members</NavLink>
        </SidebarRow>
        <SidebarRow>
          <NavLink to={`/groups/${flag}/roles`}>Roles</NavLink>
        </SidebarRow>
        <Divider title="Channels" />
        <ChannelList group={group} flag={flag} />
      </div>
      <Outlet />
    </div>
  );
}

export default Groups;
