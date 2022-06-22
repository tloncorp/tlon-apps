import cn from 'classnames';
import React from 'react';
import PeopleIcon from '../components/icons/PeopleIcon';

interface MultiDmAvatarProps {
  img?: string;
  size?: string;
}

export default function MultiDmAvatar({
  img,
  size = 'h-6 w-6',
}: MultiDmAvatarProps) {
  if (img) {
    return <img className={cn('rounded-lg', size)} src={img} />;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center  rounded-lg bg-gray-50 text-gray-600',
        size
      )}
    >
      <PeopleIcon className="h-6 w-6" />
    </div>
  );
}
