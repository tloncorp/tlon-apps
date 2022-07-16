import React, { useCallback } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import Dialog, { DialogContent } from '@/components/Dialog';
import { Channel, ChannelFormSchema, GroupMeta } from '@/types/groups';
import { useDismissNavigate } from '@/logic/routing';
import { useGroupState, useRouteGroup } from '@/state/groups';
import { useChatState } from '@/state/chat';
import { strToSym } from '@/logic/utils';
import ChannelPermsSelector from '@/groups/GroupAdmin/AdminChannels/ChannelPermsSelector';
import ChannelJoinSelector from '@/groups/GroupAdmin/AdminChannels/ChannelJoinSelector';

// import React from 'react';
// import { useForm } from 'react-hook-form';
// import { useNavigate } from 'react-router';
// import { useChatState } from '../../state/chat';
// import { useRouteGroup } from '../../state/groups/groups';
// import { channelHref, strToSym } from '../../logic/utils';

// interface FormSchema {
//   title: string;
//   description: string;
// }

// export default function NewChannelForm() {
//   const group = useRouteGroup();
//   const navigate = useNavigate();
//   const flag = useRouteGroup();
//   const defaultValues: FormSchema = {
//     title: '',
//     description: '',
//   };
//   const { handleSubmit, register } = useForm<FormSchema>({ defaultValues });
//   const onSubmit = async (values: FormSchema) => {
//     const name = strToSym(values.title);
//     await useChatState
//       .getState()
//       .create({ ...values, name, group, readers: [] });
//     navigate(channelHref(flag, name));
//   };
//   return (
//     <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
//       <div className="p-2">
//         <label htmlFor="title">Title</label>
//         <input
//           {...register('title')}
//           className="rounded border"
//           type="text"
//           name="title"
//         />
//       </div>
//       <div className="p-2">
//         <label htmlFor="description">Description</label>
//         <input
//           {...register('description')}
//           className="rounded border"
//           type="text"
//           name="description"
//         />
//       </div>
//       <button type="submit">Submit</button>
//     </form>
//   );
// }

// import React, { useCallback } from 'react';
// import { FormProvider, useForm } from 'react-hook-form';
// import * as DialogPrimitive from '@radix-ui/react-dialog';
// import Dialog, { DialogContent } from '@/components/Dialog';
// import { Channel, ChannelFormSchema, GroupMeta } from '@/types/groups';
// import {  useRouteGroup } from '@/state/groups';
// import { useChatState } from '@/state/chat'
// import {strToSym} from '@/logic/utils';
// import ChannelPermsSelector from './ChannelPermsSelector';
// import ChannelJoinSelector from './ChannelJoinSelector';

// interface EditChannelModalProps {
//   editIsOpen: boolean;
//   setEditIsOpen: (open: boolean) => void;
//   channel?: Channel;
//   newChannel: boolean
// }

interface EditChannelModalProps {
  // editIsOpen: boolean;
  // setEditIsOpen: (open: boolean) => void;
  channel?: Channel;
  newChannel: boolean;
}
export default function EditChannelModal({
  channel,
  newChannel,
}: EditChannelModalProps) {
  const dismiss = useDismissNavigate();

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  const group = useRouteGroup();
  const flag = useRouteGroup();
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
        await useGroupState.getState().setChannelJoin(flag, '', values.join);
      }
      dismiss();
    },
    [group, newChannel, dismiss, flag]
  );

  return (
    // <Dialog onOpenChange={onOpenChange}>
    //   <DialogContent showClose containerClass="max-w-lg">
    <FormProvider {...form}>
      <div className="sm:w-96">
        <header className="mb-3 flex items-center">
          <h2 className="text-lg font-bold">Edit Chat Channel</h2>
        </header>
      </div>
      <form className="flex flex-col" onSubmit={form.handleSubmit(onSubmit)}>
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
    //   </DialogContent>
    // </Dialog>
  );
}
