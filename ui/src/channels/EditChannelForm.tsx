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
import {
  useAddHeapSectsMutation,
  useDelHeapSectsMutation,
} from '@/state/heap/heap';
import {
  useAddSectsMutation,
  useDeleteSectsMutation,
  useChannel as useChannelState,
  useSortMutation,
  useViewMutation,
} from '@/state/channel/channel';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useChannelOld } from '@/logic/channel';
import { DiarySortMode } from '@/types/diary';
import ChannelSortSelector from './ChannelSortSelector';
import ChannelViewSelector from './ChannelViewSelector';

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
  const diary = useChannelState(channelFlag);
  const chan = useChannelOld(nest);
  const { mutate: mutateEditChannel, status: editStatus } =
    useEditChannelMutation();
  const { mutateAsync: addDiarySects } = useAddSectsMutation();
  const { mutateAsync: delDiarySects } = useDeleteSectsMutation();
  const { mutateAsync: addHeapSects } = useAddHeapSectsMutation();
  const { mutateAsync: delHeapSects } = useDelHeapSectsMutation();
  const { mutate: changeDiarySort } = useSortMutation();
  const { mutate: changeDiaryView } = useViewMutation();
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
    sort: diary?.sort,
    view: diary?.view,
  };

  const form = useForm<ChannelFormSchema>({
    defaultValues,
  });

  const makeDiaryNest = (flag: string) => `diary/${flag}`;

  const onSubmit = useCallback(
    async (values: ChannelFormSchema) => {
      const { privacy, readers, sort, view, ...nextChannel } = values;

      if (sort) {
        changeDiarySort({
          nest: makeDiaryNest(channelFlag),
          sort: sort as DiarySortMode,
        });
      }

      if (view) {
        changeDiaryView({ nest: makeDiaryNest(channelFlag), view });
      }

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

      const addSects =
        app === 'diary'
          ? (flag: string, writers: string[]) =>
              addDiarySects({ nest: makeDiaryNest(flag), writers })
          : app === 'heap'
          ? (flag: string, writers: string[]) =>
              addHeapSects({ flag, sects: writers })
          : useChatState.getState().addSects;
      const delSects =
        app === 'diary'
          ? (flag: string, writers: string[]) =>
              delDiarySects({ nest: makeDiaryNest(flag), writers })
          : app === 'heap'
          ? (flag: string, writers: string[]) =>
              delHeapSects({ flag, sects: writers })
          : useChatState.getState().delSects;

      if (privacy !== 'public') {
        await addSects(
          channelFlag,
          values.writers.filter((w) => w !== 'members')
        );
        await delSects(
          channelFlag,
          _.difference(chan?.perms.writers || [], values.writers)
        );
      } else {
        await delSects(channelFlag, sects);
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
      addDiarySects,
      delDiarySects,
      addHeapSects,
      delHeapSects,
      changeDiarySort,
      changeDiaryView,
    ]
  );

  return (
    <FormProvider {...form}>
      <div className="sm:w-96">
        <header className="mb-3 flex flex-col">
          <h2 className="text-lg font-bold leading-6">
            {prettyChannelTypeName(app)} Channel Details
          </h2>
          <p className="text-sm leading-5 text-gray-600">
            Edit the channel&apos;s details
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
          Channel Description
          <input
            {...form.register('meta.description')}
            className="input my-2 block w-full p-1"
            type="text"
          />
        </label>
        <label className="mb-3 font-semibold">
          Channel Permissions
          <ChannelPermsSelector />
        </label>
        {app === 'diary' && (
          <>
            <label className="mb-3 font-semibold">
              Default Sort
              <ChannelSortSelector />
            </label>
            <label className="mb-3 font-semibold">
              Default View
              <ChannelViewSelector />
            </label>
          </>
        )}

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
