import React from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useChatState, useMultiDm } from '../../state/chat';
import { GroupMeta } from '../../types/groups';
import ColorPicker from '../ColorPicker';

export default function MultiDMInfoForm() {
  const clubId = useParams<{ ship: string }>().ship!;
  const defaultValues: GroupMeta = {
    title: '',
    color: '#b3b3b3',
    image: '',
    description: '',
  };

  const club = useMultiDm(clubId);
  defaultValues.title = club?.meta.title || '';
  defaultValues.color = club?.meta.color || '';

  const { handleSubmit, register } = useForm<GroupMeta>({
    defaultValues,
  });

  const onSubmit = async (values: GroupMeta) => {
    await useChatState.getState().editMultiDm(clubId, values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
      <div className="mb-4 flex flex-col">
        <div className="py-4">
          <label htmlFor="title" className="w-full font-bold">
            Color
          </label>
          <ColorPicker className="mt-2" register={register} />
        </div>
        <div className="py-4">
          <label htmlFor="description" className=" w-full font-bold">
            Chat Name
          </label>
          <input
            {...register('title')}
            className="input mt-2 block w-full p-1"
            type="text"
          />
        </div>
      </div>
      <footer className="flex items-center space-x-2">
        <DialogPrimitive.Close asChild>
          <button className="button ml-auto">Cancel</button>
        </DialogPrimitive.Close>
        <DialogPrimitive.Close asChild>
          <button type="submit" className="button">
            Done
          </button>
        </DialogPrimitive.Close>
      </footer>
    </form>
  );
}
