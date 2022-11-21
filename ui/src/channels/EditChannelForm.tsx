import React, { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { GroupChannel, ChannelFormSchema } from '@/types/groups';
import { useNavigate } from 'react-router';
import { useDismissNavigate } from '@/logic/routing';
import { useGroupState, useRouteGroup } from '@/state/groups';
import { channelHref, getPrivacyFromChannel, nestToFlag } from '@/logic/utils';
import { useChatState } from '@/state/chat';
import ChannelPermsSelector from '@/groups/GroupAdmin/AdminChannels/ChannelPermsSelector';
import ChannelJoinSelector from '@/groups/GroupAdmin/AdminChannels/ChannelJoinSelector';
import { useHeapState } from '@/state/heap/heap';
import { useDiaryState } from '@/state/diary';
import useChannel from '@/logic/useChannel';
import { Status } from '@/logic/status';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

interface EditChannelFormProps {
  nest: string;
  channel: GroupChannel;
  retainRoute?: boolean;
  presetSection?: string;
  redirect?: boolean;
  setEditIsOpen?: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function EditChannelForm({
  nest,
  channel,
  retainRoute = false,
  presetSection,
  redirect = true,
  setEditIsOpen,
}: EditChannelFormProps) {
  const [editStatus, setEditStatus] = useState<Status>('initial');
  const dismiss = useDismissNavigate();
  const navigate = useNavigate();
  const groupFlag = useRouteGroup();
  const [app, channelFlag] = nestToFlag(nest);
  const chan = useChannel(nest);
  const defaultValues: ChannelFormSchema = {
    zone: channel.zone || 'default',
    added: channel.added || Date.now(),
    readers: channel.readers || [],
    join: channel.join || false,
    meta: channel.meta || {
      title: '',
      description: '',
      image: '',
      color: '',
    },
    privacy: getPrivacyFromChannel(channel, chan),
  };

  const form = useForm<ChannelFormSchema>({
    defaultValues,
  });

  const onSubmit = useCallback(
    async (values: ChannelFormSchema) => {
      setEditStatus('loading');
      const { privacy, ...nextChannel } = values;

      if (privacy === 'secret') {
        nextChannel.readers.push('admin');
      } else {
        nextChannel.readers.splice(nextChannel.readers.indexOf('admin'), 1);
      }

      if (presetSection) {
        nextChannel.zone = presetSection;
      }
      try {
        await useGroupState
          .getState()
          .editChannel(groupFlag, nest, nextChannel);
        setEditStatus('success');
      } catch (e) {
        setEditStatus('error');
        console.log(e);
      }

      const chState =
        app === 'chat'
          ? useChatState.getState()
          : app === 'heap'
          ? useHeapState.getState()
          : useDiaryState.getState();

      if (privacy !== 'public') {
        chState.addSects(channelFlag, ['admin']);
      } else {
        chState.delSects(channelFlag, ['admin']);
      }

      if (retainRoute === true && setEditIsOpen) {
        setEditIsOpen(false);
      } else if (redirect === true) {
        navigate(channelHref(groupFlag, channelFlag));
      } else {
        dismiss();
      }
    },
    [
      app,
      channelFlag,
      groupFlag,
      nest,
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
          Channel Name*
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
              disabled={
                !form.formState.isDirty ||
                editStatus === 'loading' ||
                editStatus === 'success' ||
                editStatus === 'error'
              }
            >
              {editStatus === 'loading' ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : editStatus === 'error' ? (
                'Error'
              ) : editStatus === 'success' ? (
                'Success'
              ) : (
                'Done'
              )}
            </button>
          </div>
        </footer>
      </form>
    </FormProvider>
  );
}
