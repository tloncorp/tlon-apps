import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ViewProps } from '@/types/groups';
import Layout from '@/components/Layout/Layout';
import { useIsMobile } from '@/logic/useMedia';
import { useOurContact } from '@/state/contact';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import FeedbackIcon from '@/components/icons/FeedbackIcon';
import GiftIcon from '@/components/icons/GiftIcon';
import InfoIcon from '@/components/icons/InfoIcon';
import AsteriskIcon from '@/components/icons/AsteriskIcon';
import MobileHeader from '@/components/MobileHeader';
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
  const isMobile = useIsMobile();
  const contact = useOurContact();

  return (
    <Layout
      header={isMobile ? <MobileHeader title="Profile" /> : null}
      className="flex-1 px-4 pt-4 font-system-sans"
    >
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <motion.div
        initial="initial"
        animate="in"
        exit="out"
        variants={pageAnimationVariants}
        transition={pageTransition}
        className="flex flex-col justify-center space-y-4 pt-[10px]"
      >
        <ProfileCoverImage
          className="flex h-[345px] w-full flex-col justify-between rounded-[36px] px-6 pt-6 shadow-2xl"
          cover={contact.cover || ''}
        >
          <div className="flex w-full justify-end">
            <Link
              to="/profile/edit"
              className="text-[18px] font-normal text-white"
            >
              Edit
            </Link>
          </div>
          <div className="flex flex-col space-y-6">
            <div className="flex space-x-2">
              <Avatar size="big" icon={false} ship={window.our} />
              <div className="flex flex-col items-start justify-center space-y-1">
                <ShipName
                  className="text-[18px] font-normal text-white"
                  name={window.our}
                  showAlias
                />
                <ShipName
                  className="text-[17px] font-normal leading-snug text-white opacity-60"
                  name={window.our}
                />
              </div>
            </div>
            {contact.bio && (
              <div className="flex flex-col space-y-3">
                <span className="text-[18px] font-normal text-white opacity-60">
                  Info
                </span>
                <span className="h-[84px] bg-gradient-to-b from-white via-gray-50 bg-clip-text text-[17px] leading-snug text-transparent">
                  {contact.bio}
                </span>
              </div>
            )}
          </div>
        </ProfileCoverImage>
        <nav className="flex flex-col space-y-1">
          <Link to="/profile/settings" className="no-underline">
            <SidebarItem
              color="text-gray-900"
              fontWeight="font-normal"
              fontSize="text-[18px]"
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
              fontSize="text-[18px]"
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
              fontSize="text-[18px]"
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
              fontSize="text-[18px]"
              className="leading-5"
              icon={
                <div className="flex h-12 w-12 items-center justify-center">
                  <GiftIcon className="h-6 w-6 text-gray-400" />
                </div>
              }
            >
              Share with Friends
            </SidebarItem>
          </a>
        </nav>
      </motion.div>
    </Layout>
  );
}
