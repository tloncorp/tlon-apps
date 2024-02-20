import cn from 'classnames';
import { Outlet } from 'react-router';
import { useIsMobile } from '@/logic/useMedia';
import MessagesSidebar from '@/dms/MessagesSidebar';
import Dialog from '@/components/Dialog';
import CautionIcon from '@/components/icons/CautionIcon';
import WidgetDrawer from '@/components/WidgetDrawer';
import { useEffect, useState } from 'react';
import {
  usePutEntryMutation,
  useSeenTalkSunset,
  useSettings,
} from '@/state/settings';
import { useLocalState, useManuallyShowTalkSunset } from '@/state/local';

export default function TalkNav() {
  const [timedDelay, setTimedDelay] = useState(false);
  const isMobile = useIsMobile();
  const seenSunset = useSeenTalkSunset();
  const manuallyShowSunset = useManuallyShowTalkSunset();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setTimedDelay(true);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [setTimedDelay]);

  return (
    <div className={cn('fixed flex h-full w-full')}>
      {isMobile ? null : <MessagesSidebar />}
      <Outlet />
      {timedDelay && (!seenSunset || manuallyShowSunset) && (
        <TalkSunsetNotification />
      )}
    </div>
  );
}

function TalkSunsetNotification() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(true);
  const { mutate } = usePutEntryMutation({
    bucket: 'talk',
    key: 'seenSunsetMessage',
  });

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      mutate({ val: true });
      useLocalState.setState({ manuallyShowTalkSunset: false });
      setOpen(false);
    }
  };

  return (
    <TalkSunsetContainer
      open={open}
      isMobile={isMobile}
      onOpenChange={onOpenChange}
    >
      <div
        className={cn(
          'flex items-center justify-center bg-indigo py-6',
          isMobile && 'rounded-t-[32px]'
        )}
      >
        <CautionIcon className="h-6 w-6 text-white dark:text-black" />
        <h2 className="ml-2 text-[18px] font-semibold text-white dark:text-black">
          Talk Sunset
        </h2>
      </div>
      <div className="mt-8 flex flex-col items-center">
        <p className="mx-8 text-lg">
          Talk is being officially retired. A similar messaging experience is
          now available in the main Tlon app.
          <br />
          <br />
          Feel free to leave Talk installed, but it will no longer receive
          updates or ongoing support.
        </p>
        <button
          className={cn('button mt-10', isMobile && 'p-4')}
          onClick={() => onOpenChange(false)}
        >
          Dismiss
        </button>
      </div>
    </TalkSunsetContainer>
  );
}

function TalkSunsetContainer({
  open,
  onOpenChange,
  isMobile,
  children,
}: {
  open: boolean;
  onOpenChange: (newOpen: boolean) => void;
  isMobile: boolean;
  children: React.ReactNode;
}) {
  return isMobile ? (
    <WidgetDrawer open={open} onOpenChange={onOpenChange} className="h-[60vh]">
      {children}
    </WidgetDrawer>
  ) : (
    <Dialog
      defaultOpen
      onOpenChange={onOpenChange}
      className="h-[350px] overflow-y-auto p-0"
      containerClass="w-full sm:max-w-lg"
    >
      {children}
    </Dialog>
  );
}
