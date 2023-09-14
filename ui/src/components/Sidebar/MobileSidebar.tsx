import cn from 'classnames';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { isNativeApp, useSafeAreaInsets } from '@/logic/native';
import { useIsDark } from '@/logic/useMedia';
import { useLocalState } from '@/state/local';
import NavTab, { DoubleClickableNavTab } from '../NavTab';
import BellIcon from '../icons/BellIcon';
import GridIcon from '../icons/GridIcon';
import HomeIconMobileNav from '../icons/HomeIconMobileNav';
import MagnifyingGlassMobileNavIcon from '../icons/MagnifyingGlassMobileNavIcon';
import MessagesIcon from '../icons/MessagesIcon';
import Avatar from '../Avatar';

function GroupsTab(props: { isInactive: boolean; isDarkMode: boolean }) {
  const navigate = useNavigate();
  const { groupsLocation } = useLocalState.getState();

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
      linkClass="basis-1/5"
    >
      <HomeIconMobileNav
        isInactive={props.isInactive}
        isDarkMode={props.isDarkMode}
        className="mb-0.5 h-6 w-6"
      />
    </DoubleClickableNavTab>
  );
}

function MessagesTab(props: { isInactive: boolean; isDarkMode: boolean }) {
  const navigate = useNavigate();
  const { messagesLocation } = useLocalState.getState();

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
        className="mb-0.5 h-6 w-6"
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

            <NavTab to="/notifications" linkClass="basis-1/5">
              <BellIcon
                isInactive={isInactive('/notifications')}
                className="mb-0.5 h-6 w-6"
                isDarkMode={isDarkMode}
              />
            </NavTab>
            <NavTab to="/find" linkClass="basis-1/5">
              <MagnifyingGlassMobileNavIcon
                isInactive={isInactive('/find')}
                isDarkMode={isDarkMode}
                className="mb-0.5 h-6 w-6"
              />
            </NavTab>
            {!isNativeApp() && (
              <NavTab to="/leap" linkClass="basis-1/5">
                <GridIcon
                  className={cn('mb-0.5 h-8 w-8', {
                    'text-gray-200 dark:text-gray-700': isInactive('/leap'),
                  })}
                />
              </NavTab>
            )}
            <NavTab to="/profile" linkClass="basis-1/5">
              <Avatar size="xs" className="mb-0.5" ship={window.our} />
            </NavTab>
          </ul>
        </nav>
      </footer>
    </section>
  );
}
