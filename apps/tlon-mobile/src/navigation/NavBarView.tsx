import { useNavigationState } from '@react-navigation/native';
import * as store from '@tloncorp/shared/dist/store';
import { AvatarNavIcon, NavBar, NavIcon } from '@tloncorp/ui';

import { useCurrentUserId } from '../hooks/useCurrentUser';

const NavBarView = (props: { navigation: any }) => {
  const state = useNavigationState((state) => state);
  const isRouteActive = (routeName: string) => {
    return state.routes[state.index].name === routeName;
  };
  const { data: unreadCount } = store.useAllUnreadsCounts();
  const currentUserId = useCurrentUserId();
  const { data: contact, isLoading } = store.useContact({ id: currentUserId });

  return (
    <NavBar>
      <NavIcon
        type="Home"
        activeType="HomeFilled"
        isActive={isRouteActive('ChatList')}
        // hasUnreads={(unreadCount?.channels ?? 0) > 0}
        hasUnreads={false}
        onPress={() => props.navigation.navigate('ChatList')}
      />
      <NavIcon
        type="Notifications"
        activeType="NotificationsFilled"
        hasUnreads={false}
        isActive={isRouteActive('Activity')}
        onPress={() => props.navigation.navigate('Activity')}
      />
      {/* {contact && (
        <AvatarNavIcon
          id={currentUserId}
          contact={contact}
          isLoading={isLoading}
          focused={isRouteActive('Profile')}
          onPress={() => props.navigation.navigate('Profile')}
        />
      )} */}
      <AvatarNavIcon
        id={currentUserId}
        contact={contact ?? null}
        isLoading={isLoading}
        focused={isRouteActive('Profile')}
        onPress={() => props.navigation.navigate('Profile')}
      />
    </NavBar>
  );
};

export default NavBarView;
