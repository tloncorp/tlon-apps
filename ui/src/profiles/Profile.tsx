import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { ViewProps } from '@/types/groups';
import { useIsDark, useIsMobile } from '@/logic/useMedia';
import { useOurContact } from '@/state/contact';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import FeedbackIcon from '@/components/icons/FeedbackIcon';
import GiftIcon from '@/components/icons/GiftIcon';
import InfoIcon from '@/components/icons/InfoIcon';
import AsteriskIcon from '@/components/icons/AsteriskIcon';
import MobileHeader from '@/components/MobileHeader';
import Sheet, { SheetContent } from '@/components/Sheet';
import clipboardCopy from 'clipboard-copy';
import ProfileCoverImage from './ProfileCoverImage';

const pageAnimationVariants = {
  initial: {
    opacity: 0,
    x: '-100vw',
  },
  in: {
    opacity: 1,
    x: 0,
  },
  out: {
    opacity: 0,
    x: '100vw',
  },
};

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.2,
};

export default function Profile({ title }: ViewProps) {
  const [showSheet, setShowSheet] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDark = useIsDark();
  const isMobile = useIsMobile();
  const contact = useOurContact();

  const resetSheet = () => {
    setShowSheet(false);
    setShowQR(false);
  };

  const handleSharing = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Tlon Local',
          url: 'https://tlon.network/lure/~nibset-napwyn/tlon',
          text: 'Join me in Tlon Local, where the future is always under construction.',
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log(error);
      }
    } else {
      setCopied(true);
      clipboardCopy('https://tlon.network/lure/~nibset-napwyn/tlon');
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCopied(false);
    }, 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Helmet>
        <title>{title}</title>
      </Helmet>
      {isMobile ? <MobileHeader title="Profile" /> : null}
      <motion.div
        initial="initial"
        animate="in"
        exit="out"
        variants={pageAnimationVariants}
        transition={pageTransition}
        className="grow overflow-y-auto bg-white"
      >
        <div className="px-4">
          <ProfileCoverImage
            className="m-auto h-[345px] w-full shadow-2xl"
            cover={contact.cover || ''}
          >
            <Link
              to="/profile/edit"
              className="absolute inset-0 flex h-[345px] w-full flex-col justify-between rounded-[36px] bg-black/30 px-6 pt-6 font-normal dark:bg-white/30"
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
        <nav className="flex flex-col space-y-1 px-4">
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
            onClick={() => setShowSheet(true)}
          >
            Share with Friends
          </SidebarItem>
        </nav>
      </motion.div>
      <Sheet open={showSheet} onOpenChange={() => resetSheet()}>
        <SheetContent showClose={false}>
          {!showQR && (
            <div>
              <SidebarItem
                color="text-gray-900"
                fontWeight="font-normal"
                icon={null}
                className="py-3"
                onClick={() => setShowQR(true)}
              >
                Scan QR code
              </SidebarItem>
              <SidebarItem
                color="text-gray-900"
                fontWeight="font-normal"
                icon={null}
                className="py-3"
                onClick={() => handleSharing()}
              >
                {copied ? 'Link copied to clipboard' : 'Share invite link'}
              </SidebarItem>
            </div>
          )}
          {showQR && (
            <div className="py-3">
              <QRCodeSVG
                value={'https://tlon.network/lure/~nibset-napwyn/tlon'}
                size={264}
                bgColor={isDark ? '#000000' : '#ffffff'}
                fgColor={isDark ? '#ffffff' : '#000000'}
                level={'H'}
                includeMargin={false}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
