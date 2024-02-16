import { useDismissNavigate } from '@/logic/routing';
import { useIsMobile } from '@/logic/useMedia';
import { useFlagContentMutation } from '@/state/groups';
import cn from 'classnames';
import { useLocation } from 'react-router';

import Dialog from './Dialog';
import WidgetDrawer from './WidgetDrawer';
import CautionIcon from './icons/CautionIcon';

function ReportContainer({
  onOpenChange,
  isMobile,
  children,
}: {
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  children: React.ReactNode;
}) {
  return isMobile ? (
    <WidgetDrawer open={true} onOpenChange={onOpenChange} className="h-[60vh]">
      {children}
    </WidgetDrawer>
  ) : (
    <Dialog
      defaultOpen
      onOpenChange={onOpenChange}
      className="h-[300px] overflow-y-auto p-0"
      containerClass="w-full sm:max-w-lg"
    >
      {children}
    </Dialog>
  );
}

export default function ReportContent() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const dismiss = useDismissNavigate();
  const { mutate } = useFlagContentMutation();

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  const onReport = () => {
    if (
      !location.state.groupFlag ||
      !location.state.post ||
      !location.state.nest
    ) {
      console.error('Error reporting content.', location.state);
      return;
    }

    mutate({
      post: location.state.post,
      reply: location.state.reply,
      nest: location.state.nest,
      flag: location.state.groupFlag,
    });
    dismiss();
  };

  return (
    <ReportContainer isMobile={isMobile} onOpenChange={onOpenChange}>
      <div
        className={cn(
          'flex items-center justify-center bg-red py-6',
          isMobile && 'rounded-t-[32px]'
        )}
      >
        <CautionIcon className="h-6 w-6 text-black dark:text-white" />
        <h2 className="ml-2 text-[18px] font-bold text-black dark:text-white">
          Report Content
        </h2>
      </div>
      <div className="mt-8 flex flex-col items-center">
        <p className="mx-8 text-lg">
          If you report this content as inappropriate, it will be sent to the
          group admins for review. They can decide to remove the post or take
          further action.
        </p>
        <button
          className={cn('button mt-10', isMobile && 'p-4')}
          onClick={onReport}
        >
          Send Report
        </button>
      </div>
    </ReportContainer>
  );
}
