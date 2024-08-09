import * as store from '@tloncorp/shared/dist/store';

import { useCurrentUserId } from '../contexts';
import { AvatarNavIcon, NavBar, NavIcon } from './NavBar';

export const NavBarView = ({
  navigateToHome,
  navigateToNotifications,
  navigateToProfile,
  currentRoute,
}: {
  navigateToHome: () => void;
  navigateToNotifications: () => void;
  navigateToProfile: () => void;
  currentRoute: string;
}) => {
  const isRouteActive = (routeName: string) => {
    return currentRoute === routeName;
  };
  const haveUnreadUnseenActivity = store.useHaveUnreadUnseenActivity();
  const currentUserId = useCurrentUserId();

  return (
    <NavBar>
      <NavIcon
        type="Home"
        activeType="HomeFilled"
        isActive={isRouteActive('ChatList')}
        // hasUnreads={(unreadCount?.channels ?? 0) > 0}
        // intentionally leave undotted for now
        hasUnreads={false}
        onPress={() => navigateToHome()}
      />
      <NavIcon
        type="Notifications"
        activeType="NotificationsFilled"
        hasUnreads={haveUnreadUnseenActivity}
        isActive={isRouteActive('Activity')}
        onPress={() => navigateToNotifications()}
      />
      <AvatarNavIcon
        id={currentUserId}
        focused={isRouteActive('Profile')}
        onPress={() => navigateToProfile()}
      />
    </NavBar>
  );
};
