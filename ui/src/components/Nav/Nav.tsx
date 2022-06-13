import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar';
import GroupSidebar from '../GroupSidebar';
import MessagesSidebar from '../../dms/MessagesSidebar';
import useNavStore from './useNavStore';
import useIsChat from '../../logic/useIsChat';

export default function Nav() {
  const { ship } = useParams();

  const navLocation = useNavStore((s) => s.location);
  const isChat = useIsChat();
  let selectedSidebar = isChat ? <MessagesSidebar /> : <Sidebar />;

  useEffect(() => {
    if (isChat && navLocation !== 'dm') {
      useNavStore.getState().setLocationDM();
    }
  }, [isChat, navLocation]);

  if (navLocation === 'main') {
    selectedSidebar = <Sidebar />;
  } else if (navLocation === 'dm') {
    selectedSidebar = <MessagesSidebar />;
  } else if (navLocation === 'group') {
    selectedSidebar = <GroupSidebar />;
  }

  return selectedSidebar;
}
