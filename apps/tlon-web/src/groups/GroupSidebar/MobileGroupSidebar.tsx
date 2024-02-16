import cn from 'classnames';
import { Outlet, useLocation, useMatch } from 'react-router';

import NavTab from '@/components/NavTab';
import BellIcon from '@/components/icons/BellIcon';
import HashIcon from '@/components/icons/HashIcon';
import { useSafeAreaInsets } from '@/logic/native';
import { useIsDark } from '@/logic/useMedia';
import { useGroup, useGroupFlag } from '@/state/groups/groups';

import GroupAvatar from '../GroupAvatar';

export default function MobileGroupSidebar() {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const matchHome = useMatch('/groups/:ship/:name');
  const matchActivity = useMatch('/groups/:ship/:name/activity');
  const matchInfo = useMatch('/groups/:ship/:name/info');
  const location = useLocation();
  const isDarkMode = useIsDark();
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <section
      className="fixed inset-0 z-40 flex h-full w-full flex-col border-gray-50 bg-white"
      style={{ paddingBottom: safeAreaInsets.bottom }}
    >
      <Outlet />
      <footer className="flex-none border-t-2 border-gray-50">
        <nav>
          <ul className="flex h-[50px] items-center">
            <NavTab to={`../`} className="basis-1/4">
              <HashIcon
                className={cn(
                  ' h-6 w-6',
                  !matchHome && 'text-gray-200 dark:text-gray-600'
                )}
              />
            </NavTab>
            <NavTab to={`/groups/${flag}/activity`} className="basis-1/4">
              <BellIcon
                isDarkMode={isDarkMode}
                isInactive={!matchActivity}
                className={'h-6 w-6'}
              />
            </NavTab>
            <NavTab
              to={`/groups/${flag}/info`}
              className="basis-1/4"
              state={{ backgroundLocation: location }}
            >
              <GroupAvatar
                {...group?.meta}
                size="h-6 w-6"
                className={cn('', !matchInfo && 'opacity-50 grayscale')}
              />
            </NavTab>
          </ul>
        </nav>
      </footer>
    </section>
  );
}
