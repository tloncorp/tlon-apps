import cn from 'classnames';
import { useNotifications } from '@/notifications/useNotifications';
import BulletIcon from '../icons/BulletIcon';
import SidebarItem from './SidebarItem';
import BellIcon from '../icons/BellIcon';
import useActiveTab from './util';

interface ActivityIndicatorProps {
  count: number;
  bg?: string;
  className?: string;
}

export default function ActivityIndicator({
  count,
  bg = 'bg-gray-100',
  className,
}: ActivityIndicatorProps) {
  return (
    <div
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded text-sm font-semibold',
        bg,
        className
      )}
    >
      {count === 0 ? (
        <BulletIcon className="m-0.5 h-5 w-5" />
      ) : count > 99 ? (
        '99+'
      ) : (
        count
      )}
    </div>
  );
}

export function ActivitySidebarItem() {
  const { count } = useNotifications();
  const activeTab = useActiveTab();

  return (
    <SidebarItem
      icon={
        <BellIcon
          className={cn(
            'm-1 h-4 w-4',
            activeTab === 'notifications' ? 'text-black' : 'text-gray-600'
          )}
          isInactive={activeTab !== 'notifications'}
          nonNav
        />
      }
      actions={count > 0 && <ActivityIndicator count={count} />}
      color={activeTab === 'notifications' ? 'text-black' : 'text-gray-600'}
      to={`/notifications`}
      defaultRoute
    >
      Activity
    </SidebarItem>
  );
}
