import Dialog from '@/components/Dialog';
import { useDismissNavigate } from '@/logic/routing';

import EditCurioForm from './EditCurioForm';

export default function EditCurioModal() {
  const dismiss = useDismissNavigate();
  return (
    <Dialog
      defaultOpen
      onOpenChange={() => dismiss()}
      containerClass="w-full sm:max-w-lg"
    >
      <EditCurioForm />
    </Dialog>
  );
}
