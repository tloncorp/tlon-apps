import cn from 'classnames';
import { Link } from 'react-router-dom';
import useMessagesUnreadCount from '@/logic/useMessagesUnreadCount';
import MessagesIcon from '../icons/MessagesIcon';
import SidebarItem from './SidebarItem';
import useActiveTab from './util';
import AddIcon16 from '../icons/Add16Icon';
import ActivityIndicator from './ActivityIndicator';

export default function MessagesSidebarItem() {
  const activeTab = useActiveTab();
  const unreadCount = useMessagesUnreadCount();

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
      to={'/messages'}
      className="group"
      color={activeTab === 'messages' ? 'text-black' : 'text-gray-600'}
    >
      Messages
    </SidebarItem>
  );
}
