import React, { useEffect, useState } from 'react';
import cn from 'classnames';
import { useFormContext } from 'react-hook-form';
import {
  Contact,
  ContactEditFieldPrim,
  ContactEditField,
  ContactUpdate,
} from '@urbit/api';
import ColorPicker from '@/components/ColorPicker';
import ColorBoxIcon from '@/components/icons/ColorBoxIcon';
import EmptyIconBox from '@/components/icons/EmptyIconBox';
import XIcon from '@/components/icons/XIcon';
import useMedia from '@/logic/useMedia';
import { isValidUrl } from '@/logic/utils';
import { GroupMeta } from '@/types/groups';

interface ProfileFormSchema extends ContactEditField {
  isContactPublic: boolean;
}

export default function ProfileFields() {
  const {
    register,
    unregister,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ProfileFormSchema>();
  const [iconType, setIconType] = useState<'avatar' | 'color'>();
  const [iconColor, setIconColor] = useState<string>();
  const [iconLetter, setIconLetter] = useState<string>();
  const [iconUrl, setIconUrl] = useState<string>();
  const watchIconColor = watch('color');
  const watchIconImage = watch('avatar');
  // const watchTitle = watch('title');
  const dark = useMedia('(prefers-color-scheme: dark)');
  const defaultColor = dark ? '#FFFFFF' : '#000000';

  useEffect(() => {
    if (watchIconImage) {
      setIconType('avatar');
    } else if (watchIconColor) {
      setIconType('color');
    } else {
      setIconType(undefined);
    }
  }, [watchIconColor, watchIconImage]);

  useEffect(() => {
    if (iconType === 'color' && watchIconColor !== '') {
      setIconColor(watchIconColor as string);
    }
  }, [iconType, watchIconColor]);

  // useEffect(() => {
  //   if (iconType === 'color' && watchTitle !== '') {
  //     setIconLetter((watchTitle as string).slice(0, 1));
  //   }
  // }, [iconType, watchTitle]);

  // useEffect(() => {
  //   if (iconType === 'image' && watchIconImage !== '') {
  //     setIconUrl(watchIconImage as string);
  //   }
  // }, [iconType, watchIconImage]);

  useEffect(() => {
    register('color');
  }, []); // eslint-disable-line

  const handleCancelColorIcon = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setIconType(undefined);
    setIconColor(undefined);
    setIconLetter(undefined);
    setValue('color', '');
  };

  const handleCancelImageIcon = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setIconType(undefined);
    setIconUrl(undefined);
    setValue('avatar', '');
    unregister('avatar');
  };

  return (
    <>
      <div className="flex">
        <div className="flex grow flex-col">
          <span className="pb-2 font-bold">Group Icon*</span>
          <div className="flex items-center space-x-2">
            {iconType === undefined || iconType === 'avatar' ? (
              <div className="relative flex w-full items-baseline">
                <input
                  className={cn('input grow', {
                    'rounded-r-none': iconType === 'avatar',
                  })}
                  onFocus={() => setIconType('avatar')}
                  {...register('avatar', {
                    required: true,
                    validate: (value) => isValidUrl(value),
                  })}
                />
                {iconType === undefined ? (
                  <div className="pointer-events-none absolute left-[0.5625rem] top-2 cursor-pointer">
                    <span className="pointer-events-none">
                      Paste an image URL
                    </span>
                    <span
                      className="pointer-events-auto text-blue"
                      onClick={() => setIconType('color')}
                    >
                      {' '}
                      or choose fill color
                    </span>
                  </div>
                ) : null}
                {iconType === 'avatar' ? (
                  <button
                    className="secondary-button self-stretch rounded-l-none px-2"
                    onClick={handleCancelImageIcon}
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
            {iconType === 'color' ? (
              <div className="flex items-center space-x-2">
                <ColorPicker
                  color={
                    (watchIconColor as string) === ''
                      ? defaultColor
                      : (watchIconColor as string)
                  }
                  setColor={(newColor: string) =>
                    setValue('color', newColor || '', {
                      shouldDirty: true,
                      shouldTouch: true,
                    })
                  }
                />
                <button
                  className="secondary-button px-2"
                  onClick={handleCancelColorIcon}
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            {errors.color ? (
              <span className="text-sm">{errors.color.message}</span>
            ) : null}
          </div>
        </div>
        {iconType === 'color' ? (
          <ColorBoxIcon
            className="ml-2 h-12 w-12 text-xl"
            color={iconColor ? iconColor : '#000000'}
            letter={iconLetter ? iconLetter : 'T'}
          />
        ) : null}
        {/* {iconType === 'avatar' && isValidUrl(iconUrl) ? (
          <GroupAvatar size="ml-2 h-14 w-14" image={iconUrl} />
        ) : null} */}
        {iconType === undefined ? (
          <EmptyIconBox className="ml-2 h-14 w-14 text-gray-300" />
        ) : null}
      </div>
      <div className="flex flex-col">
        <label htmlFor="title" className="pb-2 font-bold">
          Display Name
        </label>
        <input
          // TODO: set sane maxLength
          {...register('nickname', { required: true, maxLength: 180 })}
          className="input"
          type="text"
          placeholder="Name"
        />
      </div>
      <div className="flex flex-col">
        <label htmlFor="description" className="pb-2 font-bold">
          Group Description (optional)
        </label>
        <textarea
          // TODO: set sane maxLength
          {...register('description', { maxLength: 300 })}
          className="input"
        />
      </div>
    </>
  );
}
