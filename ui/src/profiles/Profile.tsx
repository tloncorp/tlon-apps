import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ViewProps } from '@/types/groups';
import { useIsMobile } from '@/logic/useMedia';
import { useOurContact } from '@/state/contact';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import FeedbackIcon from '@/components/icons/FeedbackIcon';
import GiftIcon from '@/components/icons/GiftIcon';
import InfoIcon from '@/components/icons/InfoIcon';
import AsteriskIcon from '@/components/icons/AsteriskIcon';
import LogOutIcon from '@/components/icons/LogOutIcon';
import MobileHeader from '@/components/MobileHeader';
import { isNativeApp, postActionToNativeApp } from '@/logic/native';
import PersonIcon from '@/components/icons/PersonIcon';
import { isHosted } from '@/logic/utils';
import WidgetDrawer from '@/components/WidgetDrawer';
import { useEffect, useState } from 'react';
import QRWidget from '@/components/QRWidget';
import XIcon from '@/components/icons/XIcon';
import MessagesIcon from '@/components/icons/MessagesIcon';
import { Drawer } from 'vaul';
import { createDeepLink } from '@/logic/branch';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ProfileCoverImage from './ProfileCoverImage';

export default function Profile({ title }: ViewProps) {
  const [dmLink, setDmLink] = useState('');
  const isMobile = useIsMobile();
  const contact = useOurContact();
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    async function getLink() {
      const dmPath = `dm/${window.our}`;
      const canonicalUrl = `https://${
        import.meta.env.VITE_BRANCH_DOMAIN
      }/${dmPath}`;
      const link = await createDeepLink(canonicalUrl, dmPath);
      setDmLink(link || '');
    }
    getLink();
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Helmet>
        <title>{title}</title>
      </Helmet>
      {isMobile ? <MobileHeader title="Profile" /> : null}
      <div className="flex grow flex-col overflow-y-auto bg-white">
        <div className="px-4">
          <ProfileCoverImage
            className="m-auto h-[345px] w-full shadow-2xl"
            cover={contact.cover || ''}
          >
            <Link
              to="/profile/edit"
              className="absolute inset-0 flex h-[345px] w-full flex-col justify-between rounded-[36px] bg-black/30 p-6 font-normal dark:bg-white/30"
            >
              <div className="flex w-full justify-end">
                <Link
                  to="/profile/edit"
                  className="text-[17px] font-normal text-white dark:text-black"
                >
                  Edit
                </Link>
              </div>
              <div className="flex flex-col space-y-6">
                <div className="flex space-x-2">
                  <Avatar size="big" icon={false} ship={window.our} />
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
            </Link>
          </ProfileCoverImage>
        </div>
        <nav className="flex grow flex-col justify-between gap-1 p-4">
          <div className="space-y-1">
            <SidebarItem
              onClick={() => setQrOpen(true)}
              color="text-gray-900"
              fontWeight="font-normal"
              fontSize="text-[17px]"
              className="leading-5"
              icon={
                <div className="flex h-12 w-12 items-center justify-center">
                  <MessagesIcon className="h-5 w-5 text-gray-400" />
                </div>
              }
            >
              Connect with Others
            </SidebarItem>
            <Link to="/profile/settings" className="no-underline">
              <SidebarItem
                color="text-gray-900"
                fontWeight="font-normal"
                fontSize="text-[17px]"
                className="leading-5"
                showCaret
                icon={
                  <div className="flex h-12 w-12 items-center justify-center">
                    <AsteriskIcon className="h-6 w-6 text-gray-400" />
                  </div>
                }
              >
                App Settings
              </SidebarItem>
            </Link>
            <Link to="/profile/about" className="no-underline">
              <SidebarItem
                color="text-gray-900"
                fontWeight="font-normal"
                fontSize="text-[17px]"
                className="leading-5"
                showCaret
                icon={
                  <div className="flex h-12 w-12 items-center justify-center">
                    <InfoIcon className="h-6 w-6 text-gray-400" />
                  </div>
                }
              >
                About Groups
              </SidebarItem>
            </Link>
            {!isNativeApp() && isHosted && (
              <a
                className="no-underline"
                href="https://tlon.network/account"
                target="_blank"
                rel="noreferrer"
                aria-label="Manage Account"
              >
                <SidebarItem
                  color="text-gray-900"
                  fontWeight="font-normal"
                  fontSize="text-[17px]"
                  className="leading-5"
                  icon={
                    <div className="flex h-12 w-12 items-center justify-center">
                      <PersonIcon className="h-8 w-8 text-gray-400" />
                    </div>
                  }
                >
                  Manage Account
                </SidebarItem>
              </a>
            )}
            {isNativeApp() && isHosted && (
              <button onClick={() => postActionToNativeApp('manageAccount')}>
                <SidebarItem
                  color="text-gray-900"
                  fontWeight="font-normal"
                  fontSize="text-[17px]"
                  className="leading-5"
                  icon={
                    <div className="flex h-12 w-12 items-center justify-center">
                      <PersonIcon className="h-8 w-8 text-gray-400" />
                    </div>
                  }
                >
                  Manage Account
                </SidebarItem>
              </button>
            )}
            <a
              className="no-underline"
              href="https://tlon.network/lure/~nibset-napwyn/tlon?id=186c283508814a3-073b187e44f6fa-1f525634-384000-186c28350892a15"
              target="_blank"
              rel="noreferrer"
              aria-label="Share with Friends"
            >
              <SidebarItem
                color="text-gray-900"
                fontWeight="font-normal"
                fontSize="text-[17px]"
                className="leading-5"
                icon={
                  <div className="flex h-12 w-12 items-center justify-center">
                    <GiftIcon className="h-6 w-6 -rotate-12 text-gray-400" />
                  </div>
                }
              >
                Share with Friends
              </SidebarItem>
            </a>
            <a
              className="no-underline"
              href="https://airtable.com/shrflFkf5UyDFKhmW"
              target="_blank"
              rel="noreferrer"
              aria-label="Submit Feedback"
            >
              <SidebarItem
                color="text-gray-900"
                fontWeight="font-normal"
                fontSize="text-[17px]"
                className="leading-5"
                icon={
                  <div className="flex h-12 w-12 items-center justify-center">
                    <FeedbackIcon className="h-6 w-6 text-gray-400" />
                  </div>
                }
              >
                Submit Feedback
              </SidebarItem>
            </a>
          </div>
          {isNativeApp() ? (
            <button
              className="flex items-center justify-between gap-1 rounded-lg px-6 py-4 text-[17px] leading-5 text-gray-600 hover:bg-gray-50 active:bg-gray-50 sm:text-base"
              onClick={() => postActionToNativeApp('logout')}
            >
              Log Out
              <LogOutIcon className="h-6 w-6 text-gray-200" />
            </button>
          ) : null}
        </nav>
      </div>
      <WidgetDrawer
        open={qrOpen}
        onOpenChange={setQrOpen}
        className="h-[60vh] px-10 py-8"
      >
        <div className="flex-shrink">
          <div className="flex w-full justify-between">
            <h3 className="text-lg">Connect with Others</h3>
            <Drawer.Close>
              <XIcon className="h-5 w-5" />
            </Drawer.Close>
          </div>
          <p className="pt-1.5 pr-10 text-gray-400">
            Anybody on Tlon can use this link to send you a direct message.
          </p>
        </div>
        <div className="mt-8 flex-1">
          {dmLink ? (
            <QRWidget
              link={dmLink}
              navigatorTitle={`Connect with ${window.our}`}
            />
          ) : (
            <LoadingSpinner className="h-4 w-4" />
          )}
        </div>
      </WidgetDrawer>
    </div>
  );
}
