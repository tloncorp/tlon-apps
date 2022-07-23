import React, { useCallback } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Channel, ChannelFormSchema } from '@/types/groups';
import { useNavigate } from 'react-router';
import { useDismissNavigate } from '@/logic/routing';
import { useGroupState, useRouteGroup } from '@/state/groups';
import { strToSym, channelHref } from '@/logic/utils';
import ChannelPermsSelector from '@/groups/GroupAdmin/AdminChannels/ChannelPermsSelector';
import ChannelJoinSelector from '@/groups/GroupAdmin/AdminChannels/ChannelJoinSelector';

interface NewChannelFormProps {
  flag?: string;
  channel?: Channel;
  retainRoute?: boolean;
  presetSection?: string;
  redirect?: boolean;
  setEditIsOpen?: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function NewChannelForm({
  channel,
  retainRoute = false,
  presetSection,
  redirect = true,
  setEditIsOpen,
}: NewChannelFormProps) {
  const dismiss = useDismissNavigate();
  const navigate = useNavigate();

  const group = useRouteGroup();
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
      const { privacy, ...nextChannel } = values;
      const name = strToSym(values.meta.title);

      if (privacy === 'secret') {
        nextChannel.readers.push('admin');
      }

      if (presetSection) {
        nextChannel.zone = presetSection;
      }

      await useGroupState.getState().addOrEditChannel(group, name, nextChannel);

      if (retainRoute === true && setEditIsOpen) {
        setEditIsOpen(false);
      } else if (redirect === true) {
        navigate(channelHref(group, `${window.our}/${name}`));
      } else {
        dismiss();
      }
    },
    [
      group,
      dismiss,
      navigate,
      redirect,
      retainRoute,
      setEditIsOpen,
      presetSection,
    ]
  );

  return (
    <FormProvider {...form}>
      <div className="sm:w-96">
        <header className="mb-3 flex items-center">
          <h2 className="text-lg font-bold">Edit Chat Channel</h2>
        </header>
      </div>
      <form className="flex flex-col" onSubmit={form.handleSubmit(onSubmit)}>
        <label className="mb-3 font-semibold">
          Channel Name
          <input
            {...form.register('meta.title')}
            className="input my-2 block w-full p-1"
            type="text"
          />
        </label>
        <label className="mb-3 font-semibold">
          Channel Permissions
          <ChannelPermsSelector />
        </label>
        <ChannelJoinSelector />

        <footer className="mt-4 flex items-center justify-between space-x-2">
          <div className="ml-auto flex items-center space-x-2">
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
  );
}
