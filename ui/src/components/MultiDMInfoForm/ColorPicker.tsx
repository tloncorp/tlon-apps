import React, {useState} from "react";
import { UseFormRegister } from 'react-hook-form';
import { HexColorPicker, HexColorInput } from "react-colorful";
import * as Popover from '@radix-ui/react-popover';

export interface MultiDMInfoSchema {
  name: string;
  color: string;
}

interface ColorPickerProps {
  register: UseFormRegister<MultiDMInfoSchema>;
  defaultColor?: string;
}

export default function ColorPicker({register, defaultColor}: ColorPickerProps) {
  const initialColor = defaultColor ? defaultColor : "#b3b3b3";
  const [color, setColor] = useState(initialColor);
  return (
    <div className="mt-4 flex items-center">
      <HexColorInput prefixed
      {...register('color')} 
      className="input w-full rounded-l-lg rounded-r-none p-1" 
      type="text" 
      color={color} 
      onChange={setColor} />
      <Popover.Root>
        <Popover.Trigger style={{backgroundColor: color}} className="h-8 w-8 rounded-r-lg rounded-l-none"/>
        <Popover.Content>
          <HexColorPicker color={color} onChange={setColor} />
          <Popover.Arrow className="fill-gray-300"/>
        </Popover.Content>
      </Popover.Root>
    </div>

  );
}