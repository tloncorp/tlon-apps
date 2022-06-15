import React, { ReactElement, useEffect } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import GroupSidebar from '../../groups/GroupSidebar/GroupSidebar';
import MessagesSidebar from '../../dms/MessagesSidebar';
import useNavStore from './useNavStore';
import useIsChat from '../../logic/useIsChat';

export default function Nav() {
  const navLocation = useNavStore((s) => s.primary);
  const isChat = useIsChat();
  let selectedSidebar: ReactElement | null = isChat ? (
    <MessagesSidebar />
  ) : (
    <Sidebar />
  );

  useEffect(() => {
    if (isChat && (navLocation === 'group' || navLocation === 'main')) {
      useNavStore.getState().setLocationDM();
    }
  }, [isChat, navLocation]);

  if (navLocation === 'main') {
    selectedSidebar = <Sidebar />;
  } else if (navLocation === 'dm') {
    selectedSidebar = <MessagesSidebar />;
  } else if (navLocation === 'group') {
    selectedSidebar = <GroupSidebar />;
  } else {
    selectedSidebar = null;
  }

  return selectedSidebar;
}
