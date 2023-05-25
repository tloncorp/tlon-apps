import React from 'react';
import cn from 'classnames';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAmAdmin, useRouteGroup } from '@/state/groups/groups';
import Dialog from '@/components/Dialog';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import { useDismissNavigate } from '@/logic/routing';
import HomeIcon from '@/components/icons/HomeIcon';
import AddPersonIcon from '@/components/icons/AddPersonIcon';
import PeopleIcon from '@/components/icons/PeopleIcon';
import BadgeIcon from '@/components/icons/BadgeIcon';
import XIcon from '@/components/icons/XIcon';

export default function GroupAdmin() {
  const { state } = useLocation();
  const flag = useRouteGroup();
  const isAdmin = useAmAdmin(flag);
  const dismiss = useDismissNavigate();

  const onOpenChange = (open: boolean) => {
    if (!open) {
      dismiss();
    }
  };

  return (
    <Dialog
      defaultOpen
      modal
      onOpenChange={onOpenChange}
      className="h-[90vh] w-[90vw] overflow-hidden p-0 sm:h-[75vh] sm:max-h-[800px] sm:w-[75vw] sm:max-w-[800px]"
      onInteractOutside={(e) => e.preventDefault()}
    >
      {isAdmin ? (
        <div className="flex h-full flex-col overflow-hidden sm:flex-row">
          <aside className="order-2 p-4 sm:order-1 sm:h-full sm:w-[266px]">
            <nav>
              <SidebarItem
                to={`/groups/${flag}/edit`}
                icon={<HomeIcon className="h-6 w-6" />}
                state={{ backgroundLocation: state.backgroundLocation }}
              >
                Group Info
              </SidebarItem>
              <SidebarItem
                to={`/groups/${flag}/edit/invites-privacy`}
                icon={<AddPersonIcon className="h-6 w-6" />}
                state={{ backgroundLocation: state.backgroundLocation }}
              >
                Invites &amp; Privacy
              </SidebarItem>
              <SidebarItem
                to={`/groups/${flag}/edit/members`}
                icon={<PeopleIcon className="h-6 w-6" />}
                state={{ backgroundLocation: state.backgroundLocation }}
              >
                Members
              </SidebarItem>
              <SidebarItem
                to={`/groups/${flag}/edit/roles`}
                icon={<BadgeIcon className="h-6 w-6" />}
                state={{ backgroundLocation: state.backgroundLocation }}
              >
                Roles
              </SidebarItem>
              <SidebarItem
                to={`/groups/${flag}/edit/delete`}
                icon={<XIcon className="m-0.5 h-5 w-5" />}
                state={{ backgroundLocation: state.backgroundLocation }}
              >
                Delete Group
              </SidebarItem>
            </nav>
          </aside>
          <main className="order-1 h-full w-full overflow-auto bg-gray-50 p-6 sm:order-2">
            <Outlet />
          </main>
        </div>
      ) : (
        <div className="p-6">
          <h2 className="mb-4 text-lg font-bold">Permission Error</h2>
          <p className="leading-5">
            You&rsquo;re not an administrator for this group, or something has
            gone wrong.
          </p>
        </div>
      )}
    </Dialog>
  );
}
