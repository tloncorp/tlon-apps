import React from 'react';
import Dialog, { DialogContent } from '@/components/Dialog';
import NewChannelForm from '@/channels/NewChannel/NewChannelForm';
import { Channel } from '@/types/groups';

interface EditChannelModalProps {
  channel?: Channel;
  presetSection?: string;
  editIsOpen: boolean;
  setEditIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function EditChannelModal({
  channel,
  editIsOpen,
  presetSection,
  setEditIsOpen,
}: EditChannelModalProps) {
  return (
    <Dialog open={editIsOpen} onOpenChange={setEditIsOpen}>
      <DialogContent containerClass="w-full sm:max-w-lg">
        <NewChannelForm
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
