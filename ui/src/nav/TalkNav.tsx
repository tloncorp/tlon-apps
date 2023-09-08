import cn from 'classnames';
import { Outlet } from 'react-router';
import { useIsMobile } from '@/logic/useMedia';
import MessagesSidebar from '@/dms/MessagesSidebar';
import { isIOSWebView } from '@/logic/native';

export default function TalkNav() {
  const isMobile = useIsMobile();

  return (
    <div
      className={cn('fixed flex h-full w-full', {
        'pb-3': isIOSWebView(),
      })}
    >
      {isMobile ? null : <MessagesSidebar />}
      <Outlet />
    </div>
  );
}
