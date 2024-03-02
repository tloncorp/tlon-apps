import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import Avatar from '@/components/Avatar';
import ConfirmationModal from '@/components/ConfirmationModal';
import Dialog from '@/components/Dialog';
import PalIcon from '@/components/PalIcon';
import ShipConnection from '@/components/ShipConnection';
import ShipName from '@/components/ShipName';
import WidgetDrawer from '@/components/WidgetDrawer';
import { useDismissNavigate } from '@/logic/routing';
import { useAnalyticsEvent } from '@/logic/useAnalyticsEvent';
import { useIsMobile } from '@/logic/useMedia';
import { useCopy } from '@/logic/utils';
import {
  useBlockShipMutation,
  useIsShipBlocked,
  useShipHasBlockedUs,
  useUnblockShipMutation,
} from '@/state/chat';
import useContactState, { useContact } from '@/state/contact';
import usePalsState from '@/state/pals';
import { useConnectivityCheck } from '@/state/vitals';

import FavoriteGroupGrid from './FavoriteGroupGrid';
import ProfileBio from './ProfileBio';
import ProfileCoverImage from './ProfileCoverImage';

function ProfileContainer({
  onOpenChange,
  isMobile,
  children,
}: {
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  children: React.ReactNode;
}) {
  return isMobile ? (
    <WidgetDrawer open={true} onOpenChange={onOpenChange} className="h-[70vh]">
      {children}
    </WidgetDrawer>
  ) : (
    <Dialog
      defaultOpen
      onOpenChange={onOpenChange}
      className="overflow-y-auto p-0"
      containerClass="w-full sm:max-w-lg"
    >
      {children}
    </Dialog>
  );
}

export default function ProfileModal() {
  const [showBlock, setShowBlock] = useState(false);
  const { ship } = useParams();
  const { doCopy, didCopy } = useCopy(ship || '');
  const contact = useContact(ship ? ship : '');
  const cover = contact?.cover || '';
  const dismiss = useDismissNavigate();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const pals = usePalsState();
  const { data, showConnection } = useConnectivityCheck(ship || '');
  const { mutate: blockShip } = useBlockShipMutation();
  const { mutate: unblockShip } = useUnblockShipMutation();
  const shipIsBlocked = useIsShipBlocked(ship || '');
  const shipHasBlockedUs = useShipHasBlockedUs(ship || '');
  const isUs = ship === window.our;

  useEffect(() => {
    if (ship) {
      useContactState.getState().heed([ship]);
    }
  }, [ship]);

  const onCopy = useCallback(() => {
    doCopy();
  }, [doCopy]);

  useAnalyticsEvent('profile_view');

  if (!ship) {
    return null;
  }

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  const handleMessageClick = () => {
    navigate(`/dm/${ship}`);
  };

  const handleBlockClick = () => {
    blockShip({
      ship,
    });
    setShowBlock(false);
  };

  const handleUnblockClick = () => {
    unblockShip({
      ship,
    });
  };

  const handleCopyClick = () => {
    onCopy();
  };

  return (
    <ProfileContainer onOpenChange={onOpenChange} isMobile={isMobile}>
      <ProfileCoverImage
        className={cn(
          'flex items-end rounded-b-none',
          cover ? 'h-64' : 'h-16',
          isMobile ? 'rounded-t-[32px]' : 'rounded-t-xl'
        )}
        cover={cover}
      >
        <Avatar
          icon={false}
          ship={ship}
          size="huge"
          className="translate-x-5 translate-y-9"
        />
      </ProfileCoverImage>
      <div className="flex flex-col space-y-2 p-5 pt-14">
        <div className="flex items-center space-x-2 text-lg font-bold">
          <ShipName name={ship} showAlias />
          {contact && contact.nickname ? (
            <ShipName name={ship} className="ml-2 text-gray-600" />
          ) : null}
          <ShipConnection ship={ship} status={data?.status} />
          <PalIcon className="ml-2" ship={ship} />
        </div>
        {contact && <ProfileBio bio={contact.bio} />}
        {contact && contact.groups.length > 0 && (
          <div className="mt-5">
            <h2 className="mb-3 font-semibold">Favorite Groups</h2>
            <FavoriteGroupGrid groupFlags={contact.groups} />
          </div>
        )}
        {shipHasBlockedUs && (
          <div className="mt-5">
            <h2 className="mb-3 font-semibold">Blocked</h2>
            <p className="text-gray-600">
              This user has blocked you. You will not be able to send messages
              to them.
            </p>
          </div>
        )}
        {shipIsBlocked && (
          <div className="mt-5">
            <h2 className="mb-3 font-semibold">Blocked</h2>
            <p className="text-gray-600">
              You have blocked this user. You will not be able to send messages
              to them.
            </p>
          </div>
        )}
      </div>
      <footer className="flex flex-col space-y-2 px-6 py-4">
        <div className="flex items-center justify-end space-x-2">
          {pals.installed &&
            ship !== window.our &&
            (pals.pals.outgoing[ship.slice(1)] ? (
              <button
                className="secondary-button bg-red-100 dark:bg-red dark:text-white"
                onClick={() => pals.removePal(ship.slice(1))}
              >
                Remove Pal
              </button>
            ) : (
              <button
                className="secondary-button"
                onClick={() => pals.addPal(ship.slice(1))}
              >
                Add Pal
              </button>
            ))}
          {!shipHasBlockedUs && (
            <button className="button" onClick={handleMessageClick}>
              Message
            </button>
          )}
        </div>
        <div className="flex items-center justify-end space-x-2">
          <button className="secondary-button" onClick={handleCopyClick}>
            {didCopy ? 'Copied!' : 'Copy Name'}
          </button>
          {!isUs &&
            (shipIsBlocked ? (
              <button className="secondary-button" onClick={handleUnblockClick}>
                Unblock User
              </button>
            ) : (
              <button
                className="secondary-button"
                onClick={() => setShowBlock(true)}
              >
                Block User
              </button>
            ))}
        </div>
      </footer>
      <ConfirmationModal
        open={showBlock}
        setOpen={setShowBlock}
        title="Block User"
        message="Are you sure you want to block this user?"
        onConfirm={handleBlockClick}
      />
    </ProfileContainer>
  );
}
