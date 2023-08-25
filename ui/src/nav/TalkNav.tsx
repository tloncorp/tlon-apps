import cn from 'classnames';
import { Outlet } from 'react-router';
import useIsIOSWebView from '@/logic/useIsIOSWebView';
import { useIsMobile } from '@/logic/useMedia';
import MessagesSidebar from '@/dms/MessagesSidebar';

export default function TalkNav() {
  const isMobile = useIsMobile();
  const isIOSWebView = useIsIOSWebView();

  return (
    <div
      className={cn('fixed flex h-full w-full', {
        'pb-3': isIOSWebView,
      })}
    >
      {isMobile ? null : <MessagesSidebar />}
      <Outlet />
    </div>
  );
}
