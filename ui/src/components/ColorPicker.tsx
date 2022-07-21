import React from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import * as Popover from '@radix-ui/react-popover';
import classNames from 'classnames';

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
