import cn from 'classnames';
import { Link, useLocation } from 'react-router-dom';

import MobileHeader from '@/components/MobileHeader';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import AddIconMobileNav from '@/components/icons/AddIconMobileNav';
import GroupAvatar from '@/groups/GroupAvatar';
import ChannelList, { ChannelSorter } from '@/groups/GroupSidebar/ChannelList';
import { useBottomPadding } from '@/logic/position';
import { useTextColor } from '@/logic/useTextColor';
import { isColor } from '@/logic/utils';
import { useAmAdmin, useGroup, useGroupFlag } from '@/state/groups';
import { useCalm } from '@/state/settings';

import GroupActions from './GroupActions';
import GroupHostConnection from './GroupHostConnection';

export default function MobileGroupChannelList() {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const isAdmin = useAmAdmin(flag);
  const location = useLocation();
  const defaultImportCover = group?.meta.cover === '0x0';
  const calm = useCalm();
  const textColor = useTextColor(group?.meta.cover || '');
  const { paddingBottom } = useBottomPadding();

  const bgStyle = () => {
    if (
      group &&
      !isColor(group?.meta.cover) &&
      !defaultImportCover &&
      !calm.disableRemoteContent
    )
      return {
        backgroundImage: `url(${group?.meta.cover}`,
      };
    if (group && isColor(group?.meta.cover) && !defaultImportCover)
      return {
        backgroundColor: group?.meta.cover,
      };
    return {};
  };

  return (
    <>
      <MobileHeader
        style={{
          color: textColor,
          backgroundColor: 'transparent',
        }}
        title={
          <GroupActions flag={flag}>
            <button className="flex w-full flex-col items-center">
              <GroupAvatar image={group?.meta.image} className="mt-3" />
              <div className="relative my-1 flex w-max items-center justify-center space-x-1">
                <h1
                  className={cn('max-w-xs truncate text-base')}
                  style={
                    textColor === 'white'
                      ? { textShadow: '0 1px 2px rgba(0,0,0,0.4)' }
                      : {}
                  }
                >
                  {group?.meta.title}
                </h1>
                <GroupHostConnection flag={flag} type="bullet" />
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
                <AddIconMobileNav className="h-8 w-8 " />
              </Link>
            )}
          </div>
        }
        pathBack="/"
        // TODO: here is where we will wire up the back button once the native groups list is ready
      />
      <div
        className="relative z-10 mt-2 h-full rounded-t-3xl bg-white pb-4 drop-shadow-[0_-2px_4px_rgba(0,0,0,0.125)]"
        style={{
          paddingBottom,
        }}
      >
        <ChannelList flag={flag} paddingTop={6} />
      </div>
      <div
        className="absolute left-[-5%] top-[-5%] -z-10 h-64 w-[110%] bg-cover bg-center mix-blend-multiply blur-md dark:mix-blend-screen"
        style={bgStyle()}
      />
    </>
  );
}
