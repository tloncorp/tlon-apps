import React from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import * as Popover from '@radix-ui/react-popover';
import classNames from 'classnames';
import {
  Controller,
  FieldPath,
  FieldValues,
  Path,
  PathValue,
  useFormContext,
} from 'react-hook-form';
import { isColor } from '@/logic/utils';

interface ColorPickerProps {
  color: string;
  setColor: (newColor: string) => void;
  className?: string;
}

export default function ColorPicker({
  className,
  color,
  setColor,
}: ColorPickerProps) {
  return (
    <div className={classNames('flex items-center', className)}>
      <HexColorInput
        prefixed
        className="input w-full rounded-l-lg rounded-r-none p-1"
        type="text"
        color={color}
        onChange={setColor}
      />
      <Popover.Root>
        <Popover.Trigger
          style={{ backgroundColor: color }}
          className="h-8 w-8 rounded-r-lg rounded-l-none"
        />
        <Popover.Content>
          <HexColorPicker color={color} onChange={setColor} />
          <Popover.Arrow className="fill-gray-300" />
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}

interface ColorPickerFieldProps<FormType extends FieldValues> {
  fieldName: FieldPath<FormType>;
  defaultValue?: PathValue<FormType, Path<FormType>>;
  className?: string;
}

export function ColorPickerField<FormType extends FieldValues>({
  fieldName,
  defaultValue,
  className,
}: ColorPickerFieldProps<FormType>) {
  const { control } = useFormContext<FormType>();

  return (
    <Controller
      control={control}
      name={fieldName}
      defaultValue={defaultValue}
      rules={{ validate: isColor }}
      render={({ field: { onChange, value } }) => (
        <ColorPicker
          className={className}
          color={value}
          setColor={(newColor) => onChange(newColor)}
        />
      )}
    />
  );
}
