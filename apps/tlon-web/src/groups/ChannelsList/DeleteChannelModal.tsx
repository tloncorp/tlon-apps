import React from 'react';

import Dialog from '@/components/Dialog';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { Status } from '@/logic/status';
import { GroupChannel } from '@/types/groups';

interface DeleteChannelModalProps {
  deleteChannelIsOpen: boolean;
  setDeleteChannelIsOpen: (open: boolean) => void;
  onDeleteChannelConfirm: () => void;
  channel?: GroupChannel;
  deleteStatus: Status;
}

export default function DeleteChannelModal({
  deleteChannelIsOpen,
  setDeleteChannelIsOpen,
  onDeleteChannelConfirm,
  channel,
  deleteStatus,
}: DeleteChannelModalProps) {
  return (
    <Dialog
      open={deleteChannelIsOpen}
      onOpenChange={setDeleteChannelIsOpen}
      containerClass="max-w-lg"
    >
      <div className="sm:w-96">
        <header className="mb-3 flex items-center">
          <h2 className="text-lg font-bold">Delete Channel</h2>
        </header>
      </div>
      <p className="text-prose">
        Are you sure you want to delete “{channel?.meta.title}”? Deleting will
        also delete channel for containing members.
      </p>
      <footer className="mt-4 flex items-center justify-between space-x-2">
        <div className="ml-auto flex items-center space-x-2">
          <button
            className="secondary-button"
            onClick={() => setDeleteChannelIsOpen(false)}
          >
            Cancel
          </button>
          <button
            onClick={() => onDeleteChannelConfirm()}
            className="button bg-red text-white"
            disabled={deleteStatus === 'loading'}
          >
            {deleteStatus === 'loading' ? (
              <LoadingSpinner className="h-4 w-4" />
            ) : deleteStatus === 'error' ? (
              'Error'
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </footer>
    </Dialog>
  );
}
