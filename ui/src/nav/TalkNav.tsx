import cn from 'classnames';
import { Outlet } from 'react-router';
import { useIsMobile } from '@/logic/useMedia';
import MessagesSidebar from '@/dms/MessagesSidebar';

export default function TalkNav() {
  const isMobile = useIsMobile();

  return (
    <div className={cn('fixed flex h-full w-full')}>
      {isMobile ? null : <MessagesSidebar />}
      <Outlet />
    </div>
  );
}
