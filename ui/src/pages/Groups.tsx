import React, { useEffect } from 'react';
import cn from 'classnames';
import { Outlet, useParams } from 'react-router';
import { Link, NavLink } from 'react-router-dom';
import { useGroup, useGroupState, useRouteGroup } from '../state/groups';
import { Group } from '../types/groups';
import api from '../api';

function SidebarRow(props: {
  icon?: string;
  img?: string;
  className?: string;
  children?: React.ReactChild | React.ReactChild[];
}) {
  const { children, icon, img, className = '' } = props;
  return (
    <li className={cn('flex p-2 space-x-2', className)}>
      <div className="border w-6 h-6 rounded"></div>
      {typeof children === 'string' ? <div>{children}</div> : children}
    </li>
  );
}

function GroupItem(props: { flag: string }) {
  const { flag } = props;
  const { meta } = useGroup(flag);
  return (
    <SidebarRow>
      <NavLink to={`/groups/${flag}`}>{meta.title}</NavLink>
    </SidebarRow>
  );
}

function Divider(props: { title: string }) {
  const { title } = props;
  return (
    <div className="flex p-2 space-x-2 items-center">
      <div>{title}</div>
      <div className="grow border-b"></div>
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
  }, [group]);
  if (!group) {
    return null;
  }
  return (
    <div className="flex grow">
      <div className="w-56 p-2 border-r">
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
