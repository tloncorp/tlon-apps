import * as store from '@tloncorp/shared/dist/store';

import { AvatarNavIcon, NavBar, NavIcon } from './NavBar';

export const NavBarView = ({
  navigateToHome,
  navigateToNotifications,
  navigateToProfileSettings,
  currentRoute,
  currentUserId,
}: {
  navigateToHome: () => void;
  navigateToNotifications: () => void;
  navigateToProfileSettings: () => void;
  currentRoute: string;
  currentUserId: string;
}) => {
  const isRouteActive = (routeName: string) => {
    return currentRoute === routeName;
  };
  const haveUnreadUnseenActivity = store.useHaveUnreadUnseenActivity();

  return (
    <NavBar>
      <NavIcon
        type="Home"
        activeType="HomeFilled"
        isActive={isRouteActive('ChatList')}
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
      <AvatarNavIcon
        id={currentUserId}
        focused={isRouteActive('Profile')}
        onPress={navigateToProfileSettings}
      />
    </NavBar>
  );
};
