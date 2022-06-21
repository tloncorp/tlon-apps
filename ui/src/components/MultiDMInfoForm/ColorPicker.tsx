import React, {useState} from "react";
import { UseFormRegister } from 'react-hook-form';

export interface MultiDMInfoSchema {
  name: string;
  color: string;
}

interface ColorPickerProps {
  register: UseFormRegister<MultiDMInfoSchema>;
  defaultColor?: string;
}

export default function ColorPicker({register, defaultColor}: ColorPickerProps) {
  const initialColor = defaultColor ? defaultColor : "#3e6b38";
  const [color, setColor] = useState(initialColor);
  return (
    <div className="flex">
      <input {...register('color')} 
      className="input mt-4 w-full rounded-l-lg rounded-r-none p-1" 
      type="text" 
      value={color} 
      onChange={e => setColor(e.target.value)} />
      <input
      className="mt-4 w-full rounded-r-lg rounded-l-none border-0 p-0" 
      type="color" 
      value={color} 
      onChange={e => setColor(e.target.value)} />
    </div>

  );
}