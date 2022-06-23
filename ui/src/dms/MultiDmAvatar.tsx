import cn from 'classnames';
import React from 'react';
import PeopleIcon from '../components/icons/PeopleIcon';

type MultiDmAvatarSize = 'xs' | 'small' | 'default' | 'huge';

interface MultiDmAvatarProps {
  img?: string;
  size?: MultiDmAvatarSize;
  className?: string;
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
  img,
  size = 'default',
  className,
}: MultiDmAvatarProps) {
  if (img) {
    return <img className={cn(sizeMap[size].size, className)} src={img} />;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center bg-gray-50 text-gray-600',
        sizeMap[size].size,
        className
      )}
    >
      <PeopleIcon className={sizeMap[size].iconSize} />
    </div>
  );
}
