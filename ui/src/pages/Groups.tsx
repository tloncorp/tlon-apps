import React from 'react';
import cn from 'classnames';
import { Outlet, useParams } from 'react-router';
import { Link, NavLink } from 'react-router-dom';
import { useGroup } from '../state/groups';
import { Group } from '../types/groups';

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
  return (
    <ul className="p-2">
      {channels.map((channel) => (
        <li key={channel}>
          <Link to={`/groups/${flag}/channels/${channel}`}>{channel}</Link>
        </li>
      ))}
    </ul>
  );
}

function Groups() {
  const { ship, name } = useParams();
  const flag = `${ship!}/${name!}`;

  const group = useGroup(flag!);
  console.log(group);
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
        <Divider title="Channels" />
        <ChannelList group={group} flag={flag} />
      </div>
      <Outlet />
    </div>
  );
}

export default Groups;
