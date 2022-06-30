import React, { useState } from 'react';
import { UseFormRegister } from 'react-hook-form';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import * as Popover from '@radix-ui/react-popover';
import classNames from 'classnames';
import { GroupMeta } from '../types/groups';

interface ColorPickerProps {
  register: UseFormRegister<GroupMeta>;
  defaultColor?: string;
  className?: string;
}

export default function ColorPicker({
  register,
  defaultColor,
  className,
}: ColorPickerProps) {
  const initialColor = defaultColor ? defaultColor : '#b3b3b3';
  const [color, setColor] = useState(initialColor);
  return (
    <div className={classNames('flex items-center', className)}>
      <HexColorInput
        prefixed
        {...register('color')}
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
