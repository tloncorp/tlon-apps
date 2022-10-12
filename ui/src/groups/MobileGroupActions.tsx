import React from 'react';
import { useLocation } from 'react-router-dom';
import InviteIcon from '@/components/icons/InviteIcon';
import LinkIcon from '@/components/icons/LinkIcon';
import PersonIcon from '@/components/icons/PersonIcon';
import SlidersIcon from '@/components/icons/SlidersIcon';
import { useGroupActions } from '@/groups/GroupActions';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import useNavStore from '@/nav/useNavStore';
import LeaveIcon from '@/components/icons/LeaveIcon';

interface MobileGroupActionsProps {
  flag: string;
}

const { ship } = window;

export default function MobileGroupActions({ flag }: MobileGroupActionsProps) {
  const location = useLocation();
  const { onCopy, copyItemText } = useGroupActions(flag);
  const { navPrimary } = useNavStore((state) => ({
    navPrimary: state.navigatePrimary,
  }));

  return (
    <nav>
      <ul className="space-y-3">
        <SidebarItem
          to={`/groups/${flag}/invite`}
          state={{ backgroundLocation: location }}
          color="text-blue"
          icon={
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-soft dark:bg-blue-800">
              <InviteIcon className="h-6 w-6" />
            </div>
          }
        >
          Invite People
        </SidebarItem>
        <SidebarItem
          color="text-blue"
          icon={
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-soft dark:bg-blue-800">
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
          onClick={() => navPrimary('hidden')}
        >
          Members &amp; Group Info
        </SidebarItem>
        <SidebarItem
          icon={
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
              <SlidersIcon className="h-6 w-6" />
            </div>
          }
        >
          Group Preferences
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
