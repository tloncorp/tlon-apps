import cn from 'classnames';
import React from 'react';
import useMedia from '../logic/useMedia';

interface GroupAvatarProps {
  img?: string;
  size?: string;
  color?: string;
  className?: string;
}

export default function GroupAvatar({
  img,
  size = 'h-6 w-6',
  color,
  className,
}: GroupAvatarProps) {
  const dark = useMedia('(prefers-color-scheme: dark)');
  const background = color || (dark ? '#1A1A1A' : '#F5F5F5');

  return (img || '').length > 0 ? (
    <img className={cn('rounded', size, className)} src={img} />
  ) : (
    <div className={cn('rounded', size, className)} style={{ background }} />
  );
}
