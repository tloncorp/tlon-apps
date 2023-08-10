import React, { useState } from 'react';
import cn from 'classnames';
import { Outlet, useLocation, useMatch } from 'react-router';
import { useAmAdmin, useGroup, useGroupFlag } from '@/state/groups/groups';
import NavTab from '@/components/NavTab';
import HashIcon from '@/components/icons/HashIcon';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import BellIcon from '@/components/icons/BellIcon';
import Sheet, { SheetContent } from '@/components/Sheet';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import InviteIcon from '@/components/icons/InviteIcon';
import LinkIcon from '@/components/icons/LinkIcon';
import LeaveIcon from '@/components/icons/LeaveIcon';
import PersonIcon from '@/components/icons/PersonIcon';
import { getPrivacyFromGroup } from '@/logic/utils';
import GroupAvatar from '../GroupAvatar';
import { useGroupActions } from '../GroupActions';

export default function MobileGroupSidebar() {
  const { ship } = window;
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const privacy = group ? getPrivacyFromGroup(group) : 'public';
  const match = useMatch('/groups/:ship/:name/info');
  const location = useLocation();
  const [showSheet, setShowSheet] = useState(false);
  const { onCopy, copyItemText } = useGroupActions(flag);
  const isAdmin = useAmAdmin(flag);

  return (
    <section className="flex h-full w-full flex-col overflow-x-hidden bg-white pt-4">
      <Outlet />
      <footer className="mt-auto flex-none border-t-2 border-gray-50">
        <nav>
          <ul className="flex items-center">
            <NavTab to={`.`} className="basis-1/4">
              <HashIcon className="mb-0.5 h-6 w-6" />
              Channels
            </NavTab>
            <NavTab to={`/groups/${flag}/activity`} className="basis-1/4">
              <BellIcon className="mb-0.5 h-6 w-6" />
              Activity
            </NavTab>
            <NavTab
              to={`/groups/${flag}/info`}
              className="basis-1/4"
              state={{ backgroundLocation: location }}
            >
              <GroupAvatar
                {...group?.meta}
                size="h-6 w-6"
                className={cn('mb-0.5', !match && 'opacity-50 grayscale')}
              />
              Group Info
            </NavTab>
            <NavTab onClick={() => setShowSheet(true)} className="basis-1/4">
              <ElipsisIcon className="mb-0.5 h-6 w-6" />
              Options
            </NavTab>
          </ul>
          <Sheet open={showSheet} onOpenChange={(o) => setShowSheet(o)}>
            <SheetContent showClose={true}>
              <div className="flex flex-col pt-4">
                {(privacy === 'public' || isAdmin) && (
                  <SidebarItem
                    onClick={() => setShowSheet(false)}
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
                )}
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
                {isAdmin && (
                  <SidebarItem
                    onClick={() => setShowSheet(false)}
                    to={`/groups/${flag}/edit`}
                    state={{ backgroundLocation: location }}
                    icon={
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
                        <PersonIcon className="h-6 w-6" />
                      </div>
                    }
                  >
                    Group Settings
                  </SidebarItem>
                )}
                {flag.includes(ship) ? null : (
                  <SidebarItem
                    onClick={() => setShowSheet(false)}
                    to={`/groups/${flag}/leave`}
                    state={{ backgroundLocation: location }}
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
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </footer>
    </section>
  );
}
