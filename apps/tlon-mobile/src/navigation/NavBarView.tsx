import { useNavigationState } from '@react-navigation/native';
import * as store from '@tloncorp/shared/dist/store';
import { AvatarNavIcon, NavBar, NavIcon } from '@tloncorp/ui';

import { useCurrentUserId } from '../hooks/useCurrentUser';

const NavBarView = (props: { navigation: any }) => {
  const state = useNavigationState((state) => state);
  const isRouteActive = (routeName: string) => {
    return state.routes[state.index].name === routeName;
  };
  const haveUnseenActivity = store.useHaveUnseenActivity();
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
        onPress={() => props.navigation.navigate('ChatList')}
      />
      <NavIcon
        type="Notifications"
        activeType="NotificationsFilled"
        hasUnreads={haveUnseenActivity}
        isActive={isRouteActive('Activity')}
        onPress={() => props.navigation.navigate('Activity')}
      />
      <AvatarNavIcon
        id={currentUserId}
        focused={isRouteActive('Profile')}
        onPress={() => props.navigation.navigate('Profile')}
      />
    </NavBar>
  );
};

export default NavBarView;
