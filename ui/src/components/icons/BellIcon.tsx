import React from 'react';
import cn from 'classnames';
import { IconProps } from './icon';

export default function BellIcon({
  className,
  isInactive,
  isDarkMode,
}: { isInactive?: boolean; isDarkMode?: boolean } & IconProps) {
  if (isInactive) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={cn(className, 'pb-1')}
        viewBox="0 0 21 22"
        fill="none"
      >
        <path
          className="stroke-current"
          strokeOpacity={isDarkMode ? '.8' : '.2'}
          strokeWidth="1.8"
          d="M2.757 7.946a7.93 7.93 0 0 1 15.736 0l.865 6.919A1.9 1.9 0 0 1 17.473 17H3.777a1.9 1.9 0 0 1-1.885-2.135l.865-6.92Z"
        />
        <path
          className="stroke-current"
          strokeLinecap="round"
          strokeOpacity={isDarkMode ? '.8' : '.2'}
          strokeWidth="1.8"
          d="M13.625 18a3 3 0 1 1-6 0"
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className, 'pb-1')}
      viewBox="0 0 21 22"
      fill="none"
    >
      <path
        className="fill-current stroke-current"
        strokeWidth="1.8"
        d="M2.757 7.946a7.93 7.93 0 0 1 15.736 0l.865 6.919A1.9 1.9 0 0 1 17.473 17H3.777a1.9 1.9 0 0 1-1.885-2.135l.865-6.92Z"
      />
      <path
        className="stroke-current"
        strokeLinecap="round"
        strokeWidth="1.8"
        d="M13.625 18a3 3 0 1 1-6 0"
      />
    </svg>
  );
}
