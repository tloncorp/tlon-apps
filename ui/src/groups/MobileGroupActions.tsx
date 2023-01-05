import React from 'react';
import { useLocation } from 'react-router-dom';
import InviteIcon from '@/components/icons/InviteIcon';
import LinkIcon from '@/components/icons/LinkIcon';
import PersonIcon from '@/components/icons/PersonIcon';
import { useGroupActions } from '@/groups/GroupActions';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import LeaveIcon from '@/components/icons/LeaveIcon';
import { useGroupFlag } from '@/state/groups';

const { ship } = window;

export default function MobileGroupActions() {
  const flag = useGroupFlag();
  const location = useLocation();
  const { onCopy, copyItemText } = useGroupActions(flag);

  return (
    <nav className="p-2">
      <ul className="space-y-3">
        <SidebarItem
          to={`/groups/${flag}/invite`}
          state={{ backgroundLocation: location }}
          icon={
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
              <InviteIcon className="h-6 w-6" />
            </div>
          }
        >
          Invite People
        </SidebarItem>
        <SidebarItem
          icon={
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
              <LinkIcon className="h-6 w-6" />
            </div>
          }
          onClick={onCopy}
        >
          {copyItemText}
        </SidebarItem>
        <SidebarItem
          to={`/groups/${flag}/info`}
          icon={
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
              <PersonIcon className="h-6 w-6" />
            </div>
          }
        >
          Members &amp; Group Info
        </SidebarItem>
        {flag.includes(ship) ? null : (
          <SidebarItem
            to={`/groups/${flag}/leave`}
            color="text-red"
            icon={
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-red-soft dark:bg-red-800">
                <LeaveIcon className="h-6 w-6" />
              </div>
            }
          >
            Leave Group
          </SidebarItem>
        )}
      </ul>
    </nav>
  );
}
