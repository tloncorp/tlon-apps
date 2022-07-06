import React from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useChatState, useMultiDm } from '@/state/chat';
import { GroupMeta } from '@/types/groups';
import ColorPicker from '@/components/ColorPicker';

interface MultiDMInfoFormProps {
  setOpen: (open: boolean) => void;
}

export default function MultiDMInfoForm({ setOpen }: MultiDMInfoFormProps) {
  const clubId = useParams<{ ship: string }>().ship!;
  const club = useMultiDm(clubId);
  const defaultValues: GroupMeta = {
    title: club?.meta.title || '',
    color: club?.meta.color || '#b3b3b3',
    image: '',
    description: '',
  };

  const { handleSubmit, register, setValue, watch } = useForm<GroupMeta>({
    defaultValues,
  });

  const onSubmit = async (values: GroupMeta) => {
    await useChatState.getState().editMultiDm(clubId, values);
    setOpen(false);
  };

  const watchColor = watch('color');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
      <div className="mb-4 flex flex-col">
        <div className="py-4">
          <label htmlFor="title" className="w-full font-bold">
            Color
          </label>
          <ColorPicker
            className="mt-2"
            register={register}
            setColor={(newColor: string) => setValue('color', newColor || '')}
            color={watchColor as string}
          />
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
        <button type="submit" className="button">
          Done
        </button>
      </footer>
    </form>
  );
}
