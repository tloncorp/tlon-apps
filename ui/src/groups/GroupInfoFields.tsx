import React, { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import ColorPicker from '@/components/ColorPicker';
import ColorBoxIcon from '@/components/icons/ColorBoxIcon';
import EmptyIconBox from '@/components/icons/EmptyIconBox';
import useMedia from '@/logic/useMedia';
import { isValidUrl } from '@/logic/utils';
import { GroupMeta } from '@/types/groups';
import GroupAvatar from './GroupAvatar';

export default function GroupInfoFields() {
  const {
    register,
    unregister,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<GroupMeta>();
  const [iconType, setIconType] = useState<'image' | 'color'>();
  const [iconColor, setIconColor] = useState<string>();
  const [iconLetter, setIconLetter] = useState<string>();
  const [iconUrl, setIconUrl] = useState<string>();
  const watchIconColor = watch('color');
  const watchIconImage = watch('image');
  const watchTitle = watch('title');
  const dark = useMedia('(prefers-color-scheme: dark)');
  const defaultColor = dark ? '#FFFFFF' : '#000000';

  useEffect(() => {
    if (watchIconImage) {
      setIconType('image');
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

  useEffect(() => {
    if (iconType === 'color' && watchTitle !== '') {
      setIconLetter((watchTitle as string).slice(0, 1));
    }
  }, [iconType, watchTitle]);

  useEffect(() => {
    if (iconType === 'image' && watchIconImage !== '') {
      setIconUrl(watchIconImage as string);
    }
  }, [iconType, watchIconImage]);

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
    setValue('image', '');
    unregister('image');
  };

  console.log(watchIconImage, iconUrl, isValidUrl(iconUrl));

  return (
    <>
      <div className="flex justify-between">
        <div className="flex flex-col">
          <span className="pb-2 font-bold">Group Icon *</span>
          <div className="flex items-center space-x-2">
            {iconType === undefined ? (
              <>
                <button
                  className="secondary-button"
                  onClick={() => setIconType('image')}
                >
                  Image URL
                </button>
                <span className="text-sm font-semibold">or</span>
                <button
                  className="secondary-button"
                  onClick={() => setIconType('color')}
                >
                  Fill Color
                </button>
              </>
            ) : null}
            {iconType === 'image' ? (
              <>
                <input
                  className="input"
                  placeholder="Paste Image URL"
                  {...register('image', {
                    required: true,
                    validate: (value) => isValidUrl(value),
                  })}
                  type="url"
                />
                <button
                  className="secondary-button"
                  onClick={handleCancelImageIcon}
                >
                  Cancel
                </button>
              </>
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
                  className="secondary-button"
                  onClick={handleCancelColorIcon}
                >
                  Cancel
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
            className="h-12 w-12 text-xl"
            color={iconColor ? iconColor : '#000000'}
            letter={iconLetter ? iconLetter : 'T'}
          />
        ) : null}
        {iconType === 'image' && isValidUrl(iconUrl) ? (
          <GroupAvatar size="h-14 w-14" image={iconUrl} />
        ) : null}
        {iconType === undefined ? (
          <EmptyIconBox className="h-14 w-14 text-gray-300" />
        ) : null}
      </div>
      <div className="flex flex-col">
        <label htmlFor="title" className="pb-2 font-bold">
          Group Name *
        </label>
        <input
          // TODO: set sane maxLength
          {...register('title', { required: true, maxLength: 180 })}
          className="input"
          type="text"
          placeholder="Title"
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
