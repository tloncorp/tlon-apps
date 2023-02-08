import React from 'react';
import Dialog, { DialogContent } from './Dialog';

export interface ConfirmationModalProps {
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
}

export default function ConfirmationModal({
  title,
  open,
  setOpen,
  message,
  confirmText = 'Confirm',
  onConfirm,
}: ConfirmationModalProps) {
  return (
    <Dialog open={open}>
      <DialogContent showClose={false} containerClass="z-50">
        <div className="flex flex-col">
          <h1 className="mb-4 text-lg font-bold">{title}</h1>
          <p>{message}</p>
          <div className="mt-8 flex justify-end space-x-2">
            <button
              className="secondary-button w-24"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button className="button w-24 bg-red" onClick={onConfirm}>
              {confirmText}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
