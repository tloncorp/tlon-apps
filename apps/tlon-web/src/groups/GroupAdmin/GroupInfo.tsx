import React, { useState } from 'react';
import { useLocation } from 'react-router';
import { Link } from 'react-router-dom';

import WidgetDrawer from '@/components/WidgetDrawer';
import InviteIcon from '@/components/icons/InviteIcon';
import LeaveIcon from '@/components/icons/LeaveIcon';
import PinIcon16 from '@/components/icons/PinIcon16';
import SlidersIcon from '@/components/icons/SlidersIcon';
import SmileIcon from '@/components/icons/SmileIcon';
import { useGroupActions } from '@/groups/GroupActions';
import GroupAvatar from '@/groups/GroupAvatar';
import ChannelList from '@/groups/GroupSidebar/ChannelList';
import { useDismissNavigate, useModalNavigate } from '@/logic/routing';
import { useAmAdmin, useGroup, useRouteGroup } from '@/state/groups/groups';

export default function GroupInfo() {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const dismiss = useDismissNavigate();
  const location = useLocation();
  const navigate = useModalNavigate();
  const isAdmin = useAmAdmin(flag);

  const { isPinned, copyItemText, onCopy, onPinClick } = useGroupActions({
    flag,
  });

  // We need to track if the user has started a navigation so that we can
  // dismiss the drawer if they close it without starting a navigation
  const [navigationStarted, setNavigationStarted] = useState(false);

  const onOpenChange = (open: boolean) => {
    // If the drawer is being closed and we haven't started a navigation,
    // dismiss the drawer
    if (!open && !navigationStarted) {
      dismiss();
    }
    // Reset the navigation started state
    setNavigationStarted(false);
  };

  const buttonClasses =
    'w-full flex justify-center items-center flex-col text-center p-3 text-sm bg-gray-50 rounded-lg space-y-2';

  return (
    <WidgetDrawer open={true} onOpenChange={onOpenChange} className="h-[80vh]">
      <div className="mt-6 flex h-full flex-col space-y-3 overflow-y-auto">
        <div className="flex items-center space-x-2 px-6 py-2">
          <GroupAvatar size="h-10 w-10" {...group?.meta} />
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold">{group?.meta.title}</h1>
            <p className="text-gray-400">Group quick actions</p>
          </div>
        </div>
        <div className="flex items-center justify-between space-x-1 px-6">
          <button
            className={buttonClasses}
            onClick={() => {
              setNavigationStarted(true);
              navigate(`/groups/${flag}/invite`, {
                state: { backgroundLocation: location },
              });
            }}
          >
            <InviteIcon className="h-6 w-6" />
            <span>Invite</span>
          </button>
          <button className={buttonClasses} onClick={onPinClick}>
            <PinIcon16 className="h-6 w-6" />
            <span>{isPinned ? 'Unpin' : 'Pin'}</span>
          </button>
          <Link to={`/groups/${flag}/members`} className={buttonClasses}>
            <SmileIcon className="h-6 w-6" />
            <span>Members</span>
          </Link>
          {isAdmin ? (
            <Link to={`/groups/${flag}/edit`} className={buttonClasses}>
              <SlidersIcon className="h-6 w-6" />
              <span>Settings</span>
            </Link>
          ) : (
            <button
              className={buttonClasses}
              onClick={() => {
                setNavigationStarted(true);
                navigate(`/groups/${flag}/leave`, {
                  state: { backgroundLocation: location },
                });
              }}
            >
              <LeaveIcon className="h-6 w-6" />
              <span>Leave</span>
            </button>
          )}
        </div>
        <div className="flex flex-col items-stretch justify-center space-y-3 px-6">
          <button className={buttonClasses} onClick={onCopy}>
            {copyItemText}
          </button>
          <button
            className={buttonClasses}
            onClick={() => {
              setNavigationStarted(true);
              navigate(`/groups/${flag}/volume`, {
                state: { backgroundLocation: location },
              });
            }}
          >
            Group notifications settings
          </button>
        </div>
        <div className="w-full">
          <ChannelList noScroller={true} flag={flag} />
        </div>
      </div>
    </WidgetDrawer>
  );
}
