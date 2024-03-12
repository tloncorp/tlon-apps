import * as DialogPrimitive from '@radix-ui/react-dialog';
import { SortMode } from '@tloncorp/shared/dist/urbit/channel';
import {
  ChannelFormSchema,
  GroupChannel,
} from '@tloncorp/shared/dist/urbit/groups';
import _ from 'lodash';
import React, { useCallback } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ChannelPermsSelector from '@/groups/ChannelsList/ChannelPermsSelector';
import { channelHref, prettyChannelTypeName } from '@/logic/channel';
import { useDismissNavigate } from '@/logic/routing';
import { getPrivacyFromChannel, nestToFlag } from '@/logic/utils';
import {
  useAddSectsMutation,
  useChannel,
  useDeleteSectsMutation,
  useSortMutation,
  useViewMutation,
} from '@/state/channel/channel';
import {
  useEditChannelMutation,
  useGroup,
  useRouteGroup,
} from '@/state/groups';

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
  const chan = useChannel(nest);
  const { mutate: mutateEditChannel, status: editStatus } =
    useEditChannelMutation();
  const { mutateAsync: addSectsMutation } = useAddSectsMutation();
  const { mutateAsync: delSectsMutation } = useDeleteSectsMutation();
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
    sort: chan?.sort,
    view: chan?.view,
  };

  const form = useForm<ChannelFormSchema>({
    defaultValues,
  });

  const makeDiaryNest = (flag: string) => `diary/${flag}`;
  const makeHeapNest = (flag: string) => `heap/${flag}`;
  const makeChatNest = (flag: string) => `chat/${flag}`;

  const onSubmit = useCallback(
    async (values: ChannelFormSchema) => {
      const { privacy, readers, sort, view, ...nextChannel } = values;

      if (sort) {
        changeDiarySort({
          nest: makeDiaryNest(channelFlag),
          sort: sort as SortMode,
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
              addSectsMutation({ nest: makeDiaryNest(flag), writers })
          : app === 'heap'
            ? (flag: string, writers: string[]) =>
                addSectsMutation({ nest: makeHeapNest(flag), writers })
            : (flag: string, writers: string[]) =>
                addSectsMutation({ nest: makeChatNest(flag), writers });
      const delSects =
        app === 'diary'
          ? (flag: string, writers: string[]) =>
              delSectsMutation({ nest: makeDiaryNest(flag), writers })
          : app === 'heap'
            ? (flag: string, writers: string[]) =>
                delSectsMutation({ nest: makeHeapNest(flag), writers })
            : (flag: string, writers: string[]) =>
                delSectsMutation({ nest: makeChatNest(flag), writers });

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
      addSectsMutation,
      delSectsMutation,
      changeDiarySort,
      changeDiaryView,
    ]
  );

  return (
    <FormProvider {...form}>
      <form
        className="flex w-full flex-col"
        onSubmit={form.handleSubmit(onSubmit)}
      >
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
