import React, { useEffect, useState } from 'react';
import { FieldError, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import ColorBoxIcon from '@/components/icons/ColorBoxIcon';
import EmptyIconBox from '@/components/icons/EmptyIconBox';
import ColorPicker from '@/components/ColorPicker';
import GroupAvatar from '@/groups/GroupAvatar';
import { isValidUrl } from '@/logic/utils';
import useMedia from '@/logic/useMedia';
import { NewGroupFormSchema } from '@/types/groups';

interface NewGroupFormProps {
  register: UseFormRegister<NewGroupFormSchema>;
  errors: Record<string, FieldError>;
  watch: (names?: string) => unknown;
  setValue: UseFormSetValue<NewGroupFormSchema>;
  isValid: boolean;
  goToPrevStep: () => void;
  goToNextStep: () => void;
}

export default function NewGroupForm({
  register,
  errors,
  watch,
  setValue,
  isValid,
  goToPrevStep,
  goToNextStep,
}: NewGroupFormProps) {
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
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col">
        <span className="text-lg font-bold">Group Info</span>
        <span className="pt-1 font-bold text-gray-600">
          Fill out information about your group
        </span>
      </div>
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
                    setValue('color', newColor || '')
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
          <GroupAvatar size="h-14 w-14" img={iconUrl} />
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
      <div className="flex justify-end space-x-2 py-4">
        <button className="secondary-button" onClick={goToPrevStep}>
          Back
        </button>
        <button
          disabled={iconType === undefined || !isValid}
          className="button"
          onClick={goToNextStep}
        >
          Next
        </button>
      </div>
    </div>
  );
}
