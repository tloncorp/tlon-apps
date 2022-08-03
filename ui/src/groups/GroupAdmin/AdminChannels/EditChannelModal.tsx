import React from 'react';
import Dialog, { DialogContent } from '@/components/Dialog';
import { GroupChannel } from '@/types/groups';
import EditChannelForm from '@/channels/EditChannelForm';

interface EditChannelModalProps {
  nest: string;
  channel: GroupChannel;
  presetSection?: string;
  editIsOpen: boolean;
  setEditIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function EditChannelModal({
  nest,
  channel,
  editIsOpen,
  presetSection,
  setEditIsOpen,
}: EditChannelModalProps) {
  return (
    <Dialog open={editIsOpen} onOpenChange={setEditIsOpen}>
      <DialogContent containerClass="w-full sm:max-w-lg">
        <EditChannelForm
          nest={nest}
          channel={channel}
          retainRoute={true}
          presetSection={presetSection}
          redirect={false}
          setEditIsOpen={setEditIsOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
