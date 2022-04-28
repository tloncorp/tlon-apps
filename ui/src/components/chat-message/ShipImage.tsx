import React from 'react';
import { reactRenderer, sigil } from '@tlon/sigil-js';

interface ShipImageProps {
  ship: string;
}
const size = 16;

export default function ShipImage(props: ShipImageProps) {
  const { ship } = props;

  return (
    <div className="p-1 w-6 h-6 bg-black rounded">
      {sigil({
        patp: ship,
        renderer: reactRenderer,
        icon: true,
        size,
      })}
    </div>
  );
}
