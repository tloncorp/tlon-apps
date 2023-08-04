import React from 'react';
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
        className={className}
        viewBox="0 0 25 24"
        fill="none"
      >
        <path
          className="stroke-current"
          strokeOpacity={isDarkMode ? '.8' : '.2'}
          strokeWidth="2"
          d="M5.454 9.546a7.5 7.5 0 0 1 14.971 0l.409 6.741a.672.672 0 0 1-.671.713H5.716a.672.672 0 0 1-.67-.713l.408-6.741ZM15.94 18a3 3 0 0 1-6 0"
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 25 24"
      fill="none"
    >
      <path
        className="fill-current"
        d="M4.455 9.485a8.5 8.5 0 0 1 16.968 0l.409 6.742A1.672 1.672 0 0 1 20.163 18H5.716a1.672 1.672 0 0 1-1.67-1.773l.41-6.742Z"
      />
      <path
        className="stroke-current"
        strokeWidth="2"
        d="M15.94 18a3 3 0 0 1-6 0"
      />
    </svg>
  );
}
