import React, { useCallback, useEffect } from 'react';
import { useParams } from 'react-router';
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
import ProfileCoverImage from './ProfileCoverImage';
import FavoriteGroupGrid from './FavoriteGroupGrid';
import ProfileBio from './ProfileBio';

export default function ProfileModal() {
  const { ship } = useParams();
  const { doCopy, didCopy } = useCopy(ship || '');
  const contact = useContact(ship ? ship : '');
  const cover = contact?.cover || '';
  const dismiss = useDismissNavigate();
  const navigateByApp = useNavigateByApp();
  const pals = usePalsState();
  const { data, showConnection } = useConnectivityCheck(ship || '');

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
    navigateByApp(`/dm/${ship}`);
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
      <ProfileCoverImage className="flex items-end" cover={cover}>
        <Avatar
          icon={false}
          ship={ship}
          size="huge"
          className="translate-y-9"
        />
      </ProfileCoverImage>
      <div className="p-5 pt-14">
        <div className="flex items-center space-x-2 text-lg font-bold">
          <ShipName name={ship} showAlias />
          {contact && contact.nickname ? (
            <ShipName name={ship} className="ml-2 text-gray-600" />
          ) : null}
          {ship !== window.our && (
            <ShipConnection
              ship={ship}
              showText={false}
              status={data?.status}
            />
          )}
          <PalIcon className="ml-2" ship={ship} />
        </div>
        {contact && <ProfileBio bio={contact.bio} />}
        {contact && contact.groups.length > 0 && (
          <div className="mt-5">
            <h2 className="mb-3 font-semibold">Favorite Groups</h2>
            <FavoriteGroupGrid groupFlags={contact.groups} />
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
        <button className="button" onClick={handleMessageClick}>
          Message
        </button>
      </footer>
    </Dialog>
  );
}
