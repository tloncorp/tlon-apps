import * as store from '@tloncorp/shared/store';
import { useCallback, useState } from 'react';

import useIsWindowNarrow from '../hooks/useIsWindowNarrow';
import { triggerHaptic } from '../utils';
import { AvatarNavIcon, NavBar, NavIcon } from './NavBar';
import ProfileStatusSheet from './ProfileStatusSheet';

export const NavBarView = ({
  navigateToHome,
  navigateToNotifications,
  navigateToProfileSettings,
  navigateToContacts,
  currentRoute,
  currentUserId,
  showContactsTab,
}: {
  navigateToHome: () => void;
  navigateToNotifications: () => void;
  navigateToProfileSettings: () => void;
  navigateToContacts?: () => void;
  currentRoute: string;
  currentUserId: string;
  showContactsTab?: boolean;
}) => {
  const [showStatusSheet, setShowStatusSheet] = useState(false);
  const isRouteActive = (routeName: string | string[]) => {
    if (Array.isArray(routeName)) {
      return routeName.includes(currentRoute);
    }
    return currentRoute === routeName;
  };
  const haveUnreadUnseenActivity = store.useHaveUnreadUnseenActivity();
  const isWindowNarrow = useIsWindowNarrow();

  const openStatusSheet = useCallback(() => {
    triggerHaptic('sheetOpen');
    setShowStatusSheet(true);
  }, []);

  const closeStatusSheet = useCallback(() => {
    setShowStatusSheet(false);
  }, []);

  const handleUpdateStatus = useCallback(
    (newStatus: string) => {
      store.updateCurrentUserProfile({ status: newStatus });
      closeStatusSheet();
    },
    [closeStatusSheet]
  );

  if (!isWindowNarrow) {
    return null;
  }

  return (
    <NavBar>
      <NavIcon
        type="Home"
        activeType="HomeFilled"
        isActive={isRouteActive(
          showContactsTab ? 'ChatList' : ['ChatList', 'Contacts']
        )}
        // hasUnreads={(unreadCount?.channels ?? 0) > 0}
        // intentionally leave undotted for now
        hasUnreads={false}
        onPress={navigateToHome}
      />
      <NavIcon
        type="Notifications"
        activeType="NotificationsFilled"
        hasUnreads={haveUnreadUnseenActivity}
        isActive={isRouteActive('Activity')}
        onPress={navigateToNotifications}
      />
      {showContactsTab ? (
        <NavIcon
          type="ChannelNotebooks"
          activeType="ChannelNotebooks"
          isActive={isRouteActive('Contacts')}
          onPress={navigateToContacts}
        />
      ) : (
        <AvatarNavIcon
          id={currentUserId}
          focused={isRouteActive('Profile')}
          onPress={navigateToProfileSettings}
          onLongPress={openStatusSheet}
        />
      )}
      {showStatusSheet && (
        <ProfileStatusSheet
          open={showStatusSheet}
          onOpenChange={closeStatusSheet}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </NavBar>
  );
};
