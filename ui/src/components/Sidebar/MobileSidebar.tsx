import cn from 'classnames';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { isNativeApp, useSafeAreaInsets } from '@/logic/native';
import { useIsDark } from '@/logic/useMedia';
import { useIsAnyGroupUnread } from '@/logic/useIsGroupUnread';
import { useChannelUnreadCounts } from '@/logic/channel';
import { useNotifications } from '@/notifications/useNotifications';
import { useLocalState } from '@/state/local';
import NavTab, { DoubleClickableNavTab } from '../NavTab';
import BellIcon from '../icons/BellIcon';
import MenuIcon from '../icons/MenuIcon';
import HomeIconMobileNav from '../icons/HomeIconMobileNav';
import MagnifyingGlassMobileNavIcon from '../icons/MagnifyingGlassMobileNavIcon';
import MessagesIcon from '../icons/MessagesIcon';
import Avatar from '../Avatar';

function GroupsTab(props: { isInactive: boolean; isDarkMode: boolean }) {
  const navigate = useNavigate();
  const { groupsLocation } = useLocalState.getState();
  const groupsUnread = useIsAnyGroupUnread();

  const onSingleClick = () => {
    if (isNativeApp()) {
      if (props.isInactive) {
        navigate(groupsLocation);
      }
    } else {
      navigate('/');
    }
  };

  return (
    <DoubleClickableNavTab
      onSingleClick={onSingleClick}
      onDoubleClick={() => navigate('/')}
    >
      <HomeIconMobileNav
        isInactive={props.isInactive}
        isDarkMode={props.isDarkMode}
        className="h-6 w-6"
      />
      <div
        className={cn(
          'mt-[2px] h-1.5 w-1.5 rounded-full',
          groupsUnread && 'bg-blue'
        )}
      />
    </DoubleClickableNavTab>
  );
}

function MessagesTab(props: { isInactive: boolean; isDarkMode: boolean }) {
  const navigate = useNavigate();
  const { messagesLocation } = useLocalState.getState();
  const unreadCount = useChannelUnreadCounts({ scope: 'Direct Messages' });

  const onSingleClick = () => {
    if (isNativeApp()) {
      if (props.isInactive) {
        navigate(messagesLocation);
      }
    } else {
      navigate('/messages');
    }
  };

  return (
    <DoubleClickableNavTab
      onSingleClick={onSingleClick}
      onDoubleClick={() => navigate('/messages')}
    >
      <MessagesIcon
        isInactive={props.isInactive}
        isDarkMode={props.isDarkMode}
        className="h-6 w-6"
      />
      <div
        className={cn(
          'mt-[2px] h-1.5 w-1.5 rounded-full',
          unreadCount > 0 && 'bg-blue'
        )}
      />
    </DoubleClickableNavTab>
  );
}

function ActivityTab(props: { isInactive: boolean; isDarkMode: boolean }) {
  const navigate = useNavigate();
  const { count } = useNotifications('', 'all');

  return (
    <DoubleClickableNavTab
      onSingleClick={() => navigate('/notifications')}
      onDoubleClick={() => navigate('/notifications')}
    >
      <BellIcon
        isInactive={props.isInactive}
        className="h-6 w-6"
        isDarkMode={props.isDarkMode}
      />
      <div
        className={cn(
          'mt-[2px] h-1.5 w-1.5 rounded-full',
          count > 0 && 'bg-blue'
        )}
      />
    </DoubleClickableNavTab>
  );
}

export default function MobileSidebar() {
  const location = useLocation();
  const isInactive = (path: string) => !location.pathname.startsWith(path);
  const isDarkMode = useIsDark();
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <section
      className="fixed inset-0 z-40 flex h-full w-full flex-col border-gray-50 bg-white"
      style={{ paddingBottom: safeAreaInsets.bottom }}
    >
      <Outlet />
      <footer className={cn('flex-none border-t-2 border-gray-50')}>
        <nav>
          <ul className="flex">
            <GroupsTab
              isInactive={isInactive('/groups') && location.pathname !== '/'}
              isDarkMode={isDarkMode}
            />
            {isNativeApp() && (
              <MessagesTab
                isInactive={isInactive('/messages') && isInactive('/dm')}
                isDarkMode={isDarkMode}
              />
            )}
            <ActivityTab
              isInactive={isInactive('/notifications')}
              isDarkMode={isDarkMode}
            />
            <NavTab to="/find">
              <MagnifyingGlassMobileNavIcon
                isInactive={isInactive('/find')}
                isDarkMode={isDarkMode}
                className="h-6 w-6"
              />
            </NavTab>
            {!isNativeApp() && (
              <NavTab to="/leap">
                <MenuIcon
                  className={cn('h-6 w-6', {
                    'text-gray-200 dark:text-gray-700': isInactive('/leap'),
                  })}
                />
              </NavTab>
            )}
            <NavTab to="/profile">
              <Avatar size="xs" className="" ship={window.our} />
            </NavTab>
          </ul>
        </nav>
      </footer>
    </section>
  );
}
