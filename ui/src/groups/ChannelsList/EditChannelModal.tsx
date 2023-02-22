import React from 'react';
import Dialog, {
  DialogContent,
  SecondaryDialogContent,
} from '@/components/Dialog';
import { GroupChannel } from '@/types/groups';
import EditChannelForm from '@/channels/EditChannelForm';
import { prettyChannelTypeName } from '@/logic/utils';

interface EditChannelModalProps {
  nest: string;
  channel: GroupChannel;
  presetSection?: string;
  editIsOpen: boolean;
  setEditIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  app: string;
}

export default function EditChannelModal({
  nest,
  channel,
  editIsOpen,
  presetSection,
  setEditIsOpen,
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
      </DialogContent>
      <SecondaryDialogContent
        containerClass="w-full sm:max-w-lg"
        showClose={false}
      >
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
              setEditIsOpen(false);
            }}
          >
            Delete &quot;{channel.meta.title}&quot;
          </button>
        </div>
      </SecondaryDialogContent>
    </Dialog>
  );
}
