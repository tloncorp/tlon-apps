import React from 'react';
import Dialog, { DialogContent } from './Dialog';
import LoadingSpinner from './LoadingSpinner/LoadingSpinner';

export interface ConfirmationModalProps {
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  loading?: boolean;
}

export default function ConfirmationModal({
  title,
  open,
  setOpen,
  message,
  confirmText = 'Confirm',
  onConfirm,
  loading = false,
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
            <button
              disabled={loading}
              className="button center-items flex w-24 bg-red"
              onClick={onConfirm}
            >
              {loading ? <LoadingSpinner /> : confirmText}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
