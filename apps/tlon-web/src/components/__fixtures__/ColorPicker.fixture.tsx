import ColorPicker from '@/components/ColorPicker';
import { useState } from 'react';

export default function ColorPickerFixture() {
  const [color, setColor] = useState('#F00');
  return <ColorPicker color={color} setColor={setColor} />;
}
