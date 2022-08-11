import React, { useState } from 'react';
import cn from 'classnames';
import { useFormContext } from 'react-hook-form';
import { ContactEditField } from '@urbit/api';
import ColorPicker from '@/components/ColorPicker';
import CheckIcon from '@/components/icons/CheckIcon';
import { isValidUrl, normalizeUrbitColor } from '@/logic/utils';
import LinkIcon from '@/components/icons/LinkIcon';

interface ProfileFormSchema extends ContactEditField {
  isContactPublic: boolean;
}

export default function ProfileFields() {
  const { register, watch, setValue, formState } =
    useFormContext<ProfileFormSchema>();
  const { errors } = formState;
  const [headerFieldFocused, setHeaderFieldFocused] = useState<boolean>(false);
  const [avatarFieldFocused, setAvatarFieldFocused] = useState<boolean>(false);
  const watchAvatar = watch('avatar');
  const watchCover = watch('cover');
  const avatarHasLength = watchAvatar?.length;
  const coverHasLength = watchCover?.length;
  const watchSigilColor = watch('color');
  const isPublicSelected = watch('isContactPublic') === true;

  const setColor = (newColor: string) => {
    setValue('color', normalizeUrbitColor(newColor), {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  return (
    <>
      <div className="flex">
        <div className="flex grow flex-col">
          <span className="pb-2 font-bold">Sigil Color</span>
          <div className="flex items-center space-x-2">
            <div className="relative flex w-full items-baseline">
              <ColorPicker
                color={normalizeUrbitColor(watchSigilColor || '0x0')}
                setColor={setColor}
              />
            </div>
            {errors.color ? (
              <span className="text-sm">{errors.color.message}</span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <label htmlFor="headerImage" className="pb-2 font-bold">
          Overlay Avatar
        </label>
        <div className="relative flex w-full items-baseline">
          <input
            className={cn('input grow')}
            onFocus={() => setAvatarFieldFocused(true)}
            {...register('avatar', {
              onBlur: () => setAvatarFieldFocused(false),
              validate: (value) =>
                value && value.length ? isValidUrl(value) : true,
            })}
          />
          {!avatarFieldFocused && !avatarHasLength ? (
            <div className="pointer-events-none absolute left-[0.5625rem] top-2 flex cursor-pointer items-center">
              <LinkIcon className="mr-1 inline h-4 w-4 fill-gray-100" />
              <span className="pointer-events-none">Paste an image URL</span>
            </div>
          ) : null}
        </div>
        <div className="mt-1 text-sm font-semibold text-gray-600">
          Overlay avatars may be hidden by others
        </div>
      </div>
      <div className="flex flex-col">
        <label htmlFor="headerImage" className="pb-2 font-bold">
          Header
        </label>
        <div className="relative flex w-full items-baseline">
          <input
            className={cn('input grow')}
            onFocus={() => setHeaderFieldFocused(true)}
            {...register('cover', {
              onBlur: () => setHeaderFieldFocused(false),
              validate: (value) =>
                value && value.length ? isValidUrl(value) : true,
            })}
          />
          {!headerFieldFocused && !coverHasLength ? (
            <div className="pointer-events-none absolute left-[0.5625rem] top-2 flex cursor-pointer items-center">
              <LinkIcon className="mr-1 inline h-4 w-4 fill-gray-100" />
              <span className="pointer-events-none">Paste an image URL</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col">
        <label htmlFor="nickname" className="pb-2 font-bold">
          Display Name
        </label>
        <input
          // TODO: set sane maxLength
          {...register('nickname', { maxLength: 180 })}
          className="input"
          type="text"
          placeholder="Name"
        />
      </div>
      <div className="flex flex-col">
        <label htmlFor="bio" className="pb-2 font-bold">
          Bio
        </label>
        <textarea
          // TODO: set sane maxLength
          {...register('bio', { maxLength: 1000 })}
          className="input"
        />
      </div>
      <label
        className={
          'flex cursor-pointer items-start justify-between space-x-2 py-2'
        }
      >
        <div className="flex items-center">
          {isPublicSelected ? (
            <div className="flex h-4 w-4 items-center rounded-sm border-2 border-gray-400">
              <CheckIcon className="h-3 w-3 fill-gray-400" />
            </div>
          ) : (
            <div className="h-4 w-4 rounded-sm border-2 border-gray-200" />
          )}
        </div>

        <div className="flex w-full flex-col">
          <div className="flex flex-row space-x-2">
            <div className="flex w-full flex-col justify-start text-left">
              <span className="font-semibold">Make Profile Private</span>
              <span className="text-sm text-gray-600">
                Only Ship Name and Sigil will be publicly visible
              </span>
            </div>
          </div>
        </div>

        <input
          {...register('isContactPublic')}
          className="sr-only"
          type="checkbox"
        />
      </label>
    </>
  );
}
