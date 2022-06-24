import React from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useChatState } from '../../state/chat';
import ColorPicker, { MultiDMInfoSchema } from './ColorPicker';

export interface MultiDMInfoFormProps {
  setEditIsOpen: (open: boolean) => void;
}

export default function MultiDMInfoForm({
  setEditIsOpen,
}: MultiDMInfoFormProps) {
  const clubId = useParams<{ ship: string }>().ship!;
  const defaultValues: MultiDMInfoSchema = {
    title: '',
    color: '#b3b3b3',
    image: '',
    description: '',
  };
  const clubMeta = useChatState
    .getState()
    .fetchMultiDm(clubId)
    .then((result) => {
      defaultValues.title = result.meta.title;
    });

  const { handleSubmit, register } = useForm<MultiDMInfoSchema>({
    defaultValues,
  });

  const onSubmit = async (values: MultiDMInfoSchema) => {
    await useChatState.getState().editMultiDm(clubId, values);
    setEditIsOpen(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
      <div className="mb-4 flex flex-col">
        <div className="py-4">
          <label htmlFor="title" className="w-full font-bold">
            Color
          </label>
          <ColorPicker register={register} />
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
