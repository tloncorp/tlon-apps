import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useDismissNavigate } from '@/logic/routing';
import { useCopy } from '@/logic/utils';
import useContactState, { useContact } from '@/state/contact';
import Avatar from '@/components/Avatar';
import Dialog from '@/components/Dialog';
import ShipName from '@/components/ShipName';
import PalIcon from '@/components/PalIcon';
import usePalsState from '@/state/pals';
import useNavigateByApp from '@/logic/useNavigateByApp';
import { useAnalyticsEvent } from '@/logic/useAnalyticsEvent';
import ShipConnection from '@/components/ShipConnection';
import { useConnectivityCheck } from '@/state/vitals';
import { isNativeApp } from '@/logic/native';
import {
  useBlockShipMutation,
  useIsShipBlocked,
  useShipHasBlockedUs,
  useUnblockShipMutation,
} from '@/state/chat';
import ConfirmationModal from '@/components/ConfirmationModal';
import ProfileCoverImage from './ProfileCoverImage';
import FavoriteGroupGrid from './FavoriteGroupGrid';
import ProfileBio from './ProfileBio';

export default function ProfileModal() {
  const [showBlock, setShowBlock] = useState(false);
  const { ship } = useParams();
  const { doCopy, didCopy } = useCopy(ship || '');
  const contact = useContact(ship ? ship : '');
  const cover = contact?.cover || '';
  const dismiss = useDismissNavigate();
  const navigate = useNavigate();
  const navigateByApp = useNavigateByApp();
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
    if (isNativeApp()) {
      navigate(`/dm/${ship}`);
    } else {
      navigateByApp(`/dm/${ship}`);
    }
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
    <Dialog
      defaultOpen
      onOpenChange={onOpenChange}
      className="overflow-y-auto p-0"
      containerClass="w-full sm:max-w-lg"
    >
      <ProfileCoverImage
        className="flex items-end rounded-t-xl rounded-b-none"
        cover={cover}
      >
        <Avatar
          icon={false}
          ship={ship}
          size="huge"
          className="translate-y-9"
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
            <h2 className="mb-3 font-semibold">Blocked You</h2>
            <p className="text-gray-600">
              This user has blocked you. You will not be able to send messages
              to them.
            </p>
          </div>
        )}
      </div>
      <footer className="flex items-center justify-end space-x-2 py-4 px-6">
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
        {!shipHasBlockedUs && (
          <button className="button" onClick={handleMessageClick}>
            Message
          </button>
        )}
      </footer>
      <ConfirmationModal
        open={showBlock}
        setOpen={setShowBlock}
        title="Block User"
        message="Are you sure you want to block this user?"
        onConfirm={handleBlockClick}
      />
    </Dialog>
  );
}
