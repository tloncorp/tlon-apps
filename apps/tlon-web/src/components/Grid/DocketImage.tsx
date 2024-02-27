import { Docket } from '@urbit/api';
import cn from 'classnames';
import React, { useState } from 'react';

import useTileColor from './useTileColor';

type DocketImageSizes = 'xs' | 'small' | 'default' | 'full';

interface DocketImageProps extends Pick<Docket, 'color' | 'image'> {
  className?: string;
  size?: DocketImageSizes;
}

const sizeMap: Record<DocketImageSizes, string> = {
  xs: 'w-6 h-6 mr-2 rounded',
  small: 'w-8 h-8 mr-3 rounded-md',
  default: 'w-12 h-12 mr-3 rounded-lg',
  full: 'w-20 h-20 md:w-32 md:h-32 rounded-2xl',
};

export default function DocketImage({
  color,
  image,
  className = '',
  size = 'full',
}: DocketImageProps) {
  const { tileColor } = useTileColor(color);
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className={cn(
        'relative flex-none overflow-hidden bg-gray-200',
        sizeMap[size],
        className
      )}
      style={{ backgroundColor: tileColor }}
    >
      {image && !imageError && (
        <img
          className="absolute left-0 top-0 h-full w-full object-cover"
          src={image}
          alt=""
          onError={() => setImageError(true)}
        />
      )}
    </div>
  );
}
