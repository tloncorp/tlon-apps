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

function MobileNav() {
  let selectedSidebar: ReactElement | null = <Sidebar />;
  const navLocation = useNavStore((s) => s.primary) as string;
  const flag = useRouteGroup();
  const inChannel = useMatch('/groups/:ship/:name/channels/*');
  const isChat = useIsChat();

  useEffect(() => {
    if (flag && inChannel) {
      useNavStore.getState().navigatePrimary('hidden');
      return;
    }

    if (isChat) {
      useNavStore.getState().navigatePrimary('dm');
    } else if (flag) {
      useNavStore.getState().navigatePrimary('group', flag);
    } else {
      useNavStore.getState().navigatePrimary('main');
    }
  }, [isChat, flag, inChannel]);

  if (navLocation === 'main') {
    selectedSidebar = <Sidebar />;
  } else if (navLocation === 'group') {
    selectedSidebar = <GroupSidebar />;
  } else if (navLocation === 'dm') {
    selectedSidebar = <MessagesSidebar />;
  } else {
    selectedSidebar = null;
  }

  return selectedSidebar;
}

export function DesktopNav() {
  const navLocation = useNavStore((s) => s.primary) as string;
  const isChat = useIsChat();
  const flag = useRouteGroup();
  const firstRender = useIsFirstRender();
  const animationConfig = {
    type: 'spring',
    stiffness: 2880,
    damping: 120,
  };

  useEffect(() => {
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
  }, [flag, firstRender, isChat]);

  if (navLocation === 'dm') {
    return <MessagesSidebar />;
  }

  if (navLocation === 'group' || navLocation === 'main') {
    return (
      <div className="relative flex h-full w-64 flex-none overflow-y-auto overflow-x-hidden border-r-2 border-gray-50 bg-white">
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
  const isMobile = useIsMobile();
  return (
    <div className="flex h-full w-full">
      {isMobile ? <MobileNav /> : <DesktopNav />}
      <div className="flex h-screen w-full overflow-y-scroll">
        <Outlet />
      </div>
    </div>
  );
}
