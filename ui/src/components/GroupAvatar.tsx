import cn from 'classnames';
import React from 'react';

interface GroupAvatarProps {
  img?: string;
  size?: string;
  className?: string;
}

export default function GroupAvatar({
  img,
  size = 'h-6 w-6',
  className,
}: GroupAvatarProps) {
  return (img || '').length > 0 ? (
    <img className={cn('rounded', size, className)} src={img} />
  ) : (
    <div className={cn('rounded border-2 border-gray-100', size, className)} />
  );
}
