import React from 'react';

import Dialog from './Dialog';
import LoadingSpinner from './LoadingSpinner/LoadingSpinner';

export interface ConfirmationModalProps {
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  closeOnClickOutside?: boolean;
  loading?: boolean;
  succeeded?: boolean;
}

export default function ConfirmationModal({
  title,
  open,
  setOpen,
  message,
  confirmText = 'Confirm',
  onConfirm,
  closeOnClickOutside = false,
  loading = false,
  succeeded = false,
}: ConfirmationModalProps) {
  const onOpenChange = closeOnClickOutside ? () => setOpen(false) : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      close="none"
      containerClass="z-50"
    >
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
            disabled={loading || succeeded}
            className="button center-items flex w-24 bg-red"
            onClick={onConfirm}
          >
            {loading ? <LoadingSpinner /> : succeeded ? 'Success' : confirmText}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
