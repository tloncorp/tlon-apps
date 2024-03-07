import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import React, { useEffect } from 'react';
import { useLocation } from 'react-router';
import { Link } from 'react-router-dom';

import WidgetDrawer from '@/components/WidgetDrawer';
import InviteIcon from '@/components/icons/InviteIcon';
import LeaveIcon from '@/components/icons/LeaveIcon';
import PinIcon from '@/components/icons/PinIcon';
import PinIcon16 from '@/components/icons/PinIcon16';
import SmileIcon from '@/components/icons/SmileIcon';
import { useDismissNavigate } from '@/logic/routing';

import {
  useGroup,
  usePinnedGroups,
  useRouteGroup,
} from '../../state/groups/groups';
import { useGroupActions } from '../GroupActions';
import GroupAvatar from '../GroupAvatar';
import ChannelList from '../GroupSidebar/ChannelList';

export default function GroupInfo({ title }: ViewProps) {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const dismiss = useDismissNavigate();
  const location = useLocation();

  const { isPinned, copyItemText, onCopy, onPinClick } = useGroupActions({
    flag,
  });

  // useEffect(() => {
  //   console.log(location);
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  const onOpenChange = (open: boolean) => {
    if (!open) {
      dismiss();
    }
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
          <Link
            className={buttonClasses}
            to={`/groups/${flag}/invite`}
            state={{ backgroundLocation: location }}
          >
            <InviteIcon className="h-6 w-6" />
            <span>Invite</span>
          </Link>

          <button className={buttonClasses} onClick={onPinClick}>
            <PinIcon16 className="h-6 w-6" />
            <span>{isPinned ? 'Unpin' : 'Pin'}</span>
          </button>
          <Link className={buttonClasses} to={`/groups/${flag}/members`}>
            <SmileIcon className="h-6 w-6" />
            <span>Members</span>
          </Link>
          <Link
            className={buttonClasses}
            to={`/groups/${flag}/leave`}
            state={{ backgroundLocation: location }}
          >
            <LeaveIcon className="h-6 w-6" />
            <span>Leave</span>
          </Link>
        </div>
        <div className="flex flex-col items-stretch justify-center space-y-3 px-6">
          <button className={buttonClasses} onClick={onCopy}>
            {copyItemText}
          </button>
          <button className={buttonClasses}>Group Notification Settings</button>
        </div>
        <div className="w-full">
          <ChannelList noScroller={true} flag={flag} />
        </div>
      </div>
    </WidgetDrawer>
  );
}
