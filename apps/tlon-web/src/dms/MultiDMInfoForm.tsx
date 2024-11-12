import * as DialogPrimitive from '@radix-ui/react-dialog';
import { GroupMeta } from '@tloncorp/shared/urbit/groups';
import React, { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';

import ImageOrColorField, {
  ImageOrColorFieldState,
} from '@/components/ImageOrColorField';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ColorBoxIcon from '@/components/icons/ColorBoxIcon';
import EmptyIconBox from '@/components/icons/EmptyIconBox';
import GroupAvatar from '@/groups/GroupAvatar';
import { Status } from '@/logic/status';
import { isValidUrl } from '@/logic/utils';
import { useEditMultiDm, useMultiDm } from '@/state/chat';

interface MultiDMInfoFormProps {
  setEditing: (editing: boolean) => void;
  setOpen: (open: boolean) => void;
}

export default function MultiDMInfoForm({
  setOpen,
  setEditing,
}: MultiDMInfoFormProps) {
  const clubId = useParams<{ id: string }>().id!;
  const club = useMultiDm(clubId);
  const [iconType, setIconType] = useState<ImageOrColorFieldState>('color');
  const [editStatus, setEditStatus] = useState<Status>('initial');
  const { mutateAsync: editMultiDm } = useEditMultiDm();
  const defaultValues: GroupMeta = {
    title: club?.meta.title || '',
    cover: club?.meta.cover || '',
    image: club?.meta.image || '#b3b3b3',
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

  useEffect(() => {
    if (isValidUrl(watchImage)) {
      setIconType('image');
    } else {
      setIconType('color');
    }
  }, [watchImage]);

  const onSubmit = useCallback(
    async (values: GroupMeta) => {
      try {
        setEditStatus('loading');

        await editMultiDm({ id: clubId, meta: values });

        setEditStatus('success');
        setOpen(false);
      } catch (error) {
        setEditStatus('error');
      }
    },
    [clubId, setOpen, editMultiDm]
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
        <div className="mb-4 flex flex-col">
          <div className="flex items-center space-x-3 py-4">
            {iconType === 'color' ? (
              <ColorBoxIcon
                className="h-14 w-14 shrink-0 text-xl"
                color={watchImage ? watchImage : '#000000'}
                letter={letter ? letter : 'T'}
              />
            ) : null}
            {iconType === 'image' && isValidUrl(watchImage) ? (
              <GroupAvatar
                size="h-14 w-14"
                className="shrink-0"
                image={watchImage}
              />
            ) : null}
            {showEmpty ? (
              <EmptyIconBox className="h-14 w-14 shrink-0 text-gray-300" />
            ) : null}
            <div className="flex-1 space-y-1.5">
              <label htmlFor="title" className="w-full font-bold">
                Chat Icon*
              </label>
              <ImageOrColorField fieldName="image" />
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
          <button
            onClick={() => setEditing(false)}
            className="secondary-button ml-auto"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="button"
            disabled={editStatus !== 'initial'}
          >
            {editStatus === 'initial' ? (
              'Save'
            ) : editStatus === 'loading' ? (
              <>
                <LoadingSpinner className="mr-2 h-4 w-4" />
                Saving
              </>
            ) : (
              'Errored'
            )}
          </button>
        </footer>
      </form>
    </FormProvider>
  );
}
