import cn from 'classnames';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { isNativeApp, useSafeAreaInsets } from '@/logic/native';
import { useIsDark } from '@/logic/useMedia';
import { useIsAnyGroupUnread } from '@/logic/useIsGroupUnread';
import { useChannelUnreadCounts } from '@/logic/channel';
import { useNotifications } from '@/notifications/useNotifications';
import { useChatInputFocus } from '@/logic/ChatInputFocusContext';
import { useLocalState } from '@/state/local';
import { useHasUnreadMessages } from '@/state/chat';
import Asterisk16Icon from '@/components/icons/Asterisk16Icon';
import { useNeedsUpdate } from '@/state/local';
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
      linkClass="h-12"
    >
      <div className="flex h-8 w-8 items-center justify-center ">
        <HomeIconMobileNav
          isInactive={props.isInactive}
          isDarkMode={props.isDarkMode}
          className="h-[20px] w-[18px]"
        />
      </div>
      <div
        className={cn(
          'mt-0.5 h-1.5 w-1.5 rounded-full',
          groupsUnread && 'bg-blue'
        )}
      />
    </DoubleClickableNavTab>
  );
}

function MessagesTab(props: { isInactive: boolean; isDarkMode: boolean }) {
  const navigate = useNavigate();
  const { messagesLocation } = useLocalState.getState();
  const hasUnreads = useHasUnreadMessages();

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
      linkClass="h-12"
    >
      <div className="flex h-8 w-8 items-center justify-center ">
        <MessagesIcon
          isInactive={props.isInactive}
          isDarkMode={props.isDarkMode}
          className="h-[20px] w-[18px]"
        />
      </div>
      <div
        className={cn(
          'mt-[2px] h-1.5 w-1.5 rounded-full',
          hasUnreads && 'bg-blue'
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
      linkClass="h-12"
    >
      <div className="flex h-8 w-8 items-center justify-center ">
        <BellIcon
          isInactive={props.isInactive}
          className="h-6 w-[18px]"
          isDarkMode={props.isDarkMode}
        />
      </div>
      <div className={cn('h-1.5 w-1.5 rounded-full', count > 0 && 'bg-blue')} />
    </DoubleClickableNavTab>
  );
}

export default function MobileSidebar() {
  const location = useLocation();
  const isInactive = (path: string) => !location.pathname.startsWith(path);
  const isDarkMode = useIsDark();
  const needsUpdate = useNeedsUpdate();
  const safeAreaInsets = useSafeAreaInsets();
  const { isChatInputFocused } = useChatInputFocus();

  return (
    <section
      className="padding-bottom-transition fixed inset-0 z-40 flex h-full w-full select-none flex-col border-gray-50 bg-white"
      style={{ paddingBottom: isChatInputFocused ? 0 : safeAreaInsets.bottom }}
    >
      <Outlet />
      <footer
        className={cn(
          'navbar-transition z-50 flex-none border-t-2 border-gray-50 bg-white',
          isChatInputFocused && 'translate-y-[200%] opacity-0'
        )}
      >
        <nav>
          <ul className="flex h-12">
            <GroupsTab
              isInactive={isInactive('/groups') && location.pathname !== '/'}
              isDarkMode={isDarkMode}
            />
            <MessagesTab
              isInactive={isInactive('/messages') && isInactive('/dm')}
              isDarkMode={isDarkMode}
            />
            <ActivityTab
              isInactive={isInactive('/notifications')}
              isDarkMode={isDarkMode}
            />
            <NavTab to="/find">
              <div className="flex h-8 w-8 items-center justify-center">
                <MagnifyingGlassMobileNavIcon
                  isInactive={isInactive('/find')}
                  isDarkMode={isDarkMode}
                  className="h-6 w-[18px]"
                />
              </div>
            </NavTab>
            {needsUpdate ? (
              <NavTab
                to="/update-needed"
                state={{ backgroundLocation: location }}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow">
                  <Asterisk16Icon className="h-4 w-4 text-black dark:text-white" />
                </div>
              </NavTab>
            ) : (
              <NavTab to="/profile">
                <Avatar size="xs" className="" ship={window.our} />
              </NavTab>
            )}
          </ul>
        </nav>
      </footer>
    </section>
  );
}
