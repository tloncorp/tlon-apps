import React from 'react';
import { matchPath, Outlet, useLocation, useMatch } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '@/components/Sidebar/Sidebar';
import GroupSidebar from '@/groups/GroupSidebar/GroupSidebar';
import { useIsMobile } from '@/logic/useMedia';

export function DesktopNav() {
  const location = useLocation();
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

  return (
    <div className="relative flex h-full w-64 flex-none overflow-hidden border-r-2 border-gray-50 bg-white">
      <AnimatePresence initial={false}>
        {match || backgroundLocationMatch ? (
          <motion.div
            key="group"
            className="absolute h-full"
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
            className="absolute h-full"
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
    <div className="flex h-full w-full">
      {isMobile ? null : <DesktopNav />}
      <Outlet />
    </div>
  );
}
