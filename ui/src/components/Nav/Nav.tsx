import React, { useEffect, useState } from 'react';
import { animated, useSpring } from '@react-spring/web';
import Sidebar from '@/components/Sidebar/Sidebar';
import GroupSidebar from '@/groups/GroupSidebar/GroupSidebar';
import MessagesSidebar from '@/dms/MessagesSidebar';
import useIsChat from '@/logic/useIsChat';
import { useIsMobile } from '@/logic/useMedia';
import useNavStore from './useNavStore';

export default function Nav() {
  const navLocation = useNavStore((s) => s.primary) as string;
  const [slid, setSlid] = useState(navLocation === 'group' ? true : false);
  const isMobile = useIsMobile();
  const isChat = useIsChat();
  const springStyles = useSpring({
    config: {
      mass: 1,
      stiffness: 2880,
      damping: 120,
    },
    from: { x: slid ? 0 : -256 },
    x: slid ? -256 : 0,
  });

  useEffect(() => {
    if (isChat && (navLocation === 'group' || navLocation === 'main')) {
      useNavStore.getState().navigatePrimary('dm');
    }
  }, [isChat, navLocation]);

  useEffect(() => {
    if (navLocation === 'group') {
      setSlid(true);
    } else {
      setSlid(false);
    }
  }, [navLocation]);

  if (navLocation === 'dm') {
    return <MessagesSidebar />;
  }

  if (navLocation === 'group' || navLocation === 'main') {
    return (
      <div className="h-full w-64 flex-none overflow-hidden border-r-2 border-gray-50 bg-white">
        <animated.div className="flex w-[201%]" style={springStyles}>
          <Sidebar />
          <GroupSidebar />
        </animated.div>
      </div>
    );
  }

  return null;
}
