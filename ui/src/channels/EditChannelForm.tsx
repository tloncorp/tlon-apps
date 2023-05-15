import React, { useCallback } from 'react';
import _ from 'lodash';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { GroupChannel, ChannelFormSchema } from '@/types/groups';
import { useDismissNavigate } from '@/logic/routing';
import {
  useEditChannelMutation,
  useGroup,
  useRouteGroup,
} from '@/state/groups';
import {
  channelHref,
  getPrivacyFromChannel,
  nestToFlag,
  prettyChannelTypeName,
} from '@/logic/utils';
import { useChatState } from '@/state/chat';
import ChannelPermsSelector from '@/groups/ChannelsList/ChannelPermsSelector';
import { useHeapState } from '@/state/heap/heap';
import { useDiaryState } from '@/state/diary';
import useChannel from '@/logic/useChannel';
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
  const dismiss = useDismissNavigate();
  const navigate = useNavigate();
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const sects = Object.keys(group?.cabals || {});
  const [app, channelFlag] = nestToFlag(nest);
  const chan = useChannel(nest);
  const { mutate: mutateEditChannel, status: editStatus } =
    useEditChannelMutation();
  const defaultValues: ChannelFormSchema = {
    zone: channel.zone || 'default',
    added: channel.added || Date.now(),
    readers: channel.readers || [],
    writers: chan?.perms.writers || [],
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
      const { privacy, readers, ...nextChannel } = values;

      if (presetSection) {
        nextChannel.zone = presetSection;
      }
      try {
        mutateEditChannel({
          flag: groupFlag,
          channel: {
            readers: readers.includes('members') ? [] : values.readers,
            ...nextChannel,
          },
          nest,
        });
      } catch (e) {
        console.log(e);
      }

      const chState =
        app === 'chat'
          ? useChatState.getState()
          : app === 'heap'
          ? useHeapState.getState()
          : useDiaryState.getState();

      if (privacy !== 'public') {
        const writersIncludesMembers = values.writers.includes('members');

        const writersToRemove = _.difference(
          chan?.perms.writers || [],
          values.writers
        );

        if (writersIncludesMembers) {
          await chState.delSects(channelFlag, sects);
        } else {
          await chState.delSects(channelFlag, writersToRemove);
          await chState.addSects(channelFlag, values.writers);
        }

      } else {
        await chState.delSects(channelFlag, sects);
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
      nest,
      groupFlag,
      sects,
      dismiss,
      navigate,
      redirect,
      retainRoute,
      setEditIsOpen,
      presetSection,
      mutateEditChannel,
      chan?.perms.writers,
    ]
  );

  return (
    <FormProvider {...form}>
      <div className="sm:w-96">
        <header className="mb-3 flex flex-col">
          <h2 className="text-lg font-bold leading-6">
            {prettyChannelTypeName(app)} Channel Details
          </h2>
          <p className="text-sm leading-5 text-gray-800">
            Edit the channel's details
          </p>
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
