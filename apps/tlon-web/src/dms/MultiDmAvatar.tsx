import cn from 'classnames';
import React, { useState } from 'react';

import Image from '@/components/Image';
import GroupAvatar from '@/groups/GroupAvatar';
import { isColor } from '@/logic/utils';
import { useAvatar } from '@/state/avatar';

import PeopleIcon from '../components/icons/PeopleIcon';

export type MultiDmAvatarSize = 'xs' | 'small' | 'default' | 'huge';

interface MultiDmAvatarProps {
  image?: string;
  color?: string;
  size?: MultiDmAvatarSize;
  className?: string;
  title?: string;
  loadImage?: boolean;
}

const sizeMap = {
  xs: {
    size: 'h-6 w-6 rounded',
    iconSize: 'h-6 w-6',
  },
  small: {
    size: 'h-8 w-8 rounded',
    iconSize: 'h-6 w-6',
  },
  default: {
    size: 'h-12 w-12 rounded-lg',
    iconSize: 'h-8 w-8',
  },
  huge: {
    size: 'h-20 w-20 rounded-xl',
    iconSize: 'h-8 w-8',
  },
};

export default function MultiDmAvatar({
  image,
  color,
  size = 'default',
  className,
  title,
  loadImage = true,
}: MultiDmAvatarProps) {
  const { hasLoaded, load } = useAvatar(image || '');
  const showImage = hasLoaded || loadImage;

  if (image && isColor(image)) {
    return (
      <GroupAvatar
        size={sizeMap[size].size}
        image={image}
        title={title}
        loadImage={loadImage}
      />
    );
  }

  if (image && showImage) {
    return (
      <Image
        src={image}
        alt={title}
        className={cn(sizeMap[size].size, className)}
        onLoad={load}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center bg-gray-50 text-gray-600',
        sizeMap[size].size,
        className
      )}
      style={{
        backgroundColor: color,
      }}
    >
      <PeopleIcon
        className={cn(color && 'mix-blend-multiply', sizeMap[size].iconSize)}
      />
    </div>
  );
}
