import { useDismissNavigate } from '@/logic/routing';

import Dialog from '../Dialog';
import BlockedUsers from './BlockedUsers';

export default function BlockedUsersDialog() {
  const dismiss = useDismissNavigate();

  const onOpenChange = (open: boolean) => {
    if (!open) {
      dismiss();
    }
  };

  return (
    <Dialog
      defaultOpen
      modal
      onOpenChange={onOpenChange}
      containerClass="flex"
      className="h-[500px] w-[500px] overflow-y-auto"
    >
      <div className="flex h-full w-full flex-col">
        <BlockedUsers />
      </div>
    </Dialog>
  );
}
