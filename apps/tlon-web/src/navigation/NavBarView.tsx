import * as store from '@tloncorp/shared/dist/store';
import { AvatarNavIcon, NavBar, NavIcon } from '@tloncorp/ui';
import { useLocation, useNavigate } from 'react-router';

import { useCurrentUserId } from '../hooks/useCurrentUser';

const NavBarView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isRouteActive = (routeName: string) =>
    location.pathname.startsWith(routeName);
  const haveUnreadUnseenActivity = store.useHaveUnreadUnseenActivity();
  const currentUserId = useCurrentUserId();

  return (
    <NavBar>
      <NavIcon
        type="Home"
        activeType="HomeFilled"
        isActive={isRouteActive('/')}
        // hasUnreads={(unreadCount?.channels ?? 0) > 0}
        // intentionally leave undotted for now
        hasUnreads={false}
        onPress={() => navigate('/chatlist')}
      />
      <NavIcon
        type="Notifications"
        activeType="NotificationsFilled"
        hasUnreads={haveUnreadUnseenActivity}
        isActive={isRouteActive('/activity')}
        onPress={() => navigate('/activity')}
      />
      <AvatarNavIcon
        id={currentUserId}
        focused={isRouteActive('/profile')}
        onPress={() => navigate('/profile')}
      />
    </NavBar>
  );
};

export default NavBarView;
