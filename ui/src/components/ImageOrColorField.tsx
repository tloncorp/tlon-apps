import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import useMedia from '@/logic/useMedia';
import { isColor, isValidUrl } from '@/logic/utils';
import {
  FieldPath,
  FieldValues,
  Path,
  PathValue,
  useFormContext,
} from 'react-hook-form';
import { ColorPickerField } from './ColorPicker';
import XIcon from './icons/XIcon';

export type ImageOrColorFieldState = 'initial' | 'image' | 'color';

export interface ImageOrColorFieldProps<FormType extends FieldValues> {
  fieldName: FieldPath<FormType>;
  state?: ImageOrColorFieldState;
  setState?: (state: ImageOrColorFieldState) => void;
}

export default function ImageOrColorField<FormType extends FieldValues>({
  fieldName,
  state,
  setState,
}: ImageOrColorFieldProps<FormType>) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<FormType>();
  const fieldValue = watch(fieldName);
  const [type, setType] = useState<ImageOrColorFieldState>('initial');
  const dark = useMedia('(prefers-color-scheme: dark)');
  const defaultColor = dark ? '#FFFFFF' : '#000000';
  const status = state || type;
  const setStatus = setState || setType;

  useEffect(() => {
    if (isColor(fieldValue)) {
      setStatus('color');
    } else if (fieldValue !== '') {
      setStatus('image');
    } else {
      setStatus('initial');
    }
  }, [setStatus, fieldValue]);

  const handleColorIconType = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setStatus('color');
    setValue(fieldName, defaultColor as any);
  };

  const initial = useCallback(() => {
    setValue(fieldName, '' as PathValue<FormType, Path<FormType>>, {
      shouldDirty: true,
      shouldTouch: true,
    });
    setStatus('initial');
  }, [fieldName, setValue, setStatus]);

  return (
    <div className="flex items-center space-x-2">
      {status === 'initial' || status === 'image' ? (
        <div className="relative flex w-full items-baseline">
          <input
            className={cn('input grow', {
              'rounded-r-none': status === 'image',
            })}
            onFocus={() => setStatus('image')}
            {...register(fieldName, {
              required: true,
              validate: (value) => isValidUrl(value),
            })}
          />
          {status === 'initial' ? (
            <div className="pointer-events-none absolute left-[0.5625rem] top-2 cursor-pointer">
              <span className="pointer-events-none">Paste an image URL</span>{' '}
              <button
                type="button"
                className="default-focus pointer-events-auto m-0 inline w-auto appearance-none border-none bg-transparent p-0 text-blue"
                onClick={handleColorIconType}
              >
                or choose fill color
              </button>
            </div>
          ) : null}
          {status === 'image' ? (
            <button
              className="secondary-button self-stretch rounded-l-none px-2"
              onClick={initial}
            >
              <XIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}
      {status === 'color' ? (
        <div className="flex items-center space-x-2">
          <ColorPickerField fieldName={fieldName} />
          <button className="secondary-button px-2" onClick={initial}>
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {errors[fieldName] ? (
        <span className="text-sm">{errors[fieldName]?.message}</span>
      ) : null}
    </div>
  );
}
