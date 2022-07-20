import React from 'react';
import Dialog, { DialogContent } from '@/components/Dialog';
import NewChannelForm from '@/channels/NewChannel/NewChannelForm';
import { Channel } from '@/types/groups';

interface EditChannelModalProps {
  channel: Channel;
  editIsOpen: boolean;
  setEditIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function EditChannelModal({
  channel,
  editIsOpen,
  setEditIsOpen,
}: EditChannelModalProps) {
  return (
    <Dialog open={editIsOpen} onOpenChange={setEditIsOpen}>
      <DialogContent containerClass="w-full sm:max-w-lg">
        <NewChannelForm
          channel={channel}
          newChannel={false}
          redirect={false}
          setEditIsOpen={setEditIsOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
