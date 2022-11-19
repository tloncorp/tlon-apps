import React, { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { NewChannelFormSchema } from '@/types/groups';
import { useNavigate, useParams } from 'react-router';
import { useGroupState, useRouteGroup } from '@/state/groups';
import { strToSym } from '@/logic/utils';
import { useChatState } from '@/state/chat';
import ChannelPermsSelector from '@/groups/GroupAdmin/AdminChannels/ChannelPermsSelector';
import ChannelJoinSelector from '@/groups/GroupAdmin/AdminChannels/ChannelJoinSelector';
import { useHeapState } from '@/state/heap/heap';
import { useDiaryState } from '@/state/diary';
import { useIsMobile } from '@/logic/useMedia';
import ChannelTypeSelector from '@/channels/ChannelTypeSelector';
import { Status } from '@/logic/status';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

export default function NewChannelForm() {
  const { section } = useParams<{ section: string }>();
  const [addChannelStatus, setAddChannelStatus] = useState<Status>('initial');
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const groupFlag = useRouteGroup();
  const defaultValues: NewChannelFormSchema = {
    type: 'chat',
    zone: 'default',
    added: Date.now(),
    readers: [],
    join: false,
    meta: {
      title: '',
      description: '',
      image: '',
      cover: '',
    },
    privacy: 'public',
  };

  const form = useForm<NewChannelFormSchema>({
    defaultValues,
    mode: 'onChange',
  });

  const onSubmit = useCallback(
    async (values: NewChannelFormSchema) => {
      setAddChannelStatus('loading');
      const { privacy, type, ...nextChannel } = values;
      /*
        For now channel names are used as keys for pacts. Therefore we need to
        check if a channel with the same name already exists in the chat store. If it does, we
        need to append a timestamp to the end of the name of the new channel.

        Timestamps are used because they are virtually guaranteed to be unique.

        In the future, we will index channels by their full path (including group name), and this will no
        longer be necessary. That change will require a migration of existing channels.
       */
      const tempChannelName = strToSym(values.meta.title).replace(
        /[^a-z]*([a-z][-\w\d]+)/i,
        '$1'
      );
      const tempNewChannelFlag = `${window.our}/${tempChannelName}`;
      const existingChannel = () => {
        if (type === 'chat') {
          return useChatState.getState().chats[tempNewChannelFlag];
        }

        if (type === 'diary') {
          return useDiaryState.getState().notes[tempNewChannelFlag];
        }

        if (type === 'heap') {
          return useHeapState.getState().stash[tempNewChannelFlag];
        }

        return false;
      };

      const randomSmallNumber = Math.floor(Math.random() * 100);
      const channelName = existingChannel()
        ? `${tempChannelName}-${randomSmallNumber}`
        : tempChannelName;
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
          : type === 'heap'
          ? useHeapState.getState().create
          : useDiaryState.getState().create;

      try {
        await creator({
          group: groupFlag,
          name: channelName,
          title: values.meta.title,
          description: values.meta.description,
          readers: values.readers,
          writers: privacy !== 'public' ? ['admin'] : [],
        });
      } catch (e) {
        setAddChannelStatus('error');
        console.log(e);
      }

      if (section) {
        try {
          await useGroupState
            .getState()
            .addChannelToZone(section, groupFlag, newChannelNest);
        } catch (e) {
          setAddChannelStatus('error');
          console.log(e);
        }
      }

      if (values.join === true) {
        await useGroupState
          .getState()
          .setChannelJoin(groupFlag, newChannelNest, true);
      }
      setAddChannelStatus('success');
      navigate(
        isMobile ? `/groups/${groupFlag}` : `/groups/${groupFlag}/info/channels`
      );
    },
    [section, groupFlag, navigate, isMobile]
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
          Channel Name*
          <input
            {...form.register('meta.title', { required: true })}
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
              disabled={
                !form.formState.isValid ||
                !form.formState.isDirty ||
                addChannelStatus === 'loading' ||
                addChannelStatus === 'success' ||
                addChannelStatus === 'error'
              }
            >
              {addChannelStatus === 'loading' ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : addChannelStatus === 'error' ? (
                'Error'
              ) : addChannelStatus === 'success' ? (
                'Saved'
              ) : (
                'Add Channel'
              )}
            </button>
          </div>
        </footer>
      </form>
    </FormProvider>
  );
}
