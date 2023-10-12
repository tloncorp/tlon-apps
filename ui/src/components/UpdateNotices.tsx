import { useDismissNavigate } from '@/logic/routing';
import { useLocalState } from '@/state/local';
import { isTalk } from '@/logic/utils';
import WidgetDrawer from './WidgetDrawer';
import Asterisk16Icon from './icons/Asterisk16Icon';

function triggerUpdate(returnToRoot: boolean) {
  const basePath = isTalk ? 'apps/talk' : 'apps/groups';
  const path = returnToRoot
    ? `${window.location.origin}/${basePath}/?updatedAt=${Date.now()}`
    : `${window.location.href}?updatedAt=${Date.now()}`;

  // defensively reset the state and wait until next tick before reloading
  useLocalState.setState({ needsUpdate: false });
  setTimeout(() => {
    window.location.assign(path);
  });
}

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
        <button
          className="button mt-10 py-3 px-4"
          onClick={() => triggerUpdate(true)}
        >
          Install Update
        </button>
      </div>
    </WidgetDrawer>
  );
}

export function DesktopUpdateButton() {
  return (
    <button
      className="mb-2 mt-1 flex flex-col justify-center rounded-lg bg-yellow p-2"
      onClick={() => triggerUpdate(false)}
    >
      <div className="ml-2 flex items-center">
        <Asterisk16Icon className="h-4 w-4 text-black dark:text-white" />
        <h3 className="ml-2 font-bold text-black dark:text-white">
          Update Required
        </h3>
      </div>
      <p className="mt-1 ml-2 text-black dark:text-white">
        Click here to update now
      </p>
    </button>
  );
}
