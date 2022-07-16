import React, { useCallback } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import Dialog, { DialogContent } from '@/components/Dialog';
import { Channel, ChannelFormSchema, GroupMeta } from '@/types/groups';
import { useRouteGroup } from '@/state/groups';
import { useChatState } from '@/state/chat';
import { strToSym } from '@/logic/utils';
import ChannelPermsSelector from './ChannelPermsSelector';
import ChannelJoinSelector from './ChannelJoinSelector';

interface EditChannelModalProps {
  editIsOpen: boolean;
  setEditIsOpen: (open: boolean) => void;
  channel?: Channel;
  newChannel: boolean;
}

export default function EditChannelModal({
  editIsOpen,
  setEditIsOpen,
  channel,
  newChannel,
}: EditChannelModalProps) {
  const group = useRouteGroup();
  // const flag = useRouteGroup();
  const defaultValues: ChannelFormSchema = {
    zone: channel?.zone || null,
    added: channel?.added || Date.now(),
    readers: channel?.readers || [],
    join: channel?.join || false,
    meta: channel?.meta || {
      title: '',
      description: '',
      image: '',
      color: '',
    },
    privacy: 'public',
  };

  const form = useForm<ChannelFormSchema>({
    defaultValues,
  });

  const onSubmit = useCallback(
    async (values: ChannelFormSchema) => {
      if (newChannel === true) {
        const name = strToSym(values.meta.title);
        await useChatState
          .getState()
          .create({ ...values.meta, name, group, readers: [] });
      }
      setEditIsOpen(!editIsOpen);
    },
    [group, newChannel, editIsOpen, setEditIsOpen]
  );

  return (
    <Dialog open={editIsOpen} onOpenChange={setEditIsOpen}>
      <DialogContent showClose containerClass="max-w-lg">
        <FormProvider {...form}>
          <div className="sm:w-96">
            <header className="mb-3 flex items-center">
              <h2 className="text-lg font-bold">Edit Chat Channel</h2>
            </header>
          </div>
          <form
            className="flex flex-col"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <label className="font-semibold">
              Channel Name
              <input
                {...form.register('meta.title')}
                className="input my-2 block w-full p-1"
                type="text"
              />
            </label>
            <label className="font-semibold">
              Channel Permissions
              <ChannelPermsSelector />
            </label>
            <ChannelJoinSelector />

            <footer className="mt-4 flex items-center justify-between space-x-2">
              <div>
                <button className="red-text-button">Delete</button>
              </div>
              <div className="flex items-center space-x-2">
                <DialogPrimitive.Close asChild>
                  <button className="secondary-button ml-auto">Cancel</button>
                </DialogPrimitive.Close>
                <button
                  type="submit"
                  className="button"
                  disabled={!form.formState.isDirty}
                >
                  Done
                </button>
              </div>
            </footer>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
