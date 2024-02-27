import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import { Helmet } from 'react-helmet';
import { Outlet } from 'react-router-dom';

import Avatar from '@/components/Avatar';
import MobileHeader from '@/components/MobileHeader';
import ShipName from '@/components/ShipName';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import AsteriskIcon from '@/components/icons/AsteriskIcon';
import FeedbackIcon from '@/components/icons/FeedbackIcon';
import InfoIcon from '@/components/icons/InfoIcon';
import LogOutIcon from '@/components/icons/LogOutIcon';
import PersonIcon from '@/components/icons/PersonIcon';
import ShareIcon from '@/components/icons/ShareIcon';
import { isNativeApp, postActionToNativeApp } from '@/logic/native';
import { useIsMobile } from '@/logic/useMedia';
import useShowTabBar from '@/logic/useShowTabBar';
import { isHosted } from '@/logic/utils';
import { useOurContact } from '@/state/contact';

import ProfileCoverImage from './ProfileCoverImage';

export default function Profile({ title }: ViewProps) {
  const isMobile = useIsMobile();
  const contact = useOurContact();

  const showTabBar = useShowTabBar();
  const shouldApplyPaddingBottom = showTabBar;

  return (
    <>
      <Helmet>
        <title>{title}</title>
      </Helmet>

      {isMobile ? <MobileHeader title="Profile" /> : null}
      <div
        className="flex h-full w-full"
        style={{
          marginBottom: shouldApplyPaddingBottom ? 64 : 0,
        }}
      >
        <nav className="flex grow flex-col gap-1 p-4 md:w-64 md:shrink-0 md:border-r-2 md:border-r-gray-50 md:px-1 md:py-2">
          <ProfileCoverImage
            className="h-[345px] md:h-56"
            cover={contact.cover || ''}
          >
            <div className="absolute inset-0 flex h-[345px] w-full flex-col justify-end rounded-[36px] bg-black/30 p-6 font-normal dark:bg-white/30 md:h-56 md:rounded-lg">
              <div className="flex space-x-2">
                <Avatar size="default" icon={false} ship={window.our} />
                <div className="flex flex-col items-start justify-center space-y-1">
                  <ShipName
                    className="text-[17px] font-normal text-white dark:text-black"
                    name={window.our}
                    showAlias
                  />
                  <ShipName
                    className="text-[17px] font-normal leading-snug text-white opacity-60 dark:text-black"
                    name={window.our}
                  />
                </div>
              </div>
              {contact.bio && (
                <div className="flex flex-col space-y-3">
                  <span className="text-[17px] font-normal text-white opacity-60 dark:text-black">
                    Info
                  </span>
                  <span className="h-[84px] bg-gradient-to-b from-white via-gray-50 bg-clip-text text-[17px] leading-snug text-transparent dark:from-black">
                    {contact.bio}
                  </span>
                </div>
              )}
            </div>
          </ProfileCoverImage>
          <SidebarItem
            icon={<PersonIcon className="h-6 w-6" />}
            to={'/profile/edit'}
            showCaret
          >
            Edit Profile
          </SidebarItem>
          <SidebarItem
            to={'/profile/settings'}
            icon={<AsteriskIcon className="h-6 w-6" />}
            showCaret
          >
            App Settings
          </SidebarItem>
          {!isNativeApp() && isHosted && (
            <a
              className="no-underline"
              href="https://tlon.network/account"
              target="_blank"
              rel="noreferrer"
              aria-label="Manage Account"
            >
              <SidebarItem icon={<PersonIcon className="h-6 w-6" />}>
                Manage Account
              </SidebarItem>
            </a>
          )}
          {isNativeApp() && isHosted && (
            <button onClick={() => postActionToNativeApp('manageAccount')}>
              <SidebarItem icon={<PersonIcon className="h-6 w-6" />}>
                Manage Account
              </SidebarItem>
            </button>
          )}
          <SidebarItem
            to={'/profile/about'}
            icon={<InfoIcon className="h-6 w-6" />}
            showCaret
          >
            App Info
          </SidebarItem>
          <SidebarItem
            to={'/profile/share'}
            icon={<ShareIcon className="h-6 w-6" />}
            showCaret
          >
            Share with Friends
          </SidebarItem>
          <a
            className="no-underline"
            href="https://airtable.com/shrflFkf5UyDFKhmW"
            target="_blank"
            rel="noreferrer"
            aria-label="Submit Feedback"
          >
            <SidebarItem icon={<FeedbackIcon className="h-6 w-6" />}>
              Submit Feedback
            </SidebarItem>
          </a>
          {isNativeApp() && (
            <SidebarItem
              onClick={() => postActionToNativeApp('logout')}
              icon={<LogOutIcon className="h-6 w-6" />}
            >
              Log Out
            </SidebarItem>
          )}
        </nav>
        {!isMobile && (
          <div className="w-full">
            <Outlet />
          </div>
        )}
      </div>
    </>
  );
}
