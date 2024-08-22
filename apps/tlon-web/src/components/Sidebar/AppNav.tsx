import cn from 'classnames';
import { useCallback, useContext, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Link } from 'react-router-dom';

import Asterisk16Icon from '@/components/icons/Asterisk16Icon';
import { useChatInputFocus } from '@/logic/ChatInputFocusContext';
import { isNativeApp, useSafeAreaInsets } from '@/logic/native';
import useAppUpdates, { AppUpdateContext } from '@/logic/useAppUpdates';
import { useIsDark, useIsMobile } from '@/logic/useMedia';
import useShowTabBar from '@/logic/useShowTabBar';
import {
  useCombinedChatUnreads,
  useCombinedGroupUnreads,
  useMarkAllGroupsRead,
  useSourceActivity,
} from '@/state/activity';
import { useCharge } from '@/state/docket';
import { useLocalState } from '@/state/local';
import { useMessagesFilter } from '@/state/settings';

import ActionMenu from '../ActionMenu';
import Avatar from '../Avatar';
import useLeap from '../Leap/useLeap';
import NavTab, {
  DoubleClickableNavButton,
  DoubleClickableNavTab,
} from '../NavTab';
import BellIcon from '../icons/BellIcon';
import CmdSmallIcon from '../icons/CmdSmallIcon';
import HomeIconMobileNav from '../icons/HomeIconMobileNav';
import LandscapeIcon from '../icons/LandscapeIcon';
import MessagesIcon from '../icons/MessagesIcon';
import useActiveTab, { ActiveTab } from './util';

function GroupsTab(props: { isInactive: boolean; isDarkMode: boolean }) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const navigate = useNavigate();
  const { groupsLocation } = useLocalState.getState();
  const groupsUnread = useCombinedGroupUnreads();
  const markAllGroupsRead = useMarkAllGroupsRead();
  const isMobile = useIsMobile();

  const onSingleClick = () => {
    if (props.isInactive) {
      navigate(groupsLocation ?? '/');
    } else {
      navigate('/');
    }
  };

  const onLongPress = useCallback(() => {
    setOptionsOpen(true);
  }, [setOptionsOpen]);

  if (isMobile) {
    return (
      <DoubleClickableNavTab
        onSingleClick={onSingleClick}
        onDoubleClick={() => navigate('/')}
        onLongPress={onLongPress}
        linkClass="h-full !pb-0 flex flex-col items-start justify-start"
        aria-label="Groups"
        data-testid="groups-tab"
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
              groupsUnread.unread
                ? groupsUnread.notify
                  ? 'bg-blue'
                  : 'bg-gray-400'
                : ''
            )}
          />
        </div>
        <ActionMenu
          open={optionsOpen}
          onOpenChange={setOptionsOpen}
          actions={[
            {
              key: 'mark-all-read',
              content: 'Mark all read',
              onClick: () => markAllGroupsRead(),
            },
          ]}
        />
      </DoubleClickableNavTab>
    );
  }

  return (
    <DoubleClickableNavButton
      className="m-auto flex rounded-lg"
      onSingleClick={onSingleClick}
      onDoubleClick={() => navigate('/')}
      onLongPress={onLongPress}
      aria-label="Groups"
      data-testid="groups-tab"
    >
      <ActionMenu
        open={optionsOpen}
        onOpenChange={setOptionsOpen}
        disabled={!optionsOpen}
        actions={[
          {
            key: 'mark-all-read',
            content: 'Mark all read',
            onClick: () => markAllGroupsRead(),
          },
        ]}
        asChild
      >
        <div
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-50',
            !props.isInactive && '!bg-gray-100'
          )}
        >
          <HomeIconMobileNav
            isInactive={props.isInactive}
            isDarkMode={props.isDarkMode}
            className="h-6 w-6"
          />
          <div
            className={cn(
              'h-1 w-1 rounded-full top-1 right-1 absolute',
              groupsUnread.unread
                ? groupsUnread.notify
                  ? 'bg-blue'
                  : 'bg-gray-400'
                : ''
            )}
          />
        </div>
      </ActionMenu>
    </DoubleClickableNavButton>
  );
}

