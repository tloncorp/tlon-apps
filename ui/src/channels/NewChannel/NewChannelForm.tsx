import React, { useCallback } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { NewChannelFormSchema } from '@/types/groups';
import { useNavigate } from 'react-router';
import { useDismissNavigate } from '@/logic/routing';
import { useGroupState, useRouteGroup } from '@/state/groups';
import { strToSym, channelHref } from '@/logic/utils';
import { useChatState } from '@/state/chat';
import ChannelPermsSelector from '@/groups/GroupAdmin/AdminChannels/ChannelPermsSelector';
import ChannelJoinSelector from '@/groups/GroupAdmin/AdminChannels/ChannelJoinSelector';
import { useHeapState } from '@/state/heap/heap';
import ChannelTypeSelector from '../ChannelTypeSelector';

interface NewChannelFormProps {
  retainRoute?: boolean;
  presetSection?: string;
  redirect?: boolean;
  setEditIsOpen?: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function NewChannelForm({
  retainRoute = false,
  presetSection,
  redirect = true,
  setEditIsOpen,
}: NewChannelFormProps) {
  const dismiss = useDismissNavigate();
  const navigate = useNavigate();
  const groupFlag = useRouteGroup();
  const defaultValues: NewChannelFormSchema = {
    type: 'chat',
    zone: null,
    added: Date.now(),
    readers: [],
    join: false,
    meta: {
      title: '',
      description: '',
      image: '',
      color: '',
    },
    privacy: 'public',
  };

  const form = useForm<NewChannelFormSchema>({
    defaultValues,
  });

  const onSubmit = useCallback(
    async (values: NewChannelFormSchema) => {
      const { privacy, type, ...nextChannel } = values;
      const channelName = strToSym(values.meta.title);
      const newChannelFlag = `${window.our}/${channelName}`;

      if (privacy === 'secret') {
        nextChannel.readers.push('admin');
      } else {
        nextChannel.readers.splice(nextChannel.readers.indexOf('admin'), 1);
      }

      if (presetSection) {
        nextChannel.zone = presetSection;
      }

      const creator =
        type === 'chat'
          ? useChatState.getState().create
          : useHeapState.getState().create;

      await creator({
        group: groupFlag,
        name: channelName,
        title: values.meta.title,
        description: values.meta.description,
        readers: values.readers,
        writers: privacy !== 'public' ? ['admin'] : [],
      });

      if (presetSection) {
        await useGroupState
          .getState()
          .addChannelToZone(presetSection, groupFlag, newChannelFlag);
      }

      if (retainRoute === true && setEditIsOpen) {
        setEditIsOpen(false);
      } else if (redirect === true) {
        navigate(channelHref(groupFlag, newChannelFlag));
      } else {
        dismiss();
      }
    },
    [
      groupFlag,
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
          <h2 className="text-lg font-bold">Add New Channel</h2>
        </header>
      </div>
      <form className="flex flex-col" onSubmit={form.handleSubmit(onSubmit)}>
        <ChannelTypeSelector />
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
              Add Channel
            </button>
          </div>
        </footer>
      </form>
    </FormProvider>
  );
}
