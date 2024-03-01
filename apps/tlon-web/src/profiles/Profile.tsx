import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import cn from 'classnames';
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
import TlonIcon from '@/components/icons/TlonIcon';
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
      <div className="flex h-full w-full">
        <nav
          className="flex grow flex-col gap-1 overflow-auto p-4 md:w-64 md:shrink-0 md:border-r-2 md:border-r-gray-50 md:px-1 md:py-2"
          style={{
            marginBottom: shouldApplyPaddingBottom ? 148 : 0,
          }}
          data-testid="profile-menu"
        >
          <ProfileCoverImage
            cover={contact.cover || ''}
            className={cn(
              'min-h-20',
              contact.cover ? 'aspect-1' : 'bg-gray-50 dark:bg-black'
            )}
          >
            {contact.cover && (
              <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-transparent to-black/50 mix-blend-multiply" />
            )}
            <div className="absolute bottom-0 flex items-end space-y-4 p-4">
              <div className="mr-2">
                <Avatar size="default" icon={false} ship={window.our} />
              </div>
              <div className="flex flex-col space-y-1">
                <ShipName
                  className={cn(
                    'font-semibold text-lg',
                    contact.cover
                      ? 'text-white dark:text-black'
                      : 'text-black dark:text-white'
                  )}
                  name={window.our}
                  showAlias
                />
                <ShipName
                  className={cn(
                    contact.cover
                      ? 'text-white opacity-60 dark:text-black'
                      : 'text-gray-500 dark:text-white'
                  )}
                  name={window.our}
                />
              </div>
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
          <a
            className="no-underline"
            href="https://tlon.zendesk.com/hc/en-us/requests/new"
            target="_blank"
            rel="noreferrer"
            aria-label="Contact Support"
          >
            <SidebarItem icon={<TlonIcon className="m-0.5 h-5 w-5" />}>
              Contact Support
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
