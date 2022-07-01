import React from 'react';
import { UseFormRegister, FieldValues } from 'react-hook-form';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import * as Popover from '@radix-ui/react-popover';
import classNames from 'classnames';

interface ColorPickerProps {
  register: UseFormRegister<FieldValues>;
  defaultColor?: string;
  color: string;
  className?: string;
  setColor: (newColor: string) => void;
}

export default function ColorPicker({
  register,
  defaultColor,
  className,
  color,
  setColor,
}: ColorPickerProps) {
  const initialColor = defaultColor ? defaultColor : '#b3b3b3';
  return (
    <div className={classNames('flex items-center', className)}>
      <HexColorInput
        prefixed
        {...register('color')}
        className="input w-full rounded-l-lg rounded-r-none p-1"
        type="text"
        color={color === '' ? initialColor : color}
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
