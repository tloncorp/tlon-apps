import Dialog, { DialogContent } from '@/components/Dialog';
import { useDismissNavigate } from '@/logic/routing';
import React from 'react';
import EditCurioForm from './EditCurioForm';

export default function EditCurioModal() {
  const dismiss = useDismissNavigate();
  return (
    <Dialog defaultOpen onOpenChange={() => dismiss()}>
      <DialogContent containerClass="w-full sm:max-w-lg">
        <EditCurioForm />
      </DialogContent>
    </Dialog>
  );
}
