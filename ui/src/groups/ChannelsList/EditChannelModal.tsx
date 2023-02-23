import React from 'react';
import Dialog, { DialogContent } from '@/components/Dialog';
import { GroupChannel } from '@/types/groups';
import EditChannelForm from '@/channels/EditChannelForm';
import { prettyChannelTypeName } from '@/logic/utils';

interface EditChannelModalProps {
  nest: string;
  channel: GroupChannel;
  presetSection?: string;
  editIsOpen: boolean;
  setEditIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteChannelIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  app: string;
}

export default function EditChannelModal({
  nest,
  channel,
  editIsOpen,
  presetSection,
  setEditIsOpen,
  setDeleteChannelIsOpen,
  app,
}: EditChannelModalProps) {
  return (
    <Dialog open={editIsOpen} onOpenChange={setEditIsOpen}>
      <DialogContent containerClass="w-full sm:max-w-lg" showClose={false}>
        <EditChannelForm
          nest={nest}
          channel={channel}
          retainRoute={true}
          presetSection={presetSection}
          redirect={false}
          setEditIsOpen={setEditIsOpen}
        />
        <div className="secondary-dialog-container mt-[200px] w-[480px] rounded-xl bg-white sm:max-w-lg">
          <div className="sm:w-96">
            <h2 className="mb-2 text-lg font-semibold">
              Delete {prettyChannelTypeName(app)}
            </h2>
            <p className="mb-4 leading-5 text-gray-800">
              Deleting this channel will remove it from the group&apos;s sidebar
              and all content posted to it will be in an archived state.
            </p>
            <button
              className="button bg-red text-white"
              onClick={() => {
                setDeleteChannelIsOpen(true);
              }}
            >
              Delete &quot;{channel.meta.title}&quot;
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
