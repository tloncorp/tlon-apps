import React, { useCallback } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { NewChannelFormSchema } from '@/types/groups';
import { useNavigate, useParams } from 'react-router';
import { useGroupState, useRouteGroup } from '@/state/groups';
import { strToSym, channelHref } from '@/logic/utils';
import { useChatState } from '@/state/chat';
import ChannelPermsSelector from '@/groups/GroupAdmin/AdminChannels/ChannelPermsSelector';
import ChannelJoinSelector from '@/groups/GroupAdmin/AdminChannels/ChannelJoinSelector';
import { useHeapState } from '@/state/heap/heap';
import ChannelTypeSelector from '../ChannelTypeSelector';

export default function NewChannelForm() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const groupFlag = useRouteGroup();
  const defaultValues: NewChannelFormSchema = {
    type: 'chat',
    zone: 'sectionless',
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
      const newChannelNest = `${type}/${newChannelFlag}`;

      if (privacy === 'secret') {
        nextChannel.readers.push('admin');
      } else {
        nextChannel.readers.splice(nextChannel.readers.indexOf('admin'), 1);
      }

      if (section) {
        nextChannel.zone = section;
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

      if (section) {
        await useGroupState
          .getState()
          .addChannelToZone(section, groupFlag, newChannelNest);
      } else {
        await useGroupState
          .getState()
          .addChannelToZone('sectionless', groupFlag, newChannelNest);
      }

      navigate(channelHref(groupFlag, newChannelNest));
    },
    [section, groupFlag, navigate]
  );

  return (
    <FormProvider {...form}>
      <div className="sm:w-96">
        <header className="mb-3 flex items-center">
          <h2 className="text-lg font-bold">Add New Channel</h2>
        </header>
      </div>
      <form className="flex flex-col" onSubmit={form.handleSubmit(onSubmit)}>
        <ChannelTypeSelector className="mb-5" />
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
