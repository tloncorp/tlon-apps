import React from 'react';
import Dialog, { DialogContent } from './Dialog';

export interface ConfirmationModalProps {
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  message: string;
  onConfirm: () => void;
}

export default function ConfirmationModal({
  title,
  open,
  setOpen,
  message,
  onConfirm,
}: ConfirmationModalProps) {
  return (
    <Dialog open={open}>
      <DialogContent showClose={false} containerClass="z-50">
        <div className="flex flex-col">
          <h1 className="mb-4 text-lg font-bold">{title}</h1>
          <p>{message}</p>
          <div className="mt-8 flex justify-center space-x-2">
            <button className="button w-24" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="button w-24 bg-red" onClick={onConfirm}>
              Confirm
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
