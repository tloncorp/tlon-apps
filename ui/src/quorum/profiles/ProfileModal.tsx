import React, { useCallback, useEffect } from 'react';
import { useParams } from 'react-router';
import { stringToTa } from "@urbit/api";
import { useDismissNavigate } from '@/logic/routing';
import { useCopy } from '@/logic/utils';
import useContactState, { useContact } from '@/state/contact';
import Avatar from '@/components/Avatar';
import Dialog from '@/components/Dialog';
import ShipName from '@/components/ShipName';
import { useAnchorNavigate } from '@/logic/routing';
import { encodeQuery } from '@/logic/quorum-utils';
// import useNavigateByApp from '@/logic/useNavigateByApp';
import ProfileCoverImage from './ProfileCoverImage';
// import FavoriteGroupGrid from './FavoriteGroupGrid';
import ProfileBio from './ProfileBio';

export default function QuorumProfileModal() {
  const { ship } = useParams();
  const { doCopy, didCopy } = useCopy(ship || '');
  const contact = useContact(ship ? ship : '');
  const cover = contact?.cover || '';
  const dismiss = useDismissNavigate();
  const anchorNavigate = useAnchorNavigate();
  // const navigateByApp = useNavigateByApp();

  useEffect(() => {
    if (ship) {
      useContactState.getState().heed([ship]);
    }
  }, [ship]);

  const onCopy = useCallback(() => {
    doCopy();
  }, [doCopy]);

  if (!ship) {
    return null;
  }

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  const handleMessageClick = () => {
    // navigateByApp(`/dm/${ship}`);
    anchorNavigate(`./search/${encodeQuery(`author:${ship}`)}`);
  };

  const handleCopyClick = () => {
    onCopy();
  };

  if (!contact) {
    return (
      <Dialog
        defaultOpen
        onOpenChange={onOpenChange}
        className="overflow-y-auto p-0"
        containerClass="w-full sm:max-w-lg"
      >
        <ProfileCoverImage className="flex items-end" cover={cover}>
          <Avatar
            ship={ship}
            icon={false}
            size="huge"
            className="translate-y-9"
          />
        </ProfileCoverImage>
        <div className="p-5 pt-14">
          <div className="text-lg font-bold">
            <ShipName name={ship} showAlias />
          </div>
        </div>
        <footer className="flex items-center py-4 px-6">
          <button
            className="secondary-button ml-auto"
            onClick={handleCopyClick}
          >
            {didCopy ? 'Copied!' : 'Copy Name'}
          </button>
          <button className="button ml-2" onClick={handleMessageClick}>
            View Posts
          </button>
        </footer>
      </Dialog>
    );
  }

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
        <div className="text-lg font-bold">
          <ShipName name={ship} showAlias />
          {contact.nickname ? (
            <ShipName name={ship} className="ml-2 text-gray-600" />
          ) : null}
        </div>
        <ProfileBio bio={contact.bio} />
        {/*contact.groups.length > 0 && (
          <div className="mt-5">
            <h2 className="mb-3 font-semibold">Favorite Groups</h2>
            <FavoriteGroupGrid groupFlags={contact.groups} />
          </div>
        )*/}
      </div>
      <footer className="flex items-center py-4 px-6">
        <button className="secondary-button ml-auto" onClick={handleCopyClick}>
          {didCopy ? 'Copied!' : 'Copy Name'}
        </button>
        <button className="button ml-2" onClick={handleMessageClick}>
          View Posts
        </button>
      </footer>
    </Dialog>
  );
}
