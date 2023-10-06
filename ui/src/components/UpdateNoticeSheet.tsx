import { useDismissNavigate } from '@/logic/routing';
import WidgetDrawer from './WidgetDrawer';
import Asterisk16Icon from './icons/Asterisk16Icon';

export default function UpdateNoticeSheet() {
  const dismiss = useDismissNavigate();

  const onOpenChange = (open: boolean) => {
    if (!open) {
      dismiss();
    }
  };
  return (
    <WidgetDrawer open={true} onOpenChange={onOpenChange} className="h-[50vh]">
      <div className="flex h-14 items-center justify-center rounded-t-[32px] bg-yellow">
        <Asterisk16Icon className="h-4 w-4 text-black dark:text-white" />
        <h3 className="ml-2 text-lg font-bold text-black dark:text-white">
          Update Required
        </h3>
      </div>
      <div className="flex flex-col items-center px-8 py-10">
        <p className="text-lg">
          Tlon was updated in the background, but the changes need to be
          installed. Please do so now.
        </p>
        <button className="button mt-10 py-3 px-4">Install Update</button>
      </div>
    </WidgetDrawer>
  );
}
