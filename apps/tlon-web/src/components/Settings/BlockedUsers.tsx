import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import ActionMenu, { Action } from '@/components/ActionMenu';
import Avatar from '@/components/Avatar';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ShipName from '@/components/ShipName';
import ShipScroller from '@/components/ShipScroller';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import { useIsMobile } from '@/logic/useMedia';
import { useBlockedShips, useUnblockShipMutation } from '@/state/chat';
import { useContact } from '@/state/contact';

const BlockedUser = React.memo(({ ship: user }: { ship: string }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const { mutate: unblockShip } = useUnblockShipMutation();
  const contact = useContact(user);
  const location = useLocation();

  const onUnblock = () => {
    unblockShip({
      ship: user,
    });
  };

  const onViewProfile = (ship: string) => {
    navigate(`/profile/${ship}`, {
      state: { backgroundLocation: location },
    });
  };

  const actions: Action[] = [
    {
      key: 'unblock',
      content: 'Unblock',
      type: 'destructive',
      onClick: onUnblock,
    },
    {
      key: 'profile',
      content: 'View Profile',
      onClick: () => onViewProfile(user),
    },
  ];

  return (
    <div key={user}>
      <ActionMenu
        className="w-full"
        open={isOpen}
        onOpenChange={setIsOpen}
        actions={actions}
      >
        <SidebarItem
          icon={<Avatar ship={user} size="default" icon={false} />}
          key={user}
        >
          <div className="flex h-full w-full flex-col items-start justify-center">
            {contact?.nickname ? (
              contact.nickname
            ) : (
              <ShipName name={user} full />
            )}
          </div>
        </SidebarItem>
      </ActionMenu>
    </div>
  );
});

export default function BlockedUsers() {
  const isMobile = useIsMobile();
  const { blocked, isLoading } = useBlockedShips();

  return (
    <div className="flex h-full w-full flex-col">
      {!isMobile ? (
        <span className="text-lg font-bold">Blocked Users</span>
      ) : null}
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="h-full overflow-auto px-4 pt-6">
          <ShipScroller
            shipLabel="blocked user"
            ships={blocked}
            shipItem={BlockedUser}
          />
        </div>
      )}
    </div>
  );
}
