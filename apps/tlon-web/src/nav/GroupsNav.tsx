import Sidebar from '@/components/Sidebar/Sidebar';
import useActiveTab, {
  ActiveTab,
  useSaveNavState,
} from '@/components/Sidebar/util';
import GroupSidebar from '@/groups/GroupSidebar/GroupSidebar';
import { useIsMobile } from '@/logic/useMedia';
import cn from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Outlet, matchPath, useLocation, useMatch } from 'react-router';

export function DesktopNav() {
  const location = useLocation();
  const activeTab = useActiveTab();
  const saveNavState = useSaveNavState();
  const [lastLocation, setLastLocation] = useState<{
    tab: ActiveTab;
    pathname: string;
  }>({ tab: activeTab, pathname: location.pathname });
  const state = location.state as { backgroundLocation?: Location } | null;
  const match = useMatch('/groups/:ship/:name/*');
  const backgroundLocationMatch = matchPath(
    '/groups/:ship/:name/*',
    state?.backgroundLocation?.pathname || ''
  );
  const animationConfig = {
    type: 'spring',
    stiffness: 2880,
    damping: 120,
  };

  // if we switch tabs from messages or groups, save the nav state
  useEffect(() => {
    if (lastLocation.tab !== activeTab) {
      // TODO: we only save messages state for now since unclear how to do with groups
      // given existing sidebar
      if (['messages'].includes(lastLocation.tab)) {
        saveNavState(lastLocation.tab, lastLocation.pathname);
      }
      setLastLocation({ tab: activeTab, pathname: location.pathname });
    } else if (lastLocation.pathname !== location.pathname) {
      setLastLocation({ tab: activeTab, pathname: location.pathname });
    }
  }, [activeTab, lastLocation, location.pathname, saveNavState]);

  return (
    <div className="relative flex h-full min-w-64 flex-none resize-x overflow-hidden border-r-2 border-gray-50 bg-white">
      <AnimatePresence initial={false}>
        {match || backgroundLocationMatch ? (
          <motion.div
            key="group"
            className="absolute h-full w-full"
            initial={{ x: 256 }}
            animate={{ x: 0 }}
            exit={{ x: 256 }}
            transition={animationConfig}
          >
            <GroupSidebar />
          </motion.div>
        ) : (
          <motion.div
            key="main"
            className="absolute h-full w-full"
            initial={{ x: -256 }}
            animate={{ x: 0 }}
            exit={{ x: -256 }}
            transition={animationConfig}
          >
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GroupsNav() {
  const isMobile = useIsMobile();
  return (
    <div className={cn('fixed flex h-full w-full')}>
      {isMobile ? null : <DesktopNav />}
      <Outlet />
    </div>
  );
}
