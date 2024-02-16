import useMessagesUnreadCount from '@/logic/useMessagesUnreadCount';
import cn from 'classnames';
import { Link } from 'react-router-dom';

import AddIcon16 from '../icons/Add16Icon';
import MessagesIcon from '../icons/MessagesIcon';
import ActivityIndicator from './ActivityIndicator';
import SidebarItem from './SidebarItem';
import useActiveTab, { useNavToTab } from './util';

export default function MessagesSidebarItem() {
  const activeTab = useActiveTab();
  const unreadCount = useMessagesUnreadCount();
  const navToTab = useNavToTab();

  const onClick = () => {
    if (activeTab !== 'messages') {
      navToTab('messages');
    }
  };

  return (
    <SidebarItem
      icon={
        <MessagesIcon
          className={cn(
            'm-1 h-4 w-4',
            activeTab === 'messages' && 'text-black'
          )}
          nonNav
          isInactive={activeTab !== 'messages'}
        />
      }
      actions={
        <div className="group">
          {unreadCount > 0 && (
            <ActivityIndicator
              count={unreadCount}
              className="group-hover:hidden"
              bg={
                activeTab === 'messages'
                  ? 'bg-none text-black'
                  : 'bg-blue-soft text-blue'
              }
            />
          )}
          <Link to="/dm/new" className="hidden items-center group-hover:flex">
            <AddIcon16 className="h-4 w-4" />
          </Link>
        </div>
      }
      highlightPath="/messages"
      onClick={onClick}
      className="group"
      color={activeTab === 'messages' ? 'text-black' : 'text-gray-600'}
    >
      Messages
    </SidebarItem>
  );
}
