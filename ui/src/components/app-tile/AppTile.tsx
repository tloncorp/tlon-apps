import { Charge } from '@urbit/api';
import React, { useState } from 'react';

function normalizeUrbitColor(color: string): string {
  if (color.startsWith('#')) {
    return color;
  }
  return `#${color.slice(2).replace('.', '').toUpperCase()}`;
}

export default function AppTile({
  title,
  image,
  color,
}: Pick<Charge, 'title' | 'image' | 'color'>) {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className="overflow-hidden relative flex-none mr-3 w-12 h-12 bg-gray-200 rounded-lg"
      style={{ backgroundColor: normalizeUrbitColor(color) }}
    >
      {image && !imageError && (
        <img
          className="object-cover absolute top-0 left-0 w-full h-full"
          src={image}
          alt={`app tile for ${title}`}
          onError={() => setImageError(true)}
        />
      )}
    </div>
  );
}
