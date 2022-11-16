import React from 'react';
import { useDismissNavigate } from '@/logic/routing';
import Dialog, { DialogContent } from '../components/Dialog';
import MultiDMInfoForm from './MultiDMInfoForm';

export default function MultiDMEditModal() {
  const dismiss = useDismissNavigate();

  return (
    <Dialog defaultOpen onOpenChange={(open) => !open && dismiss()}>
      <DialogContent showClose containerClass="max-w-lg">
        <div className="sm:w-96">
          <header className="flex items-center ">
            <h2 className="text-xl font-bold">Edit Chat Info</h2>
          </header>
        </div>
        <MultiDMInfoForm setOpen={() => dismiss()} />
      </DialogContent>
    </Dialog>
  );
}
