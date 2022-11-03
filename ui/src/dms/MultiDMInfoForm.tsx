import React, { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useChatState, useMultiDm } from '@/state/chat';
import { GroupMeta } from '@/types/groups';
import ImageOrColorField, {
  ImageOrColorFieldState,
} from '@/components/ImageOrColorField';
import ColorBoxIcon from '@/components/icons/ColorBoxIcon';
import EmptyIconBox from '@/components/icons/EmptyIconBox';
import GroupAvatar from '@/groups/GroupAvatar';
import { isValidUrl } from '@/logic/utils';

interface MultiDMInfoFormProps {
  setOpen: (open: boolean) => void;
}

export default function MultiDMInfoForm({ setOpen }: MultiDMInfoFormProps) {
  const clubId = useParams<{ id: string }>().id!;
  const club = useMultiDm(clubId);
  const [iconType, setIconType] = useState<ImageOrColorFieldState>('color');
  const defaultValues: GroupMeta = {
    title: club?.meta.title || '',
    cover: club?.meta.cover || '',
    image: '#b3b3b3',
    description: '',
  };

  const form = useForm<GroupMeta>({
    defaultValues,
  });

  const { handleSubmit, register, watch } = form;

  const watchImage = watch('image');
  const watchTitle = watch('title');
  const letter = watchTitle.slice(0, 1);
  const showEmpty = iconType === 'image' && !isValidUrl(watchImage);

  const onSubmit = useCallback(
    (values: GroupMeta) => {
      setOpen(false);
      useChatState.getState().editMultiDm(clubId, values);
    },
    [clubId, setOpen]
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
        <div className="mb-4 flex flex-col">
          <div className="flex items-center space-x-3 py-4">
            {iconType === 'color' ? (
              <ColorBoxIcon
                className="ml-2 h-14 w-14 text-xl"
                color={watchImage ? watchImage : '#000000'}
                letter={letter ? letter : 'T'}
              />
            ) : null}
            {iconType === 'image' && isValidUrl(watchImage) ? (
              <GroupAvatar size="ml-2 h-14 w-14" image={watchImage} />
            ) : null}
            {showEmpty ? (
              <EmptyIconBox className="ml-2 h-14 w-14 text-gray-300" />
            ) : null}
            <div className="flex-1 space-y-1.5">
              <label htmlFor="title" className="w-full font-bold">
                Chat Icon*
              </label>
              <ImageOrColorField
                fieldName="image"
                state={iconType}
                setState={setIconType}
              />
            </div>
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
    </FormProvider>
  );
}
