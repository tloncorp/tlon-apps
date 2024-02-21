import React from 'react';

import { IconProps } from './icon';

export default function NavigateIcon({
  className,
  isInactive,
  isDarkMode,
}: { isInactive?: boolean; isDarkMode?: boolean } & IconProps) {
  let opacity = '1';
  if (isInactive) {
    opacity = isDarkMode ? '.8' : '.2';
  }

  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle
        cx="10"
        cy="10"
        r="9"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-current"
        opacity={opacity}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.971 5.6174C14.2388 5.45671 14.5433 5.76119 14.3826 6.02899L11.2886 11.1857C11.2633 11.2279 11.2279 11.2633 11.1857 11.2886L6.02899 14.3826C5.76119 14.5433 5.45671 14.2388 5.61739 13.971L8.71141 8.81431C8.73675 8.77209 8.77209 8.73675 8.81431 8.71141L13.971 5.6174Z"
        className="fill-current"
        opacity={opacity}
      />
    </svg>
  );
}
