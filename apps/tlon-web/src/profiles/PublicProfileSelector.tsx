import cn from 'classnames';
import { useState } from 'react';

import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import CheckIcon from '@/components/icons/CheckIcon';
import CopyIcon from '@/components/icons/CopyIcon';
import GlobeIcon from '@/components/icons/GlobeIcon';
import NewRaysIcon from '@/components/icons/NewRaysIcon';
import { useCopy } from '@/logic/utils';
import {
  useMakeProfilePrivateMutation,
  useMakeProfilePublicMutation,
  useProfileIsPublic,
} from '@/state/profile/profile';

import EditPublicProfile from './EditPublicProfile';

export default function PublicProfileSelector({
  isMobile = true,
}: {
  isMobile?: boolean;
}) {
  const profileIsPublic = useProfileIsPublic();
  const [fakeLoading, setFakeLoading] = useState(false); // ~give it a minute~
  const { mutate: makePublic, isLoading: pubLoading } =
    useMakeProfilePublicMutation();
  const { mutate: makePrivate, isLoading: privLoading } =
    useMakeProfilePrivateMutation();
  const profileLoading = pubLoading || privLoading || fakeLoading;
  const { doCopy, didCopy } = useCopy(`${window.location.origin}/profile`);
  const [editProfileOpen, setEditProfileOPen] = useState(false);

  const toggleProfile = () => {
    setFakeLoading(true);
    if (profileIsPublic) {
      makePrivate();
    } else {
      makePublic();
    }
    setTimeout(() => {
      setFakeLoading(false);
    }, 3000);
  };

  // unless manually enabled in the dojo, hide public profliles for now
  if (!profileIsPublic) {
    return null;
  }

  return (
    <>
      <SidebarItem
        unclamped
        color="text-gray-900"
        fontWeight={isMobile ? 'font-normal' : 'font-semibold'}
        fontSize="text-[17px]"
        className="leading-5"
        onClick={() => toggleProfile()}
        icon={
          <div className="flex h-12 w-12 items-center justify-center">
            <GlobeIcon className="h-7 w-7 text-gray-400" />
          </div>
        }
        actions={
          <div className="flex items-center">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full',
                profileIsPublic ? 'bg-blue dark:bg-blue-soft' : 'bg-gray-200'
              )}
            >
              {profileLoading ? (
                <LoadingSpinner
                  className="h-4 w-4"
                  secondary={'fill-gray-100 dark:fill-gray-200'}
                />
              ) : profileIsPublic ? (
                <CheckIcon className="h-4 w-4 text-white dark:text-black" />
              ) : null}
            </div>
          </div>
        }
      >
        Public Profile{' '}
        <span className="relative bottom-[2px] ml-2 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-400">
          NEW
        </span>
      </SidebarItem>

      {!profileLoading && profileIsPublic && (
        <div
          className={cn(
            'flex w-full items-center justify-center pl-4 pr-2',
            !isMobile && 'mt-3'
          )}
        >
          <div className="flex w-full flex-col rounded-xl bg-gray-400 p-0 dark:bg-gray-200">
            <button
              onClick={doCopy}
              className="flex w-full items-center justify-between gap-2 rounded-t-xl bg-gray-200 px-6 py-6 text-lg text-black dark:bg-blue-soft"
            >
              {`${window.location.origin}/profile`}
              <span
                className={cn('flex items-center justify-center rounded-full')}
              >
                {didCopy ? (
                  <CheckIcon className="h-6 w-6 text-black" />
                ) : (
                  <CopyIcon className="h-6 w-6 text-black" />
                )}
              </span>
            </button>
            <button
              onClick={() => setEditProfileOPen(true)}
              className="flex w-full items-center justify-start py-3 pl-6 text-lg text-white dark:text-black"
            >
              <NewRaysIcon className="mr-2 h-4 w-4" /> Customize
            </button>
          </div>
          <EditPublicProfile
            open={editProfileOpen}
            onOpenChange={(o) => setEditProfileOPen(o)}
          />
        </div>
      )}
    </>
  );
}
