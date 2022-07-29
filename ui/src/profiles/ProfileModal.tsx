import React, { useState, useCallback } from 'react';
import { useCopyToClipboard } from 'usehooks-ts';
import { useNavigate, useParams } from 'react-router';
import { useDismissNavigate } from '@/logic/routing';
import { useContact } from '@/state/contact';
import Avatar from '@/components/Avatar';
import Dialog, { DialogContent } from '@/components/Dialog';
import ShipName from '@/components/ShipName';
import ProfileCoverImage from './ProfileCoverImage';
import FavoriteGroupGrid from './FavoriteGroupGrid';
import ProfileBio from './ProfileBio';

export default function ProfileModal() {
  const [_copied, doCopy] = useCopyToClipboard();
  const [copyButtonText, setCopyButtonText] = useState('Copy Name');
  const { ship } = useParams();
  const navigate = useNavigate();
  const contact = useContact(ship ? ship : '');
  const dismiss = useDismissNavigate();

  const onCopy = useCallback(() => {
    doCopy(ship || '');
    setCopyButtonText('Copied!');
    setTimeout(() => {
      setCopyButtonText('Copy Group Link');
    }, 1000);
  }, [doCopy, ship]);

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

  const handleCopyClick = () => {
    onCopy();
  };

  if (!contact) {
    return (
      <Dialog defaultOpen onOpenChange={onOpenChange}>
        <DialogContent
          className="overflow-y-auto p-0"
          containerClass="w-full sm:max-w-lg"
        >
          <ProfileCoverImage className="flex items-end" ship={ship}>
            <Avatar ship={ship} size="huge" className="translate-y-9" />
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
              {copyButtonText}
            </button>
            <button className="button ml-2" onClick={handleMessageClick}>
              Message
            </button>
          </footer>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog defaultOpen onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-y-auto p-0"
        containerClass="w-full sm:max-w-lg"
      >
        <ProfileCoverImage className="flex items-end" ship={ship}>
          <Avatar ship={ship} size="huge" className="translate-y-9" />
        </ProfileCoverImage>
        <div className="p-5 pt-14">
          <div className="text-lg font-bold">
            <ShipName name={ship} showAlias />
            {contact.nickname ? (
              <ShipName name={ship} className="ml-2 text-gray-600" />
            ) : null}
          </div>
          <ProfileBio bio={contact.bio} />
          {contact.groups.length > 0 && (
            <div className="mt-5">
              <h2 className="mb-3 font-semibold">Favorite Groups</h2>
              <FavoriteGroupGrid groupFlags={contact.groups} />
            </div>
          )}
        </div>
        <footer className="flex items-center py-4 px-6">
          <button
            className="secondary-button ml-auto"
            onClick={handleCopyClick}
          >
            {copyButtonText}
          </button>
          <button className="button ml-2" onClick={handleMessageClick}>
            Message
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
