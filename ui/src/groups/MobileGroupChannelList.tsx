import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useGroupFlag, useGroup, useAmAdmin } from '@/state/groups';
import ChannelList, { ChannelSorter } from '@/groups/GroupSidebar/ChannelList';
import GroupAvatar from '@/groups/GroupAvatar';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import HostConnection from '@/channels/HostConnection';
import { getFlagParts } from '@/logic/utils';
import { useConnectivityCheck } from '@/state/vitals';
import MobileHeader from '@/components/MobileHeader';
import AddIconMobileNav from '@/components/icons/AddIconMobileNav';
import GroupActions from './GroupActions';

export default function MobileGroupChannelList() {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const isAdmin = useAmAdmin(flag);
  const location = useLocation();
  const host = getFlagParts(flag).ship;
  const { data } = useConnectivityCheck(host);
  const saga = group?.saga || null;

  return (
    <>
      <MobileHeader
        title={
          <GroupActions flag={flag} saga={saga} status={data?.status}>
            <button className="flex w-full flex-col items-center">
              <GroupAvatar image={group?.meta.image} className="mt-3" />
              <div className="relative my-1 flex w-max items-center justify-center space-x-1">
                <h1 className="max-w-xs truncate text-[17px] text-gray-800">
                  {group?.meta.title}
                </h1>
                <HostConnection
                  ship={host}
                  status={data?.status}
                  saga={saga}
                  type="bullet"
                />
              </div>
            </button>
          </GroupActions>
        }
        action={
          <div className="flex h-12 items-center justify-end space-x-2">
            <ReconnectingSpinner />
            <ChannelSorter isMobile={true} />
            {isAdmin && (
              <Link
                className="default-focus flex text-base"
                to={`/groups/${flag}/channels/new`}
                state={{ backgroundLocation: location }}
              >
                <AddIconMobileNav className="h-8 w-8 text-black" />
              </Link>
            )}
          </div>
        }
        goBack
      />
      <ChannelList />
    </>
  );
}
