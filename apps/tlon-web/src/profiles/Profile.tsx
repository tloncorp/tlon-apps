import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import cn from 'classnames';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Drawer } from 'vaul';

import Avatar from '@/components/Avatar';
import MobileHeader from '@/components/MobileHeader';
import QRWidget, { QRWidgetPlaceholder } from '@/components/QRWidget';
import ShipName from '@/components/ShipName';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import WidgetDrawer from '@/components/WidgetDrawer';
import AsteriskIcon from '@/components/icons/AsteriskIcon';
import CheckIcon from '@/components/icons/CheckIcon';
import CopyIcon from '@/components/icons/CopyIcon';
import FeedbackIcon from '@/components/icons/FeedbackIcon';
import GiftIcon from '@/components/icons/GiftIcon';
import InfoIcon from '@/components/icons/InfoIcon';
import LogOutIcon from '@/components/icons/LogOutIcon';
import MessagesIcon from '@/components/icons/MessagesIcon';
import PersonIcon from '@/components/icons/PersonIcon';
import XIcon from '@/components/icons/XIcon';
import { createDeepLink, getDmLink } from '@/logic/branch';
import {
  isAndroidWebView,
  isIOSWebView,
  isNativeApp,
  postActionToNativeApp,
} from '@/logic/native';
import { useIsMobile } from '@/logic/useMedia';
import { isHosted, useCopy, useIsHttps } from '@/logic/utils';
import { useOurContact } from '@/state/contact';

import ProfileCoverImage from './ProfileCoverImage';
import PublicProfileSelector from './PublicProfileSelector';

export function ShareApp() {
  let link = 'https://tlon.io/';
  if (isAndroidWebView()) {
    link =
      'https://play.google.com/store/apps/details?id=io.tlon.groups&hl=en&gl=US';
  }
  if (isIOSWebView()) {
    link = 'https://apps.apple.com/us/app/tlon-the-urbit-app/id6451392109';
  }
  const { didCopy, doCopy } = useCopy(link);
  const handleCopy = () => {
    if (navigator.share !== undefined) {
      navigator.share({
        title: 'Join me on Tlon',
        url: link,
      });
    } else {
      doCopy();
    }
  };

  return (
    <SidebarItem
      color="text-gray-900"
      fontWeight="font-normal"
      fontSize="text-[17px]"
      className="leading-5"
      onClick={handleCopy}
      icon={
        <div className="flex h-12 w-12 items-center justify-center">
          {navigator.share !== undefined ? (
            <GiftIcon className="h-6 w-6 -rotate-12 text-gray-400" />
          ) : didCopy ? (
            <CheckIcon className="w-6 text-gray-400" />
          ) : (
            <CopyIcon className="w-6 text-gray-400" />
          )}
        </div>
      }
    >
      {didCopy ? 'Copied!' : 'Share with Friends'}
    </SidebarItem>
  );
}

export default function Profile({ title }: ViewProps) {
  const [dmLink, setDmLink] = useState('');
  const isMobile = useIsMobile();
  const contact = useOurContact();
  const isHttps = useIsHttps();
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    async function populateLink() {
      const link = await getDmLink();
      setDmLink(link || '');
    }
    populateLink();
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
            <PublicProfileSelector />
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
                About
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
            {isNativeApp() && isHttps && <ShareApp />}
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
        <div className="shrink">
          <div className="flex w-full justify-between">
            <h3 className="text-lg">Connect with Others</h3>
            <Drawer.Close>
              <XIcon className="h-5 w-5" />
            </Drawer.Close>
          </div>
          <p className="pr-10 pt-1.5 text-gray-400">
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
            <QRWidgetPlaceholder />
          )}
        </div>
      </WidgetDrawer>
    </div>
  );
}
