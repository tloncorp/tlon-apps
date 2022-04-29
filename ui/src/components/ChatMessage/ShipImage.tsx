import React from 'react';
import { reactRenderer, sigil } from '@tlon/sigil-js';

interface ShipImageProps {
  ship: string;
}
const size = 16;

export default function ShipImage(props: ShipImageProps) {
  const { ship } = props;

  return (
    <div className="h-6 w-6 rounded bg-black p-1">
      {sigil({
        patp: ship,
        renderer: reactRenderer,
        icon: true,
        size,
      })}
    </div>
  );
}
