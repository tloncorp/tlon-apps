import React from 'react';
import { useForm } from 'react-hook-form';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import Dialog, { DialogContent } from '@/components/Dialog';
import { Channel, GroupMeta } from '@/types/groups';

interface EditChannelNameModalProps {
  editIsOpen: boolean;
  setEditIsOpen: (open: boolean) => void;
  channel: Channel;
}

export default function EditChannelNameModal({
  editIsOpen,
  setEditIsOpen,
  channel,
}: EditChannelNameModalProps) {
  const defaultValues: GroupMeta = {
    title: channel?.meta.title || '',
    description: channel?.meta.description || '',
    image: channel?.meta.image || '',
    color: channel?.meta.color || '',
  };

  const { handleSubmit, register, setValue, watch } = useForm<GroupMeta>({
    defaultValues,
  });

  // const onSubmit = async (values: GroupMeta) => {
  //   await useGroupState.getState().
  // }

  return (
    <Dialog open={editIsOpen} onOpenChange={setEditIsOpen}>
      <DialogContent showClose containerClass="max-w-lg">
        <div className="sm:w-96">
          <header className="flex items-center ">
            <h2 className="text-xl font-bold">Edit Name</h2>
          </header>
        </div>
        <form className="flex flex-col">
          <input
            {...register('title')}
            className="input my-2 block w-full p-1"
            type="text"
          />
          <footer className="mt-2 flex items-center space-x-2">
            <DialogPrimitive.Close asChild>
              <button className="button ml-auto">Cancel</button>
            </DialogPrimitive.Close>
            <button type="submit" className="button">
              Done
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
