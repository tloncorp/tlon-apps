import { useDismissNavigate } from '@/logic/routing';
import { useIsMobile } from '@/logic/useMedia';

import Dialog from '../Dialog';
import Sheet, { SheetContent } from '../Sheet';
import Settings from './Settings';

export default function SettingsDialog() {
  const dismiss = useDismissNavigate();

  const onOpenChange = (open: boolean) => {
    if (!open) {
      dismiss();
    }
  };
  const isMobile = useIsMobile();

  return isMobile ? (
    <Sheet open={true} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto" showClose={false}>
        <Settings />
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog
      defaultOpen
      modal
      onOpenChange={onOpenChange}
      containerClass="flex"
      className="w-[340px] overflow-y-auto md:w-[500px]"
    >
      <Settings />
    </Dialog>
  );
}
