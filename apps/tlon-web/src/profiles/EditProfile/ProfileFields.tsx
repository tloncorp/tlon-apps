import ColorPicker from '@/components/ColorPicker';
import ImageURLUploadField from '@/components/ImageURLUploadField';
import { normalizeUrbitColor } from '@/logic/utils';
import { useCalm } from '@/state/settings';
import { ContactEditField } from '@urbit/api';
import { debounce } from 'lodash';
import React from 'react';
import { useFormContext } from 'react-hook-form';

export default function ProfileFields() {
  const { register, watch, setValue, formState } =
    useFormContext<ContactEditField>();
  const { errors } = formState;
  const watchAvatar = watch('avatar');
  const watchCover = watch('cover');
  const watchSigilColor = watch('color');
  const calm = useCalm();

  const setColor = (newColor: string) => {
    setValue('color', normalizeUrbitColor(newColor), {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const debouncedSetColor = debounce(setColor, 100);

  return (
    <>
      <div className="flex">
        <div className="flex grow flex-col">
          <span className="pb-2 font-bold">Sigil Color</span>
          <div className="flex items-center space-x-2">
            <div className="relative flex w-full items-baseline">
              <ColorPicker
                color={normalizeUrbitColor(watchSigilColor || '0x0')}
                setColor={debouncedSetColor}
                className="z-10"
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
        <ImageURLUploadField
          formWatchURL={watchAvatar}
          formValue="avatar"
          formSetValue={setValue}
          formRegister={register}
        />
        <div className="mt-1 text-sm font-semibold text-gray-600">
          {calm.disableAvatars || calm.disableRemoteContent ? (
            <span>
              You are hiding {calm.disableAvatars && 'avatars'}
              {calm.disableAvatars && calm.disableRemoteContent ? ' and ' : ''}
              {calm.disableRemoteContent && 'remote content'} in your Landscape
              settings, but your avatar may be visible to others.
            </span>
          ) : (
            <span>Overlay avatars may be hidden by other users.</span>
          )}
        </div>
      </div>
      <div className="flex flex-col">
        <label htmlFor="headerImage" className="pb-2 font-bold">
          Header Image
        </label>
        <ImageURLUploadField
          formWatchURL={watchCover}
          formValue="cover"
          formSetValue={setValue}
          formRegister={register}
        />
        <div className="mt-1 text-sm font-semibold text-gray-600">
          {calm.disableRemoteContent ? (
            <span>
              You are hiding remote content in your Landscape settings, but your
              header image may be visible to others.
            </span>
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

        {calm.disableNicknames ? (
          <div className="mt-1 text-sm font-semibold text-gray-600">
            You are hiding display names in your Landscape settings, but your
            display name may be visible to others.
          </div>
        ) : null}
      </div>
      <div className="flex flex-col">
        <label htmlFor="bio" className="pb-2 font-bold">
          Bio
        </label>
        <textarea
          {...register('bio', { maxLength: 1000 })}
          className="input h-44"
          placeholder="Add a bio"
          spellCheck={`${!calm.disableSpellcheck}`}
        />
      </div>
    </>
  );
}
