import GroupAvatar from '@/groups/GroupAvatar';
import cn from 'classnames';
import React from 'react';
import { isColor } from '@/logic/utils';
import PeopleIcon from '../components/icons/PeopleIcon';

type MultiDmAvatarSize = 'xs' | 'small' | 'default' | 'huge';

interface MultiDmAvatarProps {
  image?: string;
  color?: string;
  size?: MultiDmAvatarSize;
  className?: string;
  title?: string;
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
}: MultiDmAvatarProps) {
  if (image && isColor(image)) {
    return (
      <GroupAvatar size={sizeMap[size].size} image={image} title={title} />
    );
  }

  if (image) {
    return <img className={cn(sizeMap[size].size, className)} src={image} />;
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
