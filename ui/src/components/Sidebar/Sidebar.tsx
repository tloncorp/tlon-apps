import React from 'react';
import { useGroup, useGroupList } from '../../state/groups';
import Divider from '../Divider';
import SidebarLink from './SidebarLink';

function GroupItem({ flag }: { flag: string }) {
  const { meta } = useGroup(flag);
  return <SidebarLink to={`/groups/${flag}`}>{meta.title}</SidebarLink>;
}

export default function Sidebar() {
  const groups = useGroupList();

  return (
    <nav className="h-full">
      <ul className="h-full min-w-56 border-r-2 border-gray-50 p-2">
        <SidebarLink to="/">Groups</SidebarLink>
        <SidebarLink to="/profile">Profile</SidebarLink>
        <SidebarLink to="/groups/new">New Group</SidebarLink>
        <Divider>All Groups</Divider>
        {groups.map((flag) => (
          <GroupItem key={flag} flag={flag} />
        ))}
      </ul>
    </nav>
  );
}
