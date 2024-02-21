import cn from 'classnames';
import React, { useEffect, useState } from 'react';
import { FieldPath, FieldValues, useFormContext } from 'react-hook-form';

import { isColor, isValidUrl } from '@/logic/utils';

import { ColorPickerField } from './ColorPicker';
import ImageURLUploadField from './ImageURLUploadField';
import XIcon from './icons/XIcon';

export type ImageOrColorFieldState = 'image' | 'color';

export interface ImageOrColorFieldProps<FormType extends FieldValues> {
  fieldName: FieldPath<FormType>;
  state?: ImageOrColorFieldState;
  setState?: (state: ImageOrColorFieldState) => void;
  defaultColor?: string;
}

export default function ImageOrColorField<FormType extends FieldValues>({
  fieldName,
  state,
  setState,
  defaultColor = '#D9D9D9',
}: ImageOrColorFieldProps<FormType>) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<FormType>();
  const [type, setType] = useState<ImageOrColorFieldState>('color');
  const status = state || type;
  const setStatus = setState || setType;
  const watchValue = watch(fieldName);
  const error = errors[fieldName];

  useEffect(() => {
    if (isValidUrl(watchValue) && !isColor(watchValue) && status === 'color') {
      setStatus('image');
      setValue(fieldName, watchValue as any);
    } else if (watchValue === '' && status === 'color') {
      setValue(fieldName, defaultColor as any);
    }
  }, [defaultColor, watchValue, fieldName, setStatus, status, setValue]);

  const handleColorIconType = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setStatus('color');
    setValue(fieldName, defaultColor as any);
  };

  const handleImageIconType = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setStatus('image');
    setValue(fieldName, '' as any, {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  return (
    <>
      <div className="flex w-full items-center space-x-2">
        {status === 'image' ? (
          <>
            <ImageURLUploadField
              formRegister={register}
              formSetValue={setValue}
              formWatchURL={watchValue}
              formValue={fieldName}
            />
            <button
              className="flex items-center justify-center"
              onClick={handleColorIconType}
            >
              <XIcon className="h-4 w-4" />
            </button>
          </>
        ) : null}
        {status === 'color' ? (
          <div className="input flex h-8 w-full items-center rounded-lg">
            <ColorPickerField fieldName={fieldName} />
            <button
              className="small-button h-6 whitespace-nowrap"
              onClick={handleImageIconType}
            >
              Add Image
            </button>
          </div>
        ) : null}
      </div>
      {error && typeof error.message === 'string' ? (
        <span className="text-sm">{error.message}</span>
      ) : null}
    </>
  );
}
