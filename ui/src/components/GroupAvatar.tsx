import cn from 'classnames';
import React from 'react';

interface GroupAvatarProps {
  img?: string;
  className?: string;
}

export default function GroupAvatar({ img, className }: GroupAvatarProps) {
  return (img || '').length > 0 ? (
    <img className={cn('h-6 w-6 rounded', className)} src={img} />
  ) : (
    <div
      className={cn('h-6 w-6 rounded border-2 border-gray-100', className)}
    />
  );
}
