import Dialog from '@/components/Dialog';
import { useDismissNavigate } from '@/logic/routing';
import NewGroup from './NewGroup';

export default function NewGroupDialog() {
  const dismiss = useDismissNavigate();
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  return (
    <Dialog
      defaultOpen
      modal
      onOpenChange={onOpenChange}
      onInteractOutside={(e) => e.preventDefault()}
      className="sm:inset-y-24"
      containerClass="w-full h-full sm:max-w-2xl"
    >
      <NewGroup />
    </Dialog>
  );
}