function MessagesTab(props: { isInactive: boolean; isDarkMode: boolean }) {
  const navigate = useNavigate();
  const { messagesLocation } = useLocalState.getState();
  const isMobile = useIsMobile();
  const messagesFilter = useMessagesFilter();
  const unreads = useCombinedChatUnreads(
    isMobile ? 'Direct Messages' : messagesFilter
  );

  const onSingleClick = () => {
    if (props.isInactive) {
      navigate(messagesLocation ?? '/messages');
    } else {
      navigate('/messages');
    }
  };

  if (isMobile) {
    return (
      <DoubleClickableNavTab
        onSingleClick={onSingleClick}
        onDoubleClick={() => navigate('/messages')}
        linkClass="h-full !pb-0 flex flex-col items-start justify-start"
        aria-label="Messages"
        data-testid="messages-tab"
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
              unreads.unread ? (unreads.notify ? 'bg-blue' : 'bg-gray-400') : ''
            )}
          />
        </div>
      </DoubleClickableNavTab>
    );
  }

  return (
    <DoubleClickableNavButton
      className={cn(
        'relative m-auto flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-50',
        !props.isInactive && '!bg-gray-100'
      )}
      onSingleClick={onSingleClick}
      onDoubleClick={() => navigate('/messages')}
      aria-label="Messages"
      data-testid="messages-tab"
    >
      <MessagesIcon
        isInactive={props.isInactive}
        isDarkMode={props.isDarkMode}
        className="h-6 w-6"
      />
      <div
        className={cn(
          'h-1 w-1 rounded-full top-1 right-1 absolute',
          unreads.unread ? (unreads.notify ? 'bg-blue' : 'bg-gray-400') : ''
        )}
      />
    </DoubleClickableNavButton>
  );
}

function ActivityTab(props: { isInactive: boolean; isDarkMode: boolean }) {
  const navigate = useNavigate();
  const { activity } = useSourceActivity('base');
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DoubleClickableNavTab
        onSingleClick={() => navigate('/notifications')}
        onDoubleClick={() => navigate('/notifications')}
        linkClass="h-full !pb-0 flex flex-col items-start justify-start"
        aria-label="Notifications"
        data-testid="notifications-tab"
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
              activity['notify-count'] > 0 && 'bg-blue'
            )}
          />
        </div>
      </DoubleClickableNavTab>
    );
  }

  return (
    <Link
      className={cn(
        'relative m-auto flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-50',
        !props.isInactive && '!bg-gray-100'
      )}
      to="/notifications"
      aria-label="Notifications"
      data-testid="notifications-tab"
    >
      <BellIcon
        isInactive={props.isInactive}
        isDarkMode={props.isDarkMode}
        className="h-6 w-6"
      />
      <div
        className={cn(
          'h-1 w-1 rounded-full top-1 right-1 absolute',
          activity['notify-count'] > 0 && 'bg-blue'
        )}
      />
    </Link>
  );
}

function UpdateTab() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { triggerUpdate } = useAppUpdates();

  if (isMobile) {
    return (
      <NavTab
        to="/update-needed"
        state={{ backgroundLocation: location }}
        linkClass="h-full !pb-0 flex flex-col items-start justify-start"
        aria-label="Update Needed"
      >
        <div className="flex-1" />
        <div className="flex h-8 w-8 items-center justify-center">
          <div className="flex h-[20px] w-[20px] items-center justify-center rounded-sm bg-yellow">
            <Asterisk16Icon className="h-4 w-4 text-black dark:text-white" />
          </div>
        </div>
        <div className="flex-1" />
      </NavTab>
    );
  }

  return (
    <button
      className="relative m-auto flex h-10 w-10 items-center justify-center rounded-lg"
      onClick={() => triggerUpdate(true)}
      aria-label="Update Needed"
    >
      <div className="flex h-[40px] w-[40px] items-center justify-center rounded-md bg-yellow">
        <Asterisk16Icon className="h-6 w-6 text-black dark:text-white" />
      </div>
    </button>
  );
}

