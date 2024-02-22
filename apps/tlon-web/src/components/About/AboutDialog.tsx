import Dialog from '@/components/Dialog';
import { useDismissNavigate } from '@/logic/routing';

import About from './About';

export default function AboutDialog() {
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
      containerClass="p-0 w-[95vw] max-w-[500px]"
    >
      <About />
    </Dialog>
  );
}
