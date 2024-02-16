import { useState } from 'react';

import ColorPicker from '@/components/ColorPicker';

export default function ColorPickerFixture() {
  const [color, setColor] = useState('#F00');
  return <ColorPicker color={color} setColor={setColor} />;
}