function ProfileTab(props: { isInactive: boolean }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <NavTab
        to="/profile"
        linkClass="h-full !pb-0 flex flex-col items-start justify-start"
        aria-label="Profile & Settings"
        data-testid="profile-tab"
      >
        <div className="flex-1" />
        <div className="flex h-8 w-8 items-center justify-center">
          <Avatar
            className="h-[20px] w-[20px] rounded-md"
            ship={window.our}
            size="sidebar"
          />
        </div>
        <div className="flex-1" />
      </NavTab>
    );
  }

  return (
    <Link
      className={cn(
        'relative m-auto flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-50',
        !props.isInactive && '!bg-gray-100'
      )}
      to="/profile"
      aria-label="Profile & Settings"
      data-testid="profile-tab"
    >
      <Avatar
        className="h-[24px] w-[24px] rounded-md"
        ship={window.our}
        size="sidebar"
      />
    </Link>
  );
}

function LandscapeTab() {
  return (
    <a
      href="/apps/landscape"
      target="_blank"
      className={cn(
        'relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-50 cursor-pointer text-gray-400'
      )}
      aria-label="Open Landscape"
    >
      <LandscapeIcon className="h-4 w-4" />
    </a>
  );
}

function LeapTab() {
  const { setIsOpen: setLeapOpen, isOpen } = useLeap();

  return (
    <div
      className={cn(
        'relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-50 cursor-pointer text-gray-400',
        isOpen && '!bg-gray-100 text-gray-800'
      )}
      onClick={() => setLeapOpen(true)}
      aria-label="Open Leap"
    >
      <CmdSmallIcon className="h-4 w-4" />
    </div>
  );
}

export default function AppNav() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const [informedOfUpdate, setInformedOfUpdate] = useState(false);
  const isInactive = (path: string) => !location.pathname.startsWith(path);
  const isDarkMode = useIsDark();
  const { needsUpdate } = useContext(AppUpdateContext);
  const safeAreaInsets = useSafeAreaInsets();
  const { isChatInputFocused } = useChatInputFocus();
  const groupsCharge = useCharge('groups');
  const showTabBar = useShowTabBar();
  const activeTab = useActiveTab();
  const [lastLocation, setLastLocation] = useState<{
    tab: ActiveTab;
    pathname: string;
  }>({ tab: activeTab, pathname: location.pathname });

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

  // if we switch tabs from messages or groups, save the nav state
  useEffect(() => {
    if (lastLocation.tab !== activeTab) {
      if (lastLocation.tab === 'groups') {
        useLocalState.setState({ groupsLocation: lastLocation.pathname });
      }
      if (lastLocation.tab === 'messages') {
        useLocalState.setState({ messagesLocation: lastLocation.pathname });
      }
      setLastLocation({ tab: activeTab, pathname: location.pathname });
    } else if (lastLocation.pathname !== location.pathname) {
      setLastLocation({ tab: activeTab, pathname: location.pathname });
    }
  }, [activeTab, lastLocation, location.pathname]);

  if (!isMobile) {
    return (
      <div className="flex h-full w-full">
        <nav
          className="h-full w-14 border-r-2 border-r-gray-50"
          data-testid="app-nav"
        >
          <ul className="flex h-full flex-col justify-between pb-3 pt-[10px]">
            <div className="space-y-4">
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
                <UpdateTab />
              ) : (
                <ProfileTab isInactive={isInactive('/profile')} />
              )}
            </div>
            <div className="space-y-4">
              <LandscapeTab />
              <LeapTab />
            </div>
          </ul>
        </nav>
        <section className="relative h-full flex-1 bg-white">
          <Outlet />
        </section>
      </div>
    );
  }
  return (
    <section
      className="padding-bottom-transition inset-0 z-40 flex h-full w-full select-none flex-col border-gray-50 bg-white"
      style={{
        paddingBottom:
          isChatInputFocused || !showTabBar ? 0 : safeAreaInsets.bottom,
      }}
    >
      <Outlet />
      {showTabBar ? (
        <footer
          data-testid="app-nav"
          className={cn(
            'navbar-transition z-50 flex-none border-t-2 border-gray-50 bg-white fixed w-full bottom-0',
            isChatInputFocused && 'translate-y-[200%] opacity-0 h-0'
          )}
          style={{
            paddingBottom: isNativeApp() ? safeAreaInsets.bottom : 0,
          }}
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
      ) : null}
    </section>
  );
}
