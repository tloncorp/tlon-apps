import EditChannelForm from '@/channels/EditChannelForm';
import Dialog from '@/components/Dialog';
import { prettyChannelTypeName } from '@/logic/channel';
import { GroupChannel } from '@/types/groups';
import React from 'react';

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
    <Dialog
      open={editIsOpen}
      onOpenChange={setEditIsOpen}
      containerClass="w-full sm:max-w-lg"
      className="space-y-4 bg-transparent p-0"
      close="none"
    >
      <div className="card">
        <EditChannelForm
          nest={nest}
          channel={channel}
          retainRoute={true}
          presetSection={presetSection}
          redirect={false}
          setEditIsOpen={setEditIsOpen}
        />
      </div>
      <div className="card">
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
    </Dialog>
  );
}
