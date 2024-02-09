import cn from 'classnames';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { isNativeApp, useSafeAreaInsets } from '@/logic/native';
import { useIsDark } from '@/logic/useMedia';
import { useIsAnyGroupUnread } from '@/logic/useIsGroupUnread';
import { useNotifications } from '@/notifications/useNotifications';
import { useChatInputFocus } from '@/logic/ChatInputFocusContext';
import { useLocalState } from '@/state/local';
import { useHasUnreadMessages } from '@/state/chat';
import Asterisk16Icon from '@/components/icons/Asterisk16Icon';
import { useContext, useEffect, useState } from 'react';
import { useCharge } from '@/state/docket';
import { AppUpdateContext } from '@/logic/useAppUpdates';
import NavTab, { DoubleClickableNavTab } from '../NavTab';
import BellIcon from '../icons/BellIcon';
import HomeIconMobileNav from '../icons/HomeIconMobileNav';
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
      linkClass="h-full !pb-0 flex flex-col items-start justify-start"
    >
      <div className="flex-1" />
      <div className="flex h-8 w-8 items-center justify-center">
        <HomeIconMobileNav
          isInactive={props.isInactive}
          isDarkMode={props.isDarkMode}
          className="h-[20px] w-[18px]"
        />
      </div>
      <div className="flex flex-1 items-end">
        <div
          className={cn(
            'mb-0.5 h-1.5 w-1.5 rounded-full',
            groupsUnread && 'bg-blue'
          )}
        />
      </div>
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
      linkClass="h-full !pb-0 flex flex-col items-start justify-start"
    >
      <div className="flex-1" />
      <div className="flex h-8 w-8 items-center justify-center">
        <MessagesIcon
          isInactive={props.isInactive}
          isDarkMode={props.isDarkMode}
          className="h-[20px] w-[18px]"
        />
      </div>
      <div className="flex flex-1 items-end">
        <div
          className={cn(
            'mb-0.5 h-1.5 w-1.5 rounded-full',
            hasUnreads && 'bg-blue'
          )}
        />
      </div>
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
      linkClass="h-full !pb-0 flex flex-col items-start justify-start"
    >
      <div className="flex-1" />
      <div className="flex h-8 w-8 items-center justify-center">
        <BellIcon
          isInactive={props.isInactive}
          className="h-[20px] w-[18px]"
          isDarkMode={props.isDarkMode}
        />
      </div>
      <div className="flex flex-1 items-end">
        <div
          className={cn(
            'mb-0.5 h-1.5 w-1.5 rounded-full',
            count > 0 && 'bg-blue'
          )}
        />
      </div>
    </DoubleClickableNavTab>
  );
}

export default function MobileSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [informedOfUpdate, setInformedOfUpdate] = useState(false);
  const isInactive = (path: string) => !location.pathname.startsWith(path);
  const isDarkMode = useIsDark();
  const { needsUpdate } = useContext(AppUpdateContext);
  const safeAreaInsets = useSafeAreaInsets();
  const { isChatInputFocused } = useChatInputFocus();
  const groupsCharge = useCharge('groups');

  useEffect(() => {
    if (groupsCharge && needsUpdate && !informedOfUpdate) {
      navigate('/update-needed', { state: { backgroundLocation: location } });
      setInformedOfUpdate(true);
    }
  }, [
    needsUpdate,
    navigate,
    location,
    informedOfUpdate,
    setInformedOfUpdate,
    groupsCharge,
  ]);

  return (
    <section
      className="padding-bottom-transition fixed inset-0 z-40 flex h-full w-full select-none flex-col border-gray-50 bg-white"
      style={{ paddingBottom: isChatInputFocused ? 0 : safeAreaInsets.bottom }}
    >
      <Outlet />
      <footer
        className={cn(
          'navbar-transition z-50 flex-none border-t-2 border-gray-50 bg-white',
          isChatInputFocused && 'translate-y-[200%] opacity-0',
          !isNativeApp() && 'pb-1'
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
            {needsUpdate ? (
              <NavTab
                to="/update-needed"
                state={{ backgroundLocation: location }}
                linkClass="h-full !pb-0 flex flex-col items-start justify-start"
              >
                <div className="flex-1" />
                <div className="flex h-8 w-8 items-center justify-center">
                  <div className="flex h-[20px] w-[20px] items-center justify-center rounded-sm bg-yellow">
                    <Asterisk16Icon className="h-4 w-4 text-black dark:text-white" />
                  </div>
                </div>
                <div className="flex-1" />
              </NavTab>
            ) : (
              <NavTab
                to="/profile"
                linkClass="h-full !pb-0 flex flex-col items-start justify-start"
              >
                <div className="flex-1" />
                <div className="flex h-8 w-8 items-center justify-center">
                  <Avatar
                    className="h-[20px] w-[20px] rounded-sm"
                    ship={window.our}
                    size="xs"
                  />
                </div>
                <div className="flex-1" />
              </NavTab>
            )}
          </ul>
        </nav>
      </footer>
    </section>
  );
}
