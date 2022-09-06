import React, { ReactElement, useEffect } from 'react';
import { Outlet, useMatch } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsFirstRender } from 'usehooks-ts';
import Sidebar from '@/components/Sidebar/Sidebar';
import GroupSidebar from '@/groups/GroupSidebar/GroupSidebar';
import MessagesSidebar from '@/dms/MessagesSidebar';
import useIsChat from '@/logic/useIsChat';
import { useIsMobile } from '@/logic/useMedia';
import { useRouteGroup } from '@/state/groups';
import useNavStore from './useNavStore';

function MobileGroupsNav({ navLocation }: { navLocation: string }) {
  let selectedSidebar: ReactElement | null = <Sidebar />;

  if (navLocation === 'main') {
    selectedSidebar = <Sidebar />;
  } else if (navLocation === 'group') {
    selectedSidebar = <GroupSidebar />;
  } else if (navLocation === 'hidden') {
    selectedSidebar = null;
  } else {
    selectedSidebar = null;
  }

  return selectedSidebar;
}

export function ActualNav() {
  const navLocation = useNavStore((s) => s.primary) as string;
  const isMobile = useIsMobile();
  const isChat = useIsChat();
  const flag = useRouteGroup();
  const inChannel = useMatch('/groups/:ship/:name/channels*');
  const firstRender = useIsFirstRender();
  const animationConfig = {
    type: 'spring',
    stiffness: 2880,
    damping: 120,
  };

  useEffect(() => {
    if (flag && isMobile) {
      useNavStore.getState().navigatePrimary('hidden');
    }

    if (!firstRender) {
      return;
    }

    if (isChat) {
      useNavStore.getState().navigatePrimary('dm');
    } else if (flag) {
      useNavStore.getState().navigatePrimary('group', flag);
    } else {
      useNavStore.getState().navigatePrimary('main');
    }
  }, [flag, firstRender, isMobile, isChat, inChannel]);

  if (navLocation === 'dm') {
    return <MessagesSidebar />;
  }

  if (isMobile) {
    return <MobileGroupsNav navLocation={navLocation} />;
  }

  if (navLocation === 'group' || navLocation === 'main') {
    return (
      <div className="relative flex h-full w-64 flex-none overflow-hidden border-r-2 border-gray-50 bg-white">
        <AnimatePresence initial={false}>
          {navLocation === 'group' ? (
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

  return null;
}

export default function Nav() {
  return (
    <div className="flex h-full w-full">
      <ActualNav />
      <Outlet />
    </div>
  );
}
